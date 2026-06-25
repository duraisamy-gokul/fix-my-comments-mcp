import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomUUID, createHash as createNodeHash } from 'node:crypto';
import { homedir } from 'node:os';
import { decodeThreadFile, decodeReviewMessageFile } from './generated';
import type {
  Author,
  ReviewMessage,
  ReviewThread,
  ThreadFile,
  ReviewMessageFile,
  ReplyInput,
  StatusInput,
  ThreadFetchResult,
} from './generated';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'fix-my-comments';
const SERVER_VERSION = '2.0.0';

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id: string | number | null;
  method: string;
  params?: unknown;
};

type JsonRpcResponse = {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

const EMPTY_THREADS: ThreadFile = { schemaVersion: 1, threads: [] };
const EMPTY_MESSAGES: ReviewMessageFile = { schemaVersion: 1, messages: [] };

function send(msg: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function ok(id: string | number | null, result: unknown): void {
  send({ jsonrpc: '2.0', id, result });
}

function fail(id: string | number | null, code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function textResult(text: string): {
  content: { type: 'text'; text: string }[];
} {
  return { content: [{ type: 'text' as const, text }] };
}

function readBranch(repoRoot: string): string {
  const prefix = 'ref: refs/heads/';
  try {
    const headPath = join(repoRoot, '.git', 'HEAD');
    if (!existsSync(headPath)) {
      return 'no-git';
    }
    const head = readFileSync(headPath, 'utf8').trim();
    if (head.startsWith(prefix)) {
      return head.slice(prefix.length);
    }
    return 'detached';
  } catch {
    return 'no-git';
  }
}

// Storage lives under ~/.fixmycomments (home root). This MUST stay
// byte-compatible with the extension's computeStoragePath in
// fix-my-comments/src/storage/workspace-identity.ts.
//
// - Git repo: <repo-basename>-<shorthash>/<branch-with-dashes>/  (per branch)
// - Non-git:  <folder-basename>-<shorthash>/                     (no branch seg)
const STORAGE_ROOT = join(homedir(), '.fixmycomments');
const NO_GIT_BRANCH = 'no-git';

function getStoragePath(): string {
  const repoRoot = process.cwd();
  const branch = readBranch(repoRoot);
  const repoFolder = `${basename(repoRoot)}-${createNodeHash('sha1')
    .update(repoRoot)
    .digest('hex')
    .slice(0, 8)}`;
  if (branch === NO_GIT_BRANCH) {
    return join(STORAGE_ROOT, repoFolder);
  }
  const branchFolder = branch.replace(/\//g, '-');
  return join(STORAGE_ROOT, repoFolder, branchFolder);
}

function readJsonFile<T>(filePath: string, empty: T, decode: (raw: unknown) => T | null): T {
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, 'utf8'));
    return decode(parsed) ?? empty;
  } catch {
    return empty;
  }
}

function readThreads(filePath: string): ThreadFile {
  return readJsonFile(filePath, EMPTY_THREADS, decodeThreadFile);
}

function readMessages(filePath: string): ReviewMessageFile {
  return readJsonFile(filePath, EMPTY_MESSAGES, decodeReviewMessageFile);
}

function writeJson(filePath: string, data: unknown): void {
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function sortedThreadMessages(messages: ReviewMessageFile, threadId: string): ReviewMessage[] {
  return messages.messages
    .filter((m) => m.threadId === threadId)
    .sort((a, b) => a.metadata.createdAt.localeCompare(b.metadata.createdAt));
}

function findThread(threads: ThreadFile, threadId: string): ReviewThread | null {
  return threads.threads.find((t) => t.id === threadId) ?? null;
}

function findMessage(
  messages: ReviewMessageFile,
  messageId: string,
): { message: ReviewMessage; index: number } | null {
  const index = messages.messages.findIndex((m) => m.id === messageId);
  if (index === -1) {
    return null;
  }
  return { message: messages.messages[index], index };
}

function messageSummary(message: ReviewMessage): object {
  return {
    id: message.id,
    threadId: message.threadId,
    author: message.author,
    type: message.type,
    markdown: message.content.markdown,
    suggestion: message.suggestion,
    task: message.task,
    reactions: message.reactions,
    createdAt: message.metadata.createdAt,
    updatedAt: message.metadata.updatedAt,
  };
}

function threadSummary(thread: ReviewThread, messageCount: number): object {
  return {
    id: thread.id,
    filePath: thread.anchor.filePath,
    line: thread.anchor.line,
    type: thread.anchor.type,
    snippet: thread.anchor.snippet,
    resolved: thread.status.resolved,
    outdated: thread.status.outdated,
    messageCount,
    updatedAt: thread.metadata.updatedAt,
  };
}

function appendReplyPrefix(content: string, replyToMessageId: unknown): string {
  if (typeof replyToMessageId !== 'string' || replyToMessageId.length === 0) {
    return content;
  }
  return `↳ Reply to ${replyToMessageId}\n\n${content}`;
}

function hashLine(lineText: string): string {
  return createNodeHash('sha256').update(lineText).digest('hex').slice(0, 16);
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    return null;
  }
  return value;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const record: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    record[key] = item;
  }
  return record;
}

