import {
  type ReviewThread,
  decodeReviewThread,
  type ReviewMessage,
  decodeReviewMessage,
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
 * @type { ThreadFile }
 * @description Root shape of the threads.json storage file
 */
export type ThreadFile = {
  /**
   * @description Storage schema version
   * @type { number }
   * @memberof ThreadFile
   */
  schemaVersion: number;
  /**
   * @description All review threads for this workspace and branch
   * @type { ReviewThread[] }
   * @memberof ThreadFile
   */
  threads: ReviewThread[];
};

export function decodeThreadFile(rawInput: unknown): ThreadFile | null {
  if (isJSON(rawInput)) {
    const decodedSchemaVersion = decodeNumber(rawInput['schemaVersion']);
    const decodedThreads = decodeArray(rawInput['threads'], decodeReviewThread);

    if (decodedSchemaVersion === null || decodedThreads === null) {
      return null;
    }

    return {
      schemaVersion: decodedSchemaVersion,
      threads: decodedThreads,
    };
  }
  return null;
}

/**
 * @type { ReviewMessageFile }
 * @description Root shape of the messages.json storage file
 */
export type ReviewMessageFile = {
  /**
   * @description Storage schema version
   * @type { number }
   * @memberof ReviewMessageFile
   */
  schemaVersion: number;
  /**
   * @description All thread messages across threads for this workspace and branch
   * @type { ReviewMessage[] }
   * @memberof ReviewMessageFile
   */
  messages: ReviewMessage[];
};

export function decodeReviewMessageFile(rawInput: unknown): ReviewMessageFile | null {
  if (isJSON(rawInput)) {
    const decodedSchemaVersion = decodeNumber(rawInput['schemaVersion']);
    const decodedMessages = decodeArray(rawInput['messages'], decodeReviewMessage);

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
