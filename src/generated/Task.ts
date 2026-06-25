import {
  isJSON,
  decodeBoolean,
  _decodeBoolean,
  decodeString,
  _decodeString,
  decodeNumber,
  _decodeNumber,
  decodeArray,
  _decodeArray,
} from 'type-decoder';

/**
 * @type { AnchorType }
 * @description Where a thread is anchored — a single line or the whole file
 */
export type AnchorType = 'line' | 'file';

export function decodeAnchorType(rawInput: unknown): AnchorType | null {
  switch (rawInput) {
    case 'line':
    case 'file':
      return rawInput;
  }
  return null;
}

export function _decodeAnchorType(rawInput: unknown): AnchorType | undefined {
  switch (rawInput) {
    case 'line':
    case 'file':
      return rawInput;
  }
  return;
}

/**
 * @type { AuthorType }
 * @description Origin of a message author
 */
export type AuthorType = 'user' | 'ai';

export function decodeAuthorType(rawInput: unknown): AuthorType | null {
  switch (rawInput) {
    case 'user':
    case 'ai':
      return rawInput;
  }
  return null;
}

export function _decodeAuthorType(rawInput: unknown): AuthorType | undefined {
  switch (rawInput) {
    case 'user':
    case 'ai':
      return rawInput;
  }
  return;
}

/**
 * @type { MessageType }
 * @description Kind of message in a thread — comment, task (checkbox), or suggestion (diff-style code change)
 */
export type MessageType = 'comment' | 'task' | 'suggestion';

export function decodeMessageType(rawInput: unknown): MessageType | null {
  switch (rawInput) {
    case 'comment':
    case 'task':
    case 'suggestion':
      return rawInput;
  }
  return null;
}

export function _decodeMessageType(rawInput: unknown): MessageType | undefined {
  switch (rawInput) {
    case 'comment':
    case 'task':
    case 'suggestion':
      return rawInput;
  }
  return;
}

/**
 * @type { ThreadStatus }
 * @description Lifecycle flags for a thread — resolved and outdated are independent
 */
export type ThreadStatus = {
  /**
   * @description Whether the thread has been marked resolved (checkbox)
   * @type { boolean }
   * @memberof ThreadStatus
   */
  resolved: boolean;
  /**
   * @description Whether the anchored line's content has drifted (hash mismatch)
   * @type { boolean }
   * @memberof ThreadStatus
   */
  outdated: boolean;
  /**
   * @description Who resolved the thread (user or agent id/name)
   * @type { string }
   * @memberof ThreadStatus
   */
  resolvedBy: string | null;
  /**
   * @description ISO timestamp the thread was resolved
   * @type { string }
   * @memberof ThreadStatus
   */
  resolvedAt: string | null;
};

export function decodeThreadStatus(rawInput: unknown): ThreadStatus | null {
  if (isJSON(rawInput)) {
    const decodedResolved = decodeBoolean(rawInput['resolved']);
    const decodedOutdated = decodeBoolean(rawInput['outdated']);
    const decodedResolvedBy = decodeString(rawInput['resolvedBy']);
    const decodedResolvedAt = decodeString(rawInput['resolvedAt']);

    if (decodedResolved === null || decodedOutdated === null) {
      return null;
    }

    return {
      resolved: decodedResolved,
      outdated: decodedOutdated,
      resolvedBy: decodedResolvedBy,
      resolvedAt: decodedResolvedAt,
    };
  }
  return null;
}

/**
 * @type { ThreadMetadata }
 * @description Timestamps for a thread
 */
export type ThreadMetadata = {
  /**
   * @description ISO creation timestamp
   * @type { string }
   * @memberof ThreadMetadata
   */
  createdAt: string;
  /**
   * @description ISO last-update timestamp
   * @type { string }
   * @memberof ThreadMetadata
   */
  updatedAt: string;
};