function markOutdatedThreads(storagePath: string, threadsFile: ThreadFile): boolean {
  let changed = false;
  for (const thread of threadsFile.threads) {
    if (
      thread.anchor.type !== 'line' ||
      thread.anchor.line == null ||
      thread.anchor.lineHash === ''
    ) {
      continue;
    }
    try {
      const file = readFileSync(join(process.cwd(), thread.anchor.filePath), 'utf8');
      const lineText = file.split(/\r?\n/)[thread.anchor.line];
      if (lineText == null) {
        continue;
      }
      const outdated = hashLine(lineText) !== thread.anchor.lineHash;
      if (thread.status.outdated !== outdated) {
        thread.status = { ...thread.status, outdated };
        thread.metadata = { ...thread.metadata, updatedAt: new Date().toISOString() };
        changed = true;
      }
    } catch {
      // If the workspace file cannot be read, keep the stored status unchanged.
    }
  }
  if (changed) {
    writeJson(join(storagePath, 'threads.json'), threadsFile);
  }
  return changed;
}

function buildThreadFetchResult(
  thread: ReviewThread,
  msgsFile: ReviewMessageFile,
  messageLimitArg: unknown,
): ThreadFetchResult {
  const allMessages = sortedThreadMessages(msgsFile, thread.id);
  const messageLimit = clampInteger(messageLimitArg, allMessages.length, 1, 500);
  const messages = allMessages.slice(-messageLimit);
  return {
    thread,
    messages,
    totalMessages: allMessages.length,
    returnedMessages: messages.length,
  };
}

function parseReplyInput(
  raw: Record<string, unknown>,
  defaults: Record<string, unknown>,
): ReplyInput | null {
  const threadId = raw['threadId'];
  const content = raw['content'];
  if (typeof threadId !== 'string' || typeof content !== 'string') {
    return null;
  }
  const replyToMessageId = raw['replyToMessageId'];
  const agentId = raw['agentId'] ?? defaults['agentId'];
  const agentName = raw['agentName'] ?? defaults['agentName'];
  const summary = raw['summary'] ?? defaults['summary'];
  const suggestionCode = raw['suggestionCode'];
  const originalCode = raw['originalCode'];
  return {
    threadId,
    replyToMessageId: typeof replyToMessageId === 'string' ? replyToMessageId : null,
    content,
    agentId: typeof agentId === 'string' ? agentId : null,
    agentName: typeof agentName === 'string' ? agentName : null,
    summary: typeof summary === 'string' ? summary : null,
    suggestionCode: typeof suggestionCode === 'string' ? suggestionCode : null,
    originalCode: typeof originalCode === 'string' ? originalCode : null,
  };
}

function parseStatusInput(
  raw: Record<string, unknown>,
  defaults: Record<string, unknown>,
): StatusInput | null {
  const threadId = raw['threadId'];
  const status = raw['status'] ?? defaults['status'];
  if (typeof threadId !== 'string' || (status !== 'resolved' && status !== 'open')) {
    return null;
  }
  const reason = raw['reason'] ?? defaults['reason'];
  return {
    threadId,
    status,
    reason: typeof reason === 'string' ? reason : null,
  };
}

