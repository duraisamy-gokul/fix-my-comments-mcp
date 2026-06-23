import { createInterface } from 'node:readline';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'fix-my-comments';
const SERVER_VERSION = '1.0.0';

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

type Task = {
  id: string;
  title: string;
  description: string;
  status: string;
  anchor: { filePath: string; startLine: number; endLine: number };
  threadHead: string;
  threadTail: string;
  messageCount: number;
  updatedAt: string;
};

type Message = {
  id: string;
  taskId: string;
  parentId: string | null;
  seq: number;
  authorType: string;
  author: string;
  content: string;
  timestamp: string;
};

type HistoryEvent = {
  id: string;
  taskId: string;
  seq: number;
  type: string;
  actor: string;
  timestamp: string;
};

type AgentExecution = {
  id: string;
  messageId: string;
  taskId: string;
  agentId: string;
  agentName: string;
  timestamp: string;
  summary: string;
  reason: string | null;
  filesChanged: string[] | null;
};

type TasksFile = { tasks: Task[] };
type MessagesFile = { messages: Message[] };
type HistoryFile = { schemaVersion: number; events: HistoryEvent[] };
type ExecutionsFile = { schemaVersion: number; executions: AgentExecution[] };

function send(msg: JsonRpcResponse): void {
  process.stdout.write(JSON.stringify(msg) + '\n');
}

function ok(id: string | number | null, result: unknown): void {
  send({ jsonrpc: '2.0', id, result });
}