export function decodeThreadMetadata(rawInput: unknown): ThreadMetadata | null {
  if (isJSON(rawInput)) {
    const decodedCreatedAt = decodeString(rawInput['createdAt']);
    const decodedUpdatedAt = decodeString(rawInput['updatedAt']);

    if (decodedCreatedAt === null || decodedUpdatedAt === null) {
      return null;
    }

    return {
      createdAt: decodedCreatedAt,
      updatedAt: decodedUpdatedAt,
    };
  }
  return null;
}

/**
 * @type { ThreadAnchor }
 * @description Location a thread is anchored to — a single line or a whole file
 */
export type ThreadAnchor = {
  /**
   * @type { AnchorType }
   * @memberof ThreadAnchor
   */
  type: AnchorType;
  /**
   * @description Workspace-relative file path
   * @type { string }
   * @memberof ThreadAnchor
   */
  filePath: string;
  /**
   * @description Zero-based line number the thread is attached to (followed as lines shift); null for file-level threads
   * @type { number }
   * @memberof ThreadAnchor
   */
  line: number | null;
  /**
   * @description SHA-256 hex digest (first 16 chars) of the anchored line's text; mismatch marks the thread outdated
   * @type { string }
   * @memberof ThreadAnchor
   */
  lineHash: string;
  /**
   * @description The anchored line's text at creation time, for display when the line has drifted
   * @type { string }
   * @memberof ThreadAnchor
   */
  snippet: string | null;
};

export function decodeThreadAnchor(rawInput: unknown): ThreadAnchor | null {
  if (isJSON(rawInput)) {
    const decodedType = decodeAnchorType(rawInput['type']);
    const decodedFilePath = decodeString(rawInput['filePath']);
    const decodedLine = decodeNumber(rawInput['line']);
    const decodedLineHash = decodeString(rawInput['lineHash']);
    const decodedSnippet = decodeString(rawInput['snippet']);

    if (decodedType === null || decodedFilePath === null || decodedLineHash === null) {
      return null;
    }

    return {
      type: decodedType,
      filePath: decodedFilePath,
      line: decodedLine,
      lineHash: decodedLineHash,
      snippet: decodedSnippet,
    };
  }
  return null;
}

/**
 * @type { Author }
 * @description Author of a message — a user or an AI agent
 */
export type Author = {
  /**
   * @type { AuthorType }
   * @memberof Author
   */
  type: AuthorType;
  /**
   * @description Stable identifier for the author (e.g. user id, or agent machine id like claude-code)
   * @type { string }
   * @memberof Author
   */
  id: string;
  /**
   * @description Human-readable display name
   * @type { string }
   * @memberof Author
   */
  name: string;
};

export function decodeAuthor(rawInput: unknown): Author | null {
  if (isJSON(rawInput)) {
    const decodedType = decodeAuthorType(rawInput['type']);
    const decodedId = decodeString(rawInput['id']);
    const decodedName = decodeString(rawInput['name']);

    if (decodedType === null || decodedId === null || decodedName === null) {
      return null;
    }

    return {
      type: decodedType,
      id: decodedId,
      name: decodedName,
    };
  }
  return null;
}

/**
 * @type { MessageContent }
 * @description The markdown body of a message
 */
export type MessageContent = {
  /**
   * @description Raw markdown content (links, inline code, formatting)
   * @type { string }
   * @memberof MessageContent
   */
  markdown: string;
};

export function decodeMessageContent(rawInput: unknown): MessageContent | null {
  if (isJSON(rawInput)) {
    const decodedMarkdown = decodeString(rawInput['markdown']);

    if (decodedMarkdown === null) {
      return null;
    }

    return {
      markdown: decodedMarkdown,
    };
  }
  return null;
}

/**
 * @type { Suggestion }
 * @description A diff-style code suggestion attached to a message
 */