const TOOLS = [
  {
    name: 'list_open_threads',
    description:
      'Call this once first to discover actionable Fix My Comments threads. Lists open, non-outdated threads for the current workspace and branch with messageCount. Optionally filter by file path. Do not call get_thread for every thread unless you need that thread content. Set includeOutdated=true only when intentionally inspecting stale anchor comments.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Workspace-relative file path to filter by (optional).',
        },
        includeOutdated: {
          type: 'boolean',
          description:
            'Include outdated/stale threads. Defaults to false so agents avoid stale comments.',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of threads to return. Defaults to all matching threads.',
        },
      },
    },
  },
  {
    name: 'get_thread',
    description:
      'Read actionable thread content before editing or replying. Supports single fetch via threadId and bulk fetch via threadIds. Prefer list_open_threads first, and only fetch threads you will actually address. Use messageLimit for a smaller tail instead of loading full long threads.',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'The thread id for a single fetch.' },
        threadIds: {
          type: 'array',
          items: { type: 'string' },
          description:
            'Thread ids for bulk fetch. Use instead of threadId when fetching multiple addressed threads.',
        },
        messageLimit: {
          type: 'number',
          description: 'Optional maximum number of latest messages to return.',
        },
        includeOutdated: {
          type: 'boolean',
          description: 'Allow reading an outdated/stale thread. Defaults to false.',
        },
      },
    },
  },
  {
    name: 'get_message',
    description:
      'Optional edge-case tool. Use only when the user or another tool gives you a direct messageId and you need just that one message. Do not use for normal thread discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message id.' },
        includeOutdated: {
          type: 'boolean',
          description: 'Allow reading a message from an outdated/stale thread. Defaults to false.',
        },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'get_message_context',
    description:
      'Optional edge-case tool. Use only when you already have a messageId and the thread is long; fetches nearby messages instead of the full thread to save tokens. Do not use for normal thread discovery.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The center message id.' },
        before: {
          type: 'number',
          description: 'How many messages before the target to include. Defaults to 5.',
        },
        after: {
          type: 'number',
          description: 'How many messages after the target to include. Defaults to 0.',
        },
        includeOutdated: {
          type: 'boolean',
          description: 'Allow reading context from an outdated/stale thread. Defaults to false.',
        },
      },
      required: ['messageId'],
    },
  },
  {
    name: 'post_agent_reply',
    description:
      'Append concise AI replies after addressing comments. Supports a single reply with threadId/content or bulk replies with replies[]. Use once per addressed thread to explain what was fixed. Rejected if a target thread is resolved or outdated. Replies that fix code can optionally include suggestions.',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'Thread id to reply to.' },
        replyToMessageId: {
          type: 'string',
          description: 'Optional message id this flat reply is responding to.',
        },
        content: { type: 'string', description: 'Reply message body (markdown).' },
        agentId: {
          type: 'string',
          description: 'Machine identifier for this agent (e.g. claude-code).',
        },
        agentName: {
          type: 'string',
          description: 'Human-readable agent name.',
        },
        replies: {
          type: 'array',
          description:
            'Bulk replies. Each item accepts threadId, content, optional replyToMessageId, summary, suggestionCode, originalCode, agentId, and agentName.',
          items: {
            type: 'object',
            properties: {
              threadId: { type: 'string' },
              replyToMessageId: { type: 'string' },
              content: { type: 'string' },
              summary: { type: 'string' },
              suggestionCode: { type: 'string' },
              originalCode: { type: 'string' },
              agentId: { type: 'string' },
              agentName: { type: 'string' },
            },
            required: ['threadId', 'content'],
          },
        },
        summary: {
          type: 'string',
          description: 'One-sentence summary of what was done.',
        },
        suggestionCode: {
          type: 'string',
          description: 'Optional suggested replacement code, posted as a suggestion message.',
        },
        originalCode: {
          type: 'string',
          description:
            'The original code the suggestion replaces (required if suggestionCode is set).',
        },
      },
      required: [],
    },
  },
  {
    name: 'set_thread_status',
    description:
      'Resolve or reopen a thread. Only call after fixing/responding when the user wants addressed threads marked resolved, or when explicitly reopening a resolved thread before replying.',
    inputSchema: {
      type: 'object',
      properties: {
        threadId: { type: 'string', description: 'The thread id for a single status update.' },
        threadIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Thread ids for bulk status update. Uses the top-level status/reason.',
        },
        updates: {
          type: 'array',
          description:
            'Bulk status updates. Each item accepts threadId, status, and optional reason.',
          items: {
            type: 'object',
            properties: {
              threadId: { type: 'string' },
              status: { type: 'string', enum: ['resolved', 'open'] },
              reason: { type: 'string' },
            },
            required: ['threadId'],
          },
        },
        status: {
          type: 'string',
          enum: ['resolved', 'open'],
          description: 'resolved marks the thread done; open reopens it.',
        },
        reason: {
          type: 'string',
          description: 'Why the status is being changed.',
        },
        agentId: { type: 'string', description: 'Machine identifier for this agent.' },
        agentName: { type: 'string', description: 'Human-readable agent name.' },
      },
      required: [],
    },
  },
  {
    name: 'set_task_message_status',
    description: 'Check or uncheck a task message in a thread as an AI agent.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The task message id.' },
        completed: { type: 'boolean', description: 'true to check the task, false to uncheck it.' },
        agentId: { type: 'string', description: 'Machine identifier for this agent.' },
      },
      required: ['messageId', 'completed', 'agentId'],
    },
  },
  {
    name: 'add_reaction',
    description:
      'Add an emoji reaction to a specific message. Optional: only call when the user asks for reactions or reactions are part of the agreed workflow.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message id to react to.' },
        emoji: { type: 'string', description: 'A single emoji, e.g. 👍 or 🚀.' },
        agentId: { type: 'string', description: 'Machine identifier for this agent.' },
      },
      required: ['messageId', 'emoji', 'agentId'],
    },
  },
  {
    name: 'remove_reaction',
    description: 'Remove this agent’s emoji reaction from a specific message.',
    inputSchema: {
      type: 'object',
      properties: {
        messageId: { type: 'string', description: 'The message id to update.' },
        emoji: { type: 'string', description: 'The emoji reaction to remove.' },
        agentId: { type: 'string', description: 'Machine identifier for this agent.' },
      },
      required: ['messageId', 'emoji', 'agentId'],
    },
  },
];

