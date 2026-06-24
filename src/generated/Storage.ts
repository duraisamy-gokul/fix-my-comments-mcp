import {
  type Task,
  decodeTask,
  type TaskMessage,
  decodeTaskMessage,
  type TaskHistoryEvent,
  decodeTaskHistoryEvent,
  type AgentExecution,
  decodeAgentExecution,
} from './Task';
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
 * @type { WorkspaceIdentity }
 * @description Workspace identity derived from repo root and Git branch
 */
export type WorkspaceIdentity = {
  /**
   * @description Absolute path to the repository root
   * @type { string }
   * @memberof WorkspaceIdentity
   */
  repoRoot: string;
  /**
   * @description Current Git branch name
   * @type { string }
   * @memberof WorkspaceIdentity
   */
  branch: string;
  /**
   * @description Absolute path under ~/.fixmycomments where this repo+branch's data lives. Shared verbatim with the fix-my-comments-mcp server.

   * @type { string }
   * @memberof WorkspaceIdentity
  */
  storagePath: string;
};

export function decodeWorkspaceIdentity(rawInput: unknown): WorkspaceIdentity | null {
  if (isJSON(rawInput)) {
    const decodedRepoRoot = decodeString(rawInput['repoRoot']);
    const decodedBranch = decodeString(rawInput['branch']);
    const decodedStoragePath = decodeString(rawInput['storagePath']);

    if (decodedRepoRoot === null || decodedBranch === null || decodedStoragePath === null) {
      return null;
    }

    return {
      repoRoot: decodedRepoRoot,
      branch: decodedBranch,
      storagePath: decodedStoragePath,
    };
  }
  return null;
}

/**
 * @type { TaskFile }
 * @description Root shape of the tasks.json storage file
 */
export type TaskFile = {
  /**
   * @description Storage schema version
   * @type { number }
   * @memberof TaskFile
   */
  schemaVersion: number;
  /**
   * @description All tasks for this workspace and branch
   * @type { Task[] }
   * @memberof TaskFile
   */
  tasks: Task[];
};

export function decodeTaskFile(rawInput: unknown): TaskFile | null {
  if (isJSON(rawInput)) {
    const decodedSchemaVersion = decodeNumber(rawInput['schemaVersion']);
    const decodedTasks = decodeArray(rawInput['tasks'], decodeTask);

    if (decodedSchemaVersion === null || decodedTasks === null) {
      return null;
    }

    return {
      schemaVersion: decodedSchemaVersion,
      tasks: decodedTasks,
    };
  }
  return null;
}

/**
 * @type { MessageFile }
 * @description Root shape of the messages.json storage file
 */
export type MessageFile = {
  /**
   * @description Storage schema version
   * @type { number }
   * @memberof MessageFile
   */
  schemaVersion: number;
  /**
   * @description All thread messages across tasks for this workspace and branch
   * @type { TaskMessage[] }
   * @memberof MessageFile
   */
  messages: TaskMessage[];
};

export function decodeMessageFile(rawInput: unknown): MessageFile | null {
  if (isJSON(rawInput)) {
    const decodedSchemaVersion = decodeNumber(rawInput['schemaVersion']);
    const decodedMessages = decodeArray(rawInput['messages'], decodeTaskMessage);

    if (decodedSchemaVersion === null || decodedMessages === null) {
      return null;
    }

    return {
      schemaVersion: decodedSchemaVersion,
      messages: decodedMessages,
    };
  }
  return null;
}

/**
 * @type { HistoryFile }
 * @description Root shape of the history.json storage file
 */
export type HistoryFile = {
  /**
   * @description Storage schema version
   * @type { number }
   * @memberof HistoryFile
   */
  schemaVersion: number;
  /**
   * @description All history events across tasks for this workspace and branch
   * @type { TaskHistoryEvent[] }
   * @memberof HistoryFile
   */
  events: TaskHistoryEvent[];
};

export function decodeHistoryFile(rawInput: unknown): HistoryFile | null {
  if (isJSON(rawInput)) {
    const decodedSchemaVersion = decodeNumber(rawInput['schemaVersion']);
    const decodedEvents = decodeArray(rawInput['events'], decodeTaskHistoryEvent);

    if (decodedSchemaVersion === null || decodedEvents === null) {
      return null;
    }

    return {
      schemaVersion: decodedSchemaVersion,
      events: decodedEvents,
    };
  }
  return null;
}

/**
 * @type { ExecutionFile }
 * @description Root shape of the executions.json storage file
 */
export type ExecutionFile = {
  /**
   * @description Storage schema version
   * @type { number }
   * @memberof ExecutionFile
   */
  schemaVersion: number;
  /**
   * @description All agent execution records for this workspace and branch
   * @type { AgentExecution[] }
   * @memberof ExecutionFile
   */
  executions: AgentExecution[];
};

export function decodeExecutionFile(rawInput: unknown): ExecutionFile | null {
  if (isJSON(rawInput)) {
    const decodedSchemaVersion = decodeNumber(rawInput['schemaVersion']);
    const decodedExecutions = decodeArray(rawInput['executions'], decodeAgentExecution);

    if (decodedSchemaVersion === null || decodedExecutions === null) {
      return null;
    }

    return {
      schemaVersion: decodedSchemaVersion,
      executions: decodedExecutions,
    };
  }
  return null;
}
