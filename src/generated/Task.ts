import {
  isJSON,
  decodeString,
  _decodeString,
  decodeNumber,
  _decodeNumber,
  decodeArray,
  _decodeArray,
} from 'type-decoder';

/**
 * @type { TaskStatus }
 * @description Lifecycle state of a task
 */
export type TaskStatus =
  | 'open'
  | 'in_progress'
  | 'resolved'
  | 'blocked'
  | 'requires_review'
  | 'orphaned'
  | 'outdated'
  | 'closed';

export function decodeTaskStatus(rawInput: unknown): TaskStatus | null {
  switch (rawInput) {
    case 'open':
    case 'in_progress':
    case 'resolved':
    case 'blocked':
    case 'requires_review':
    case 'orphaned':
    case 'outdated':
    case 'closed':
      return rawInput;
  }
  return null;
}

export function _decodeTaskStatus(rawInput: unknown): TaskStatus | undefined {
  switch (rawInput) {
    case 'open':
    case 'in_progress':
    case 'resolved':
    case 'blocked':
    case 'requires_review':
    case 'orphaned':
    case 'outdated':
    case 'closed':
      return rawInput;
  }
  return;
}

/**
 * @type { TaskScope }
 * @description What a task is attached to
 */
export type TaskScope = 'selection' | 'file' | 'repo';

export function decodeTaskScope(rawInput: unknown): TaskScope | null {
  switch (rawInput) {
    case 'selection':
    case 'file':
    case 'repo':
      return rawInput;
  }
  return null;
}

export function _decodeTaskScope(rawInput: unknown): TaskScope | undefined {
  switch (rawInput) {
    case 'selection':
    case 'file':
    case 'repo':
      return rawInput;
  }
  return;
}

/**
 * @type { AuthorType }
 * @description Origin of a message
 */
export type AuthorType = 'user' | 'ai' | 'system';

export function decodeAuthorType(rawInput: unknown): AuthorType | null {
  switch (rawInput) {
    case 'user':
    case 'ai':
    case 'system':
      return rawInput;
  }
  return null;
}

export function _decodeAuthorType(rawInput: unknown): AuthorType | undefined {
  switch (rawInput) {
    case 'user':
    case 'ai':
    case 'system':
      return rawInput;
  }
  return;
}

/**
 * @type { CodeAnchor }
 * @description Location a task is anchored to — a single line in a file
 */
export type CodeAnchor = {
  /**
   * @description Workspace-relative file path
   * @type { string }
   * @memberof CodeAnchor
   */
  filePath: string;
  /**
   * @description Zero-based line number the comment is attached to (followed as lines shift)
   * @type { number }
   * @memberof CodeAnchor
   */
  line: number;
  /**
   * @description SHA-256 hex digest (first 16 chars) of the commented line's text; mismatch marks the comment outdated
   * @type { string }
   * @memberof CodeAnchor
   */
  lineHash: string;
};

export function decodeCodeAnchor(rawInput: unknown): CodeAnchor | null {
  if (isJSON(rawInput)) {
    const decodedFilePath = decodeString(rawInput['filePath']);
    const decodedLine = decodeNumber(rawInput['line']);
    const decodedLineHash = decodeString(rawInput['lineHash']);

    if (decodedFilePath === null || decodedLine === null || decodedLineHash === null) {
      return null;
    }

    return {
      filePath: decodedFilePath,
      line: decodedLine,
      lineHash: decodedLineHash,
    };
  }
  return null;
}

/**
 * @type { TaskMessage }
 * @description A single entry in a task thread (append-only log)
 */
export type TaskMessage = {
  /**
   * @description Message identifier
   * @type { string }
   * @memberof TaskMessage
   */
  id: string;
  /**
   * @description Owning task identifier
   * @type { string }
   * @memberof TaskMessage
   */
  taskId: string;
  /**
   * @description Message being replied to (null for the root message)
   * @type { string }
   * @memberof TaskMessage
   */
  parentId: string | null;
  /**
   * @description Monotonic per-task order
   * @type { number }
   * @memberof TaskMessage
   */
  seq: number;
  /**
   * @type { AuthorType }
   * @memberof TaskMessage
   */
  authorType: AuthorType;
  /**
   * @description Display name of the author
   * @type { string }
   * @memberof TaskMessage
   */
  author: string;
  /**
   * @description Message body
   * @type { string }
   * @memberof TaskMessage
   */
  content: string;
  /**
   * @description Kind of message — comment (default) or suggestion (diff-style code change); null treated as comment
   * @type { MessageTypeEnum }
   * @memberof TaskMessage
   */
  messageType: MessageTypeEnum;
  /**
   * @description Proposed replacement code when messageType is suggestion; null for plain comments
   * @type { string }
   * @memberof TaskMessage
   */
  suggestionCode: string;
  /**
   * @description ISO timestamp
   * @type { string }
   * @memberof TaskMessage
   */
  timestamp: string;
};