export type Suggestion = {
  /**
   * @description The code the suggestion replaces
   * @type { string }
   * @memberof Suggestion
   */
  originalCode: string;
  /**
   * @description The proposed replacement code
   * @type { string }
   * @memberof Suggestion
   */
  suggestedCode: string;
  /**
   * @description Whether the suggestion has been applied to the file
   * @type { boolean }
   * @memberof Suggestion
   */
  applied: boolean;
  /**
   * @description Who applied the suggestion
   * @type { string }
   * @memberof Suggestion
   */
  appliedBy: string | null;
  /**
   * @description ISO timestamp the suggestion was applied
   * @type { string }
   * @memberof Suggestion
   */
  appliedAt: string | null;
};

export function decodeSuggestion(rawInput: unknown): Suggestion | null {
  if (isJSON(rawInput)) {
    const decodedOriginalCode = decodeString(rawInput['originalCode']);
    const decodedSuggestedCode = decodeString(rawInput['suggestedCode']);
    const decodedApplied = decodeBoolean(rawInput['applied']);
    const decodedAppliedBy = decodeString(rawInput['appliedBy']);
    const decodedAppliedAt = decodeString(rawInput['appliedAt']);

    if (decodedOriginalCode === null || decodedSuggestedCode === null || decodedApplied === null) {
      return null;
    }

    return {
      originalCode: decodedOriginalCode,
      suggestedCode: decodedSuggestedCode,
      applied: decodedApplied,
      appliedBy: decodedAppliedBy,
      appliedAt: decodedAppliedAt,
    };
  }
  return null;
}

/**
 * @type { TaskState }
 * @description Checkbox state for a task message
 */
export type TaskState = {
  /**
   * @description Whether the task is checked off
   * @type { boolean }
   * @memberof TaskState
   */
  completed: boolean;
  /**
   * @description Who completed the task
   * @type { string }
   * @memberof TaskState
   */
  completedBy: string | null;
  /**
   * @description ISO timestamp the task was completed
   * @type { string }
   * @memberof TaskState
   */
  completedAt: string | null;
};

export function decodeTaskState(rawInput: unknown): TaskState | null {
  if (isJSON(rawInput)) {
    const decodedCompleted = decodeBoolean(rawInput['completed']);
    const decodedCompletedBy = decodeString(rawInput['completedBy']);
    const decodedCompletedAt = decodeString(rawInput['completedAt']);

    if (decodedCompleted === null) {
      return null;
    }

    return {
      completed: decodedCompleted,
      completedBy: decodedCompletedBy,
      completedAt: decodedCompletedAt,
    };
  }
  return null;
}

/**
 * @type { Reactions }
 * @description Emoji -> list of author ids who reacted
 */
export type Reactions = Record<string, string[]>;

export function decodeReactions(rawInput: unknown): Reactions | null {
  if (isJSON(rawInput)) {
    const decodedAdditionalProperties: Reactions = {};
    for (const key in rawInput) {
      const decodedValue = decodeArray(rawInput[key], decodeString);
      if (decodedValue === null) {
        return null;
      }
      decodedAdditionalProperties[key] = decodedValue;
    }
    return decodedAdditionalProperties;
  }
  return null;
}

/**
 * @type { MessageMetadata }
 * @description Timestamps for a message
 */
export type MessageMetadata = {
  /**
   * @description ISO creation timestamp
   * @type { string }
   * @memberof MessageMetadata
   */
  createdAt: string;
  /**
   * @description ISO last-update timestamp
   * @type { string }
   * @memberof MessageMetadata
   */
  updatedAt: string;
  /**
   * @description ISO timestamp of the last edit, if edited
   * @type { string }
   * @memberof MessageMetadata
   */
  editedAt: string | null;
};

export function decodeMessageMetadata(rawInput: unknown): MessageMetadata | null {
  if (isJSON(rawInput)) {
    const decodedCreatedAt = decodeString(rawInput['createdAt']);
    const decodedUpdatedAt = decodeString(rawInput['updatedAt']);
    const decodedEditedAt = decodeString(rawInput['editedAt']);

    if (decodedCreatedAt === null || decodedUpdatedAt === null) {
      return null;
    }

    return {
      createdAt: decodedCreatedAt,
      updatedAt: decodedUpdatedAt,
      editedAt: decodedEditedAt,
    };
  }
  return null;
}