function handleCall(id: string | number | null, name: string, args: Record<string, unknown>): void {
  let storagePath: string;
  try {
    storagePath = getStoragePath();
  } catch (e) {
    fail(id, -32603, e instanceof Error ? e.message : 'Storage path error');
    return;
  }

  try {
    if (name === 'list_open_threads') {
      const file = readThreads(join(storagePath, 'threads.json'));
      markOutdatedThreads(storagePath, file);
      const msgsFile = readMessages(join(storagePath, 'messages.json'));
      const includeOutdated = args['includeOutdated'] === true;
      const limit = clampInteger(args['limit'], Number.MAX_SAFE_INTEGER, 1, 500);
      let threads = file.threads.filter((t) => !t.status.resolved);
      if (!includeOutdated) {
        threads = threads.filter((t) => !t.status.outdated);
      }
      if (typeof args['filePath'] === 'string') {
        threads = threads.filter((t) => t.anchor.filePath === args['filePath']);
      }
      const summaries = threads.slice(0, limit).map((t) => {
        const count = msgsFile.messages.filter((m) => m.threadId === t.id).length;
        return threadSummary(t, count);
      });
      ok(
        id,
        textResult(
          JSON.stringify(
            {
              threads: summaries,
              totalMatching: threads.length,
              returned: summaries.length,
              excludedOutdatedByDefault: !includeOutdated,
            },
            null,
            2,
          ),
        ),
      );
      return;
    }

    if (name === 'get_thread') {
      const threadId = args['threadId'];
      const threadIdsArg = args['threadIds'];
      const threadIdsBulk = asStringArray(threadIdsArg);
      const threadIds = threadIdsBulk ?? (typeof threadId === 'string' ? [threadId] : []);
      if (threadIds.length === 0) {
        fail(id, -32602, 'threadId or threadIds is required');
        return;
      }

      const threadsFile = readThreads(join(storagePath, 'threads.json'));
      markOutdatedThreads(storagePath, threadsFile);
      const msgsFile = readMessages(join(storagePath, 'messages.json'));
      const results: ThreadFetchResult[] = [];
      for (const idToFetch of threadIds) {
        const thread = findThread(threadsFile, idToFetch);
        if (thread == null) {
          fail(id, -32602, `Thread ${idToFetch} not found`);
          return;
        }
        if (thread.status.outdated && args['includeOutdated'] !== true) {
          fail(
            id,
            -32602,
            `Thread ${idToFetch} is outdated because its anchor line changed. Use includeOutdated=true only to inspect stale comments, not to act on them.`,
          );
          return;
        }
        results.push(buildThreadFetchResult(thread, msgsFile, args['messageLimit']));
      }

      ok(
        id,
        textResult(
          JSON.stringify(
            typeof threadId === 'string' && threadIdsBulk == null
              ? results[0]
              : { threads: results, requested: threadIds.length, returned: results.length },
            null,
            2,
          ),
        ),
      );
      return;
    }

    if (name === 'get_message') {
      const messageId = args['messageId'];
      if (typeof messageId !== 'string') {
        fail(id, -32602, 'messageId is required');
        return;
      }
      const threadsFile = readThreads(join(storagePath, 'threads.json'));
      markOutdatedThreads(storagePath, threadsFile);
      const msgsFile = readMessages(join(storagePath, 'messages.json'));
      const located = findMessage(msgsFile, messageId);
      if (located == null) {
        fail(id, -32602, `Message ${messageId} not found`);
        return;
      }
      const thread = findThread(threadsFile, located.message.threadId);
      if (thread == null) {
        fail(id, -32602, `Thread ${located.message.threadId} not found`);
        return;
      }
      if (thread.status.outdated && args['includeOutdated'] !== true) {
        fail(
          id,
          -32602,
          `Thread ${thread.id} is outdated because its anchor line changed. Use includeOutdated=true only to inspect stale comments, not to act on them.`,
        );
        return;
      }
      const threadMessages = sortedThreadMessages(msgsFile, located.message.threadId);
      const position = threadMessages.findIndex((m) => m.id === messageId);
      ok(
        id,
        textResult(
          JSON.stringify(
            {
              thread: threadSummary(thread, threadMessages.length),
              message: located.message,
              position,
              totalMessages: threadMessages.length,
            },
            null,
            2,
          ),
        ),
      );
      return;
    }

    if (name === 'get_message_context') {
      const messageId = args['messageId'];
      if (typeof messageId !== 'string') {
        fail(id, -32602, 'messageId is required');
        return;
      }
      const threadsFile = readThreads(join(storagePath, 'threads.json'));
      markOutdatedThreads(storagePath, threadsFile);
      const msgsFile = readMessages(join(storagePath, 'messages.json'));
      const located = findMessage(msgsFile, messageId);
      if (located == null) {
        fail(id, -32602, `Message ${messageId} not found`);
        return;
      }
      const thread = findThread(threadsFile, located.message.threadId);
      if (thread == null) {
        fail(id, -32602, `Thread ${located.message.threadId} not found`);
        return;
      }
      if (thread.status.outdated && args['includeOutdated'] !== true) {
        fail(
          id,
          -32602,
          `Thread ${thread.id} is outdated because its anchor line changed. Use includeOutdated=true only to inspect stale comments, not to act on them.`,
        );
        return;
      }
      const before = clampInteger(args['before'], 5, 0, 100);
      const after = clampInteger(args['after'], 0, 0, 100);
      const threadMessages = sortedThreadMessages(msgsFile, located.message.threadId);
      const center = threadMessages.findIndex((m) => m.id === messageId);
      const start = Math.max(0, center - before);
      const end = Math.min(threadMessages.length, center + after + 1);
      ok(
        id,
        textResult(
          JSON.stringify(
            {
              thread: threadSummary(thread, threadMessages.length),
              targetMessageId: messageId,
              targetIndex: center,
              range: { start, endExclusive: end },
              messages: threadMessages.slice(start, end).map(messageSummary),
              totalMessages: threadMessages.length,
            },
            null,
            2,
          ),
        ),
      );
      return;
    }

    if (name === 'post_agent_reply') {
      const rawReplies = args['replies'];
      const replyInputs = Array.isArray(rawReplies)
        ? rawReplies.map((reply) => {
            const replyRecord = asRecord(reply);
            return replyRecord == null ? null : parseReplyInput(replyRecord, args);
          })
        : [parseReplyInput(args, args)];

      if (replyInputs.length === 0 || replyInputs.some((reply) => reply == null)) {
        fail(id, -32602, 'Provide threadId/content or replies[] with threadId/content');
        return;
      }

      const replies: ReplyInput[] = [];
      for (const reply of replyInputs) {
        if (reply != null) {
          replies.push(reply);
        }
      }
      const threadsFile = readThreads(join(storagePath, 'threads.json'));
      markOutdatedThreads(storagePath, threadsFile);
      const msgsFile = readMessages(join(storagePath, 'messages.json'));
      const now = new Date().toISOString();
      const posted: object[] = [];

      for (const reply of replies) {
        const threadIdx = threadsFile.threads.findIndex((t) => t.id === reply.threadId);
        if (threadIdx === -1) {
          fail(id, -32602, `Thread ${reply.threadId} not found`);
          return;
        }
        const thread = threadsFile.threads[threadIdx];

        // Enforce: resolved and outdated threads are locked from agent replies.
        if (thread.status.resolved) {
          fail(
            id,
            -32602,
            `Thread ${reply.threadId} is resolved. Reopen it with set_thread_status first.`,
          );
          return;
        }
        if (thread.status.outdated) {
          fail(
            id,
            -32602,
            `Thread ${reply.threadId} is outdated because its anchor line changed. Ask the user to refresh or recreate the comment before replying.`,
          );
          return;
        }

        if (typeof reply.replyToMessageId === 'string') {
          const replyTarget = msgsFile.messages.find(
            (m) => m.id === reply.replyToMessageId && m.threadId === reply.threadId,
          );
          if (replyTarget == null) {
            fail(
              id,
              -32602,
              `Reply target ${reply.replyToMessageId} not found in thread ${reply.threadId}`,
            );
            return;
          }
        }

        const agentId = reply.agentId ?? 'agent';
        const agentName = reply.agentName ?? 'AI Agent';
        const summary = reply.summary ?? reply.content.split(/\r?\n/, 1)[0] ?? '';
        const author: Author = { type: 'ai', id: agentId, name: agentName };
        const messageId = `msg_${randomUUID()}`;
        const suggestionText =
          typeof reply.suggestionCode === 'string' && reply.suggestionCode.length > 0
            ? reply.suggestionCode
            : null;
        const hasSuggestion = suggestionText != null;

        const message: ReviewMessage = {
          id: messageId,
          threadId: reply.threadId,
          author,
          type: hasSuggestion ? 'suggestion' : 'comment',
          content: { markdown: appendReplyPrefix(reply.content, reply.replyToMessageId) },
          suggestion: hasSuggestion
            ? {
                originalCode: typeof reply.originalCode === 'string' ? reply.originalCode : '',
                suggestedCode: suggestionText,
                applied: false,
                appliedBy: null,
                appliedAt: null,
              }
            : null,
          task: null,
          reactions: {},
          metadata: { createdAt: now, updatedAt: now, editedAt: null },
        };

        msgsFile.messages.push(message);
        threadsFile.threads[threadIdx] = {
          ...thread,
          metadata: { ...thread.metadata, updatedAt: now },
        };
        posted.push({ messageId, threadId: reply.threadId, summary, type: message.type });
      }

      writeJson(join(storagePath, 'messages.json'), msgsFile);
      writeJson(join(storagePath, 'threads.json'), threadsFile);

      ok(
        id,
        textResult(
          JSON.stringify(
            Array.isArray(rawReplies)
              ? { replies: posted, requested: replies.length, posted: posted.length }
              : posted[0],
            null,
            2,
          ),
        ),
      );
      return;
    }

    if (name === 'set_thread_status') {
      const rawUpdates = args['updates'];
      const threadIdsArg = args['threadIds'];
      const statusThreadIds = asStringArray(threadIdsArg);
      const statusInputs = Array.isArray(rawUpdates)
        ? rawUpdates.map((update) => {
            const updateRecord = asRecord(update);
            return updateRecord == null ? null : parseStatusInput(updateRecord, args);
          })
        : statusThreadIds != null
          ? statusThreadIds.map((threadId) => parseStatusInput({ threadId }, args))
          : [parseStatusInput(args, args)];

      if (statusInputs.length === 0 || statusInputs.some((update) => update == null)) {
        fail(id, -32602, 'Provide threadId/status, threadIds[] with status, or updates[]');
        return;
      }

      const updates: StatusInput[] = [];
      for (const update of statusInputs) {
        if (update != null) {
          updates.push(update);
        }
      }

      const threadsFile = readThreads(join(storagePath, 'threads.json'));
      markOutdatedThreads(storagePath, threadsFile);
      const now = new Date().toISOString();
      const actor =
        typeof args['agentId'] === 'string'
          ? args['agentId']
          : typeof args['agentName'] === 'string'
            ? args['agentName']
            : 'agent';
      const changed: object[] = [];

      for (const update of updates) {
        const threadIdx = threadsFile.threads.findIndex((t) => t.id === update.threadId);
        if (threadIdx === -1) {
          fail(id, -32602, `Thread ${update.threadId} not found`);
          return;
        }

        const isResolved = update.status === 'resolved';
        threadsFile.threads[threadIdx] = {
          ...threadsFile.threads[threadIdx],
          status: isResolved
            ? {
                ...threadsFile.threads[threadIdx].status,
                resolved: true,
                resolvedBy: actor,
                resolvedAt: now,
              }
            : {
                ...threadsFile.threads[threadIdx].status,
                resolved: false,
                resolvedBy: null,
                resolvedAt: null,
              },
          metadata: { ...threadsFile.threads[threadIdx].metadata, updatedAt: now },
        };
        changed.push({
          threadId: update.threadId,
          status: update.status,
          reason: update.reason ?? null,
        });
      }

      writeJson(join(storagePath, 'threads.json'), threadsFile);

      ok(
        id,
        textResult(
          JSON.stringify(
            Array.isArray(rawUpdates) || statusThreadIds != null
              ? { updates: changed, requested: updates.length, updated: changed.length }
              : changed[0],
            null,
            2,
          ),
        ),
      );
      return;
    }

    if (name === 'set_task_message_status') {
      const { messageId, completed, agentId } = args;
      if (
        typeof messageId !== 'string' ||
        typeof completed !== 'boolean' ||
        typeof agentId !== 'string'
      ) {
        fail(id, -32602, 'messageId, completed, agentId are required');
        return;
      }
      const threadsFile = readThreads(join(storagePath, 'threads.json'));
      markOutdatedThreads(storagePath, threadsFile);
      const msgsFile = readMessages(join(storagePath, 'messages.json'));
      const located = findMessage(msgsFile, messageId);
      if (located == null) {
        fail(id, -32602, `Message ${messageId} not found`);
        return;
      }
      const thread = findThread(threadsFile, located.message.threadId);
      if (thread?.status.outdated) {
        fail(
          id,
          -32602,
          `Thread ${located.message.threadId} is outdated; task state was not changed.`,
        );
        return;
      }
      if (located.message.task == null) {
        fail(id, -32602, `Message ${messageId} is not a task message`);
        return;
      }
      const now = new Date().toISOString();
      msgsFile.messages[located.index] = {
        ...located.message,
        task: {
          ...located.message.task,
          completed,
          completedBy: completed ? agentId : null,
          completedAt: completed ? now : null,
        },
        metadata: { ...located.message.metadata, updatedAt: now },
      };
      writeJson(join(storagePath, 'messages.json'), msgsFile);

      const threadIdx = threadsFile.threads.findIndex((t) => t.id === located.message.threadId);
      if (threadIdx !== -1) {
        threadsFile.threads[threadIdx] = {
          ...threadsFile.threads[threadIdx],
          metadata: { ...threadsFile.threads[threadIdx].metadata, updatedAt: now },
        };
        writeJson(join(storagePath, 'threads.json'), threadsFile);
      }

      ok(id, textResult(JSON.stringify({ messageId, completed, by: agentId }, null, 2)));
      return;
    }

    if (name === 'add_reaction') {
      const { messageId, emoji, agentId } = args;
      if (
        typeof messageId !== 'string' ||
        typeof emoji !== 'string' ||
        typeof agentId !== 'string'
      ) {
        fail(id, -32602, 'messageId, emoji, agentId are required');
        return;
      }
      const threadsFile = readThreads(join(storagePath, 'threads.json'));
      markOutdatedThreads(storagePath, threadsFile);
      const msgsFile = readMessages(join(storagePath, 'messages.json'));
      const located = findMessage(msgsFile, messageId);
      if (located == null) {
        fail(id, -32602, `Message ${messageId} not found`);
        return;
      }
      const thread = findThread(threadsFile, located.message.threadId);
      if (thread?.status.outdated) {
        fail(id, -32602, `Thread ${located.message.threadId} is outdated; reaction was not added.`);
        return;
      }
      const reactions = { ...located.message.reactions };
      const reactors = new Set(reactions[emoji] ?? []);
      reactors.add(agentId);
      reactions[emoji] = [...reactors];
      const now = new Date().toISOString();
      msgsFile.messages[located.index] = {
        ...located.message,
        reactions,
        metadata: { ...located.message.metadata, updatedAt: now },
      };
      writeJson(join(storagePath, 'messages.json'), msgsFile);

      ok(id, textResult(JSON.stringify({ messageId, emoji, by: agentId }, null, 2)));
      return;
    }

    if (name === 'remove_reaction') {
      const { messageId, emoji, agentId } = args;
      if (
        typeof messageId !== 'string' ||
        typeof emoji !== 'string' ||
        typeof agentId !== 'string'
      ) {
        fail(id, -32602, 'messageId, emoji, agentId are required');
        return;
      }
      const threadsFile = readThreads(join(storagePath, 'threads.json'));
      markOutdatedThreads(storagePath, threadsFile);
      const msgsFile = readMessages(join(storagePath, 'messages.json'));
      const located = findMessage(msgsFile, messageId);
      if (located == null) {
        fail(id, -32602, `Message ${messageId} not found`);
        return;
      }
      const thread = findThread(threadsFile, located.message.threadId);
      if (thread?.status.outdated) {
        fail(
          id,
          -32602,
          `Thread ${located.message.threadId} is outdated; reaction was not removed.`,
        );
        return;
      }
      const reactions = { ...located.message.reactions };
      const reactors = (reactions[emoji] ?? []).filter((reactor) => reactor !== agentId);
      if (reactors.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = reactors;
      }
      const now = new Date().toISOString();
      msgsFile.messages[located.index] = {
        ...located.message,
        reactions,
        metadata: { ...located.message.metadata, updatedAt: now },
      };
      writeJson(join(storagePath, 'messages.json'), msgsFile);

      ok(id, textResult(JSON.stringify({ messageId, emoji, removedBy: agentId }, null, 2)));
      return;
    }

    fail(id, -32601, `Unknown tool: ${name}`);
  } catch (e) {
    fail(id, -32603, e instanceof Error ? e.message : 'Internal error');
  }
}