export function decodeTaskMessage(rawInput: unknown): TaskMessage | null {
  if (isJSON(rawInput)) {
    const decodedId = decodeString(rawInput['id']);
    const decodedTaskId = decodeString(rawInput['taskId']);
    const decodedParentId = decodeString(rawInput['parentId']);
    const decodedSeq = decodeNumber(rawInput['seq']);
    const decodedAuthorType = decodeAuthorType(rawInput['authorType']);
    const decodedAuthor = decodeString(rawInput['author']);
    const decodedContent = decodeString(rawInput['content']);
    const decodedMessageType = decodeMessageTypeEnum(rawInput['messageType']);
    const decodedSuggestionCode = decodeString(rawInput['suggestionCode']);
    const decodedTimestamp = decodeString(rawInput['timestamp']);

    if (
      decodedId === null ||
      decodedTaskId === null ||
      decodedSeq === null ||
      decodedAuthorType === null ||
      decodedAuthor === null ||
      decodedContent === null ||
      decodedMessageType === null ||
      decodedSuggestionCode === null ||
      decodedTimestamp === null
    ) {
      return null;
    }

    return {
      id: decodedId,
      taskId: decodedTaskId,
      parentId: decodedParentId,
      seq: decodedSeq,
      authorType: decodedAuthorType,
      author: decodedAuthor,
      content: decodedContent,
      messageType: decodedMessageType,
      suggestionCode: decodedSuggestionCode,
      timestamp: decodedTimestamp,
    };
  }
  return null;
}

/**
 * @type { MessageTypeEnum }
 * @description Kind of message — comment (default) or suggestion (diff-style code change); null treated as comment
 */
export type MessageTypeEnum = 'comment' | 'suggestion';

export function decodeMessageTypeEnum(rawInput: unknown): MessageTypeEnum | null {
  switch (rawInput) {
    case 'comment':
    case 'suggestion':
      return rawInput;
  }
  return null;
}

export function _decodeMessageTypeEnum(rawInput: unknown): MessageTypeEnum | undefined {
  switch (rawInput) {
    case 'comment':
    case 'suggestion':
      return rawInput;
  }
  return;
}

/**
 * @type { TaskHistoryEvent }
 * @description A single entry in a task history log (append-only)
 */
export type TaskHistoryEvent = {
  /**
   * @description Event identifier
   * @type { string }
   * @memberof TaskHistoryEvent
   */
  id: string;
  /**
   * @description Owning task identifier
   * @type { string }
   * @memberof TaskHistoryEvent
   */
  taskId: string;
  /**
   * @description Monotonic per-task order
   * @type { number }
   * @memberof TaskHistoryEvent
   */
  seq: number;
  /**
   * @description Event type (e.g. created, status_changed)
   * @type { string }
   * @memberof TaskHistoryEvent
   */
  type: string;
  /**
   * @description Who caused the event
   * @type { string }
   * @memberof TaskHistoryEvent
   */
  actor: string;
  /**
   * @description ISO timestamp
   * @type { string }
   * @memberof TaskHistoryEvent
   */
  timestamp: string;
};

export function decodeTaskHistoryEvent(rawInput: unknown): TaskHistoryEvent | null {
  if (isJSON(rawInput)) {
    const decodedId = decodeString(rawInput['id']);
    const decodedTaskId = decodeString(rawInput['taskId']);
    const decodedSeq = decodeNumber(rawInput['seq']);
    const decodedType = decodeString(rawInput['type']);
    const decodedActor = decodeString(rawInput['actor']);
    const decodedTimestamp = decodeString(rawInput['timestamp']);

    if (
      decodedId === null ||
      decodedTaskId === null ||
      decodedSeq === null ||
      decodedType === null ||
      decodedActor === null ||
      decodedTimestamp === null
    ) {
      return null;
    }

    return {
      id: decodedId,
      taskId: decodedTaskId,
      seq: decodedSeq,
      type: decodedType,
      actor: decodedActor,
      timestamp: decodedTimestamp,
    };
  }
  return null;
}

/**
 * @type { AgentExecution }
 * @description Metadata from an AI agent execution linked to a thread message
 */
export type AgentExecution = {
  /**
   * @description Unique execution identifier
   * @type { string }
   * @memberof AgentExecution
   */
  id: string;
  /**
   * @description Message this execution is linked to
   * @type { string }
   * @memberof AgentExecution
   */
  messageId: string;
  /**
   * @description Task this execution is linked to
   * @type { string }
   * @memberof AgentExecution
   */
  taskId: string;
  /**
   * @description Machine identifier for the agent (e.g. claude-code)
   * @type { string }
   * @memberof AgentExecution
   */
  agentId: string;
  /**
   * @description Human-readable agent name
   * @type { string }
   * @memberof AgentExecution
   */
  agentName: string;
  /**
   * @description ISO timestamp of execution
   * @type { string }
   * @memberof AgentExecution
   */
  timestamp: string;
  /**
   * @description One-sentence summary of what the agent did
   * @type { string }
   * @memberof AgentExecution
   */
  summary: string;
  /**
   * @description Why the agent performed this action
   * @type { string }
   * @memberof AgentExecution
   */
  reason: string | null;
  /**
   * @description Workspace-relative paths of files the agent changed
   * @type { string[] }
   * @memberof AgentExecution
   */
  filesChanged: string[] | null;
};