/**
 * @type { ReviewThread }
 * @description A code-anchored review thread (Bitbucket-style); owns its anchor and resolve/outdated state
 */
export type ReviewThread = {
  /**
   * @description Thread identifier
   * @type { string }
   * @memberof ReviewThread
   */
  id: string;
  /**
   * @type { ThreadAnchor }
   * @memberof ReviewThread
   */
  anchor: ThreadAnchor;
  /**
   * @type { ThreadStatus }
   * @memberof ReviewThread
   */
  status: ThreadStatus;
  /**
   * @type { ThreadMetadata }
   * @memberof ReviewThread
   */
  metadata: ThreadMetadata;
};

export function decodeReviewThread(rawInput: unknown): ReviewThread | null {
  if (isJSON(rawInput)) {
    const decodedId = decodeString(rawInput['id']);
    const decodedAnchor = decodeThreadAnchor(rawInput['anchor']);
    const decodedStatus = decodeThreadStatus(rawInput['status']);
    const decodedMetadata = decodeThreadMetadata(rawInput['metadata']);

    if (
      decodedId === null ||
      decodedAnchor === null ||
      decodedStatus === null ||
      decodedMetadata === null
    ) {
      return null;
    }

    return {
      id: decodedId,
      anchor: decodedAnchor,
      status: decodedStatus,
      metadata: decodedMetadata,
    };
  }
  return null;
}

/**
 * @type { ReviewMessage }
 * @description A single flat message in a review thread (append-only log; no nested replies)
 */
export type ReviewMessage = {
  /**
   * @description Message identifier
   * @type { string }
   * @memberof ReviewMessage
   */
  id: string;
  /**
   * @description Owning thread identifier
   * @type { string }
   * @memberof ReviewMessage
   */
  threadId: string;
  /**
   * @type { Author }
   * @memberof ReviewMessage
   */
  author: Author;
  /**
   * @type { MessageType }
   * @memberof ReviewMessage
   */
  type: MessageType;
  /**
   * @type { MessageContent }
   * @memberof ReviewMessage
   */
  content: MessageContent;
  /**
   * @description Present when type is suggestion
   * @type { Suggestion }
   * @memberof ReviewMessage
   */
  suggestion: Suggestion | null;
  /**
   * @description Present when type is task
   * @type { TaskState }
   * @memberof ReviewMessage
   */
  task: TaskState | null;
  /**
   * @type { Reactions }
   * @memberof ReviewMessage
   */
  reactions: Reactions;
  /**
   * @type { MessageMetadata }
   * @memberof ReviewMessage
   */
  metadata: MessageMetadata;
};

export function decodeReviewMessage(rawInput: unknown): ReviewMessage | null {
  if (isJSON(rawInput)) {
    const decodedId = decodeString(rawInput['id']);
    const decodedThreadId = decodeString(rawInput['threadId']);
    const decodedAuthor = decodeAuthor(rawInput['author']);
    const decodedType = decodeMessageType(rawInput['type']);
    const decodedContent = decodeMessageContent(rawInput['content']);
    const decodedSuggestion = decodeSuggestion(rawInput['suggestion']);
    const decodedTask = decodeTaskState(rawInput['task']);
    const decodedReactions = decodeReactions(rawInput['reactions']);
    const decodedMetadata = decodeMessageMetadata(rawInput['metadata']);

    if (
      decodedId === null ||
      decodedThreadId === null ||
      decodedAuthor === null ||
      decodedType === null ||
      decodedContent === null ||
      decodedReactions === null ||
      decodedMetadata === null
    ) {
      return null;
    }

    return {
      id: decodedId,
      threadId: decodedThreadId,
      author: decodedAuthor,
      type: decodedType,
      content: decodedContent,
      suggestion: decodedSuggestion,
      task: decodedTask,
      reactions: decodedReactions,
      metadata: decodedMetadata,
    };
  }
  return null;
}