function parseToolsCallParams(
  params: unknown,
): { name: string; args: Record<string, unknown> } | null {
  if (typeof params !== 'object' || params === null) {
    return null;
  }
  if (!('name' in params) || typeof params['name'] !== 'string') {
    return null;
  }
  const name = params['name'];
  const raw = 'arguments' in params ? params['arguments'] : null;
  const args: Record<string, unknown> = {};
  if (typeof raw === 'object' && raw !== null) {
    Object.assign(args, raw);
  }
  return { name, args };
}

function dispatch(req: JsonRpcRequest): void {
  const { id, method, params } = req;

  if (method === 'initialize') {
    ok(id, {
      protocolVersion: PROTOCOL_VERSION,
      capabilities: { tools: {} },
      serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    });
    return;
  }

  if (method === 'notifications/initialized' || method === 'ping') {
    if (id != null) {
      ok(id, {});
    }
    return;
  }

  if (method === 'tools/list') {
    ok(id, { tools: TOOLS });
    return;
  }

  if (method === 'tools/call') {
    const parsed = parseToolsCallParams(params);
    if (parsed == null) {
      fail(id, -32602, 'Invalid params for tools/call');
      return;
    }
    handleCall(id, parsed.name, parsed.args);
    return;
  }

  fail(id, -32601, `Method not found: ${method}`);
}

const rl = createInterface({ input: process.stdin, terminal: false });

rl.on('line', (line) => {
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    return;
  }
  let req: JsonRpcRequest;
  try {
    req = JSON.parse(trimmed);
    return dispatch(req);
  } catch {
    send({
      jsonrpc: '2.0',
      id: null,
      error: { code: -32700, message: 'Parse error' },
    });
  }
});