function fail(id: string | number | null, code: number, message: string): void {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

function textResult(text: string): { content: { type: 'text'; text: string }[] } {
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

function getStoragePath(): string {
  const repoRoot = process.cwd();
  const branch = readBranch(repoRoot);
  return join(repoRoot, '.fixmycomments', branch);
}

function readJson<T>(filePath: string, empty: T): T {
  try {
    const parsed: T = JSON.parse(readFileSync(filePath, 'utf8'));
    return parsed;
  } catch {
    return empty;
  }
}

function writeJson(filePath: string, data: unknown): void {
  mkdirSync(join(filePath, '..'), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

const TOOLS = [
  {
    name: 'list_open_tasks',
    description:
      'List all open Fix My Comments tasks for the current workspace and branch. Optionally filter by file path.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Workspace-relative file path to filter by (optional).',
        },
      },
    },
  },
  {
    name: 'get_task_thread',
    description: 'Get a task and its full message thread in chronological order.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'The task id.' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'post_agent_reply',
    description: 'Append a reply to a task thread as an AI agent and record execution metadata.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task id to reply to.' },
        content: { type: 'string', description: 'Reply message body.' },
        agentId: {
          type: 'string',
          description: 'Machine identifier for this agent (e.g. claude-code).',
        },
        agentName: { type: 'string', description: 'Human-readable agent name.' },
        summary: { type: 'string', description: 'One-sentence summary of what was done.' },
        reason: { type: 'string', description: 'Why this action was taken.' },
        filesChanged: {
          type: 'array',
          items: { type: 'string' },
          description: 'Workspace-relative paths of files the agent changed.',
        },
      },
      required: ['taskId', 'content', 'agentId', 'agentName', 'summary'],
    },
  },
  {
    name: 'set_task_status',
    description: 'Set a task status. Agents may set resolved or requires_review.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task id.' },
        status: {
          type: 'string',
          enum: ['resolved', 'requires_review'],
          description: 'New status.',
        },
        reason: { type: 'string', description: 'Why the status is being changed.' },
      },
      required: ['taskId', 'status'],
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
    if (name === 'list_open_tasks') {
      const file = readJson<TasksFile>(join(storagePath, 'tasks.json'), { tasks: [] });
      let tasks = file.tasks.filter((t) => t.status === 'open');
      if (typeof args['filePath'] === 'string') {
        tasks = tasks.filter((t) => t.anchor.filePath === args['filePath']);
      }
      ok(
        id,
        textResult(
          JSON.stringify(
            tasks.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              filePath: t.anchor.filePath,
              startLine: t.anchor.startLine,
              endLine: t.anchor.endLine,
              messageCount: t.messageCount,
              updatedAt: t.updatedAt,
            })),
            null,
            2,
          ),
        ),
      );
      return;
    }

    if (name === 'get_task_thread') {
      const taskId = args['taskId'];
      if (typeof taskId !== 'string') {
        fail(id, -32602, 'taskId is required');
        return;
      }
      const tasksFile = readJson<TasksFile>(join(storagePath, 'tasks.json'), { tasks: [] });
      const task = tasksFile.tasks.find((t) => t.id === taskId);
      if (task == null) {
        fail(id, -32602, `Task ${taskId} not found`);
        return;
      }
      const msgsFile = readJson<MessagesFile>(join(storagePath, 'messages.json'), {
        messages: [],
      });
      const messages = msgsFile.messages
        .filter((m) => m.taskId === taskId)
        .sort((a, b) => a.seq - b.seq);
      ok(id, textResult(JSON.stringify({ task, messages }, null, 2)));
      return;
    }

    if (name === 'post_agent_reply') {
      const { taskId, content, agentId, agentName, summary, reason, filesChanged } = args;
      if (
        typeof taskId !== 'string' ||
        typeof content !== 'string' ||
        typeof agentId !== 'string' ||
        typeof agentName !== 'string' ||
        typeof summary !== 'string'
      ) {
        fail(id, -32602, 'taskId, content, agentId, agentName, summary are required');
        return;
      }

      const tasksFile = readJson<TasksFile>(join(storagePath, 'tasks.json'), { tasks: [] });
      const taskIdx = tasksFile.tasks.findIndex((t) => t.id === taskId);
      if (taskIdx === -1) {
        fail(id, -32602, `Task ${taskId} not found`);
        return;
      }
      const task = tasksFile.tasks[taskIdx];

      const msgsFile = readJson<MessagesFile>(join(storagePath, 'messages.json'), {
        messages: [],
      });
      const taskMessages = msgsFile.messages.filter((m) => m.taskId === taskId);
      const seq = taskMessages.reduce((max, m) => Math.max(max, m.seq), 0) + 1;
      const parentId = task.threadTail.length > 0 ? task.threadTail : null;
      const now = new Date().toISOString();
      const messageId = `msg_${randomUUID()}`;

      const message: Message = {
        id: messageId,
        taskId,
        parentId,
        seq,
        authorType: 'ai',
        author: agentName,
        content,
        timestamp: now,
      };

      msgsFile.messages.push(message);
      writeJson(join(storagePath, 'messages.json'), msgsFile);

      tasksFile.tasks[taskIdx] = {
        ...task,
        threadTail: messageId,
        messageCount: task.messageCount + 1,
        updatedAt: now,
      };
      writeJson(join(storagePath, 'tasks.json'), tasksFile);

      const execution: AgentExecution = {
        id: `exec_${randomUUID()}`,
        messageId,
        taskId,
        agentId,
        agentName,
        timestamp: now,
        summary,
        reason: typeof reason === 'string' ? reason : null,
        filesChanged: Array.isArray(filesChanged) ? filesChanged.map(String) : null,
      };

      const execFile = readJson<ExecutionsFile>(join(storagePath, 'executions.json'), {
        schemaVersion: 1,
        executions: [],
      });
      execFile.executions.push(execution);
      writeJson(join(storagePath, 'executions.json'), execFile);

      ok(id, textResult(JSON.stringify({ messageId, executionId: execution.id }, null, 2)));
      return;
    }

    if (name === 'set_task_status') {
      const taskId = args['taskId'];
      const status = args['status'];
      if (typeof taskId !== 'string' || typeof status !== 'string') {
        fail(id, -32602, 'taskId and status are required');
        return;
      }
      if (status !== 'resolved' && status !== 'requires_review') {
        fail(id, -32602, 'Agents may only set resolved or requires_review');
        return;
      }

      const tasksFile = readJson<TasksFile>(join(storagePath, 'tasks.json'), { tasks: [] });
      const taskIdx = tasksFile.tasks.findIndex((t) => t.id === taskId);
      if (taskIdx === -1) {
        fail(id, -32602, `Task ${taskId} not found`);
        return;
      }

      const now = new Date().toISOString();
      tasksFile.tasks[taskIdx] = { ...tasksFile.tasks[taskIdx], status, updatedAt: now };
      writeJson(join(storagePath, 'tasks.json'), tasksFile);

      const histFile = readJson<HistoryFile>(join(storagePath, 'history.json'), {
        schemaVersion: 1,
        events: [],
      });
      const taskEvents = histFile.events.filter((e) => e.taskId === taskId);
      const seq = taskEvents.reduce((max, e) => Math.max(max, e.seq), 0) + 1;
      const actor =
        typeof args['agentId'] === 'string'
          ? args['agentId']
          : typeof args['agentName'] === 'string'
            ? args['agentName']
            : 'agent';
      histFile.events.push({
        id: `evt_${randomUUID()}`,
        taskId,
        seq,
        type: `status_${status}`,
        actor,
        timestamp: now,
      });
      writeJson(join(storagePath, 'history.json'), histFile);

      ok(id, textResult(JSON.stringify({ taskId, status }, null, 2)));
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
    send({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
});