export function decodeAgentExecution(rawInput: unknown): AgentExecution | null {
  if (isJSON(rawInput)) {
    const decodedId = decodeString(rawInput['id']);
    const decodedMessageId = decodeString(rawInput['messageId']);
    const decodedTaskId = decodeString(rawInput['taskId']);
    const decodedAgentId = decodeString(rawInput['agentId']);
    const decodedAgentName = decodeString(rawInput['agentName']);
    const decodedTimestamp = decodeString(rawInput['timestamp']);
    const decodedSummary = decodeString(rawInput['summary']);
    const decodedReason = decodeString(rawInput['reason']);
    const decodedFilesChanged = decodeArray(rawInput['filesChanged'], decodeString);

    if (
      decodedId === null ||
      decodedMessageId === null ||
      decodedTaskId === null ||
      decodedAgentId === null ||
      decodedAgentName === null ||
      decodedTimestamp === null ||
      decodedSummary === null
    ) {
      return null;
    }

    return {
      id: decodedId,
      messageId: decodedMessageId,
      taskId: decodedTaskId,
      agentId: decodedAgentId,
      agentName: decodedAgentName,
      timestamp: decodedTimestamp,
      summary: decodedSummary,
      reason: decodedReason,
      filesChanged: decodedFilesChanged,
    };
  }
  return null;
}

/**
 * @type { Task }
 * @description A code-anchored task (lightweight record; thread/history stored separately)
 */
export type Task = {
  /**
   * @description Task identifier
   * @type { string }
   * @memberof Task
   */
  id: string;
  /**
   * @description Schema version for forward migration
   * @type { number }
   * @memberof Task
   */
  schemaVersion: number;
  /**
   * @description Short task title
   * @type { string }
   * @memberof Task
   */
  title: string;
  /**
   * @description Task description
   * @type { string }
   * @memberof Task
   */
  description: string;
  /**
   * @type { TaskScope }
   * @memberof Task
   */
  scope: TaskScope;
  /**
   * @type { TaskStatus }
   * @memberof Task
   */
  status: TaskStatus;
  /**
   * @description Who created the task
   * @type { string }
   * @memberof Task
   */
  createdBy: string;
  /**
   * @description ISO creation timestamp
   * @type { string }
   * @memberof Task
   */
  createdAt: string;
  /**
   * @description ISO last-update timestamp
   * @type { string }
   * @memberof Task
   */
  updatedAt: string;
  /**
   * @type { CodeAnchor }
   * @memberof Task
   */
  anchor: CodeAnchor;
  /**
   * @description Freeform labels
   * @type { string[] }
   * @memberof Task
   */
  labels: string[];
  /**
   * @description First message id in the thread
   * @type { string }
   * @memberof Task
   */
  threadHead: string;
  /**
   * @description Newest message id in the thread
   * @type { string }
   * @memberof Task
   */
  threadTail: string;
  /**
   * @description Number of messages in the thread
   * @type { number }
   * @memberof Task
   */
  messageCount: number;
};

export function decodeTask(rawInput: unknown): Task | null {
  if (isJSON(rawInput)) {
    const decodedId = decodeString(rawInput['id']);
    const decodedSchemaVersion = decodeNumber(rawInput['schemaVersion']);
    const decodedTitle = decodeString(rawInput['title']);
    const decodedDescription = decodeString(rawInput['description']);
    const decodedScope = decodeTaskScope(rawInput['scope']);
    const decodedStatus = decodeTaskStatus(rawInput['status']);
    const decodedCreatedBy = decodeString(rawInput['createdBy']);
    const decodedCreatedAt = decodeString(rawInput['createdAt']);
    const decodedUpdatedAt = decodeString(rawInput['updatedAt']);
    const decodedAnchor = decodeCodeAnchor(rawInput['anchor']);
    const decodedLabels = decodeArray(rawInput['labels'], decodeString);
    const decodedThreadHead = decodeString(rawInput['threadHead']);
    const decodedThreadTail = decodeString(rawInput['threadTail']);
    const decodedMessageCount = decodeNumber(rawInput['messageCount']);

    if (
      decodedId === null ||
      decodedSchemaVersion === null ||
      decodedTitle === null ||
      decodedDescription === null ||
      decodedScope === null ||
      decodedStatus === null ||
      decodedCreatedBy === null ||
      decodedCreatedAt === null ||
      decodedUpdatedAt === null ||
      decodedAnchor === null ||
      decodedLabels === null ||
      decodedThreadHead === null ||
      decodedThreadTail === null ||
      decodedMessageCount === null
    ) {
      return null;
    }

    return {
      id: decodedId,
      schemaVersion: decodedSchemaVersion,
      title: decodedTitle,
      description: decodedDescription,
      scope: decodedScope,
      status: decodedStatus,
      createdBy: decodedCreatedBy,
      createdAt: decodedCreatedAt,
      updatedAt: decodedUpdatedAt,
      anchor: decodedAnchor,
      labels: decodedLabels,
      threadHead: decodedThreadHead,
      threadTail: decodedThreadTail,
      messageCount: decodedMessageCount,
    };
  }
  return null;
}
