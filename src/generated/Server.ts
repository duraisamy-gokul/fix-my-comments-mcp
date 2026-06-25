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
  decodeArray,
  _decodeArray,
  decodeNumber,
  _decodeNumber,
} from 'type-decoder';

/**
 * @type { ReplyInput }
 * @description Input for one agent reply posted to a review thread
 */
export type ReplyInput = {
  /**
   * @description Target thread identifier
   * @type { string }
   * @memberof ReplyInput
   */
  threadId: string;
  /**
   * @description Optional message id this flat reply responds to
   * @type { string }
   * @memberof ReplyInput
   */
  replyToMessageId: string | null;
  /**
   * @description Reply message body in markdown
   * @type { string }
   * @memberof ReplyInput
   */
  content: string;
  /**
   * @description Machine identifier for this agent
   * @type { string }
   * @memberof ReplyInput
   */
  agentId: string | null;
  /**
   * @description Human-readable agent name
   * @type { string }
   * @memberof ReplyInput
   */
  agentName: string | null;
  /**
   * @description One-sentence summary of what was done
   * @type { string }
   * @memberof ReplyInput
   */
  summary: string | null;
  /**
   * @description Optional suggested replacement code
   * @type { string }
   * @memberof ReplyInput
   */
  suggestionCode: string | null;
  /**
   * @description Original code the suggestion replaces
   * @type { string }
   * @memberof ReplyInput
   */
  originalCode: string | null;
};

export function decodeReplyInput(rawInput: unknown): ReplyInput | null {
  if (isJSON(rawInput)) {
    const decodedThreadId = decodeString(rawInput['threadId']);
    const decodedReplyToMessageId = decodeString(rawInput['replyToMessageId']);
    const decodedContent = decodeString(rawInput['content']);
    const decodedAgentId = decodeString(rawInput['agentId']);
    const decodedAgentName = decodeString(rawInput['agentName']);
    const decodedSummary = decodeString(rawInput['summary']);
    const decodedSuggestionCode = decodeString(rawInput['suggestionCode']);
    const decodedOriginalCode = decodeString(rawInput['originalCode']);

    if (decodedThreadId === null || decodedContent === null) {
      return null;
    }

    return {
      threadId: decodedThreadId,
      replyToMessageId: decodedReplyToMessageId,
      content: decodedContent,
      agentId: decodedAgentId,
      agentName: decodedAgentName,
      summary: decodedSummary,
      suggestionCode: decodedSuggestionCode,
      originalCode: decodedOriginalCode,
    };
  }
  return null;
}

/**
 * @type { StatusValue }
 * @description Thread status update value
 */
export type StatusValue = 'resolved' | 'open';

export function decodeStatusValue(rawInput: unknown): StatusValue | null {
  switch (rawInput) {
    case 'resolved':
    case 'open':
      return rawInput;
  }
  return null;
}

export function _decodeStatusValue(rawInput: unknown): StatusValue | undefined {
  switch (rawInput) {
    case 'resolved':
    case 'open':
      return rawInput;
  }
  return;
}

/**
 * @type { StatusInput }
 * @description Input for one review thread status update
 */
export type StatusInput = {
  /**
   * @description Target thread identifier
   * @type { string }
   * @memberof StatusInput
   */
  threadId: string;
  /**
   * @type { StatusValue }
   * @memberof StatusInput
   */
  status: StatusValue;
  /**
   * @description Why the status is being changed
   * @type { string }
   * @memberof StatusInput
   */
  reason: string | null;
};

export function decodeStatusInput(rawInput: unknown): StatusInput | null {
  if (isJSON(rawInput)) {
    const decodedThreadId = decodeString(rawInput['threadId']);
    const decodedStatus = decodeStatusValue(rawInput['status']);
    const decodedReason = decodeString(rawInput['reason']);

    if (decodedThreadId === null || decodedStatus === null) {
      return null;
    }

    return {
      threadId: decodedThreadId,
      status: decodedStatus,
      reason: decodedReason,
    };
  }
  return null;
}

/**
 * @type { ThreadFetchResult }
 * @description Result for fetching one review thread and its messages
 */
export type ThreadFetchResult = {
  /**
   * @type { ReviewThread }
   * @memberof ThreadFetchResult
   */
  thread: ReviewThread;
  /**
   * @description Returned thread messages, possibly limited to the latest messages
   * @type { ReviewMessage[] }
   * @memberof ThreadFetchResult
   */
  messages: ReviewMessage[];
  /**
   * @description Total messages in the thread before messageLimit is applied
   * @type { number }
   * @memberof ThreadFetchResult
   */
  totalMessages: number;
  /**
   * @description Number of messages returned after messageLimit is applied
   * @type { number }
   * @memberof ThreadFetchResult
   */
  returnedMessages: number;
};

export function decodeThreadFetchResult(rawInput: unknown): ThreadFetchResult | null {
  if (isJSON(rawInput)) {
    const decodedThread = decodeReviewThread(rawInput['thread']);
    const decodedMessages = decodeArray(rawInput['messages'], decodeReviewMessage);
    const decodedTotalMessages = decodeNumber(rawInput['totalMessages']);
    const decodedReturnedMessages = decodeNumber(rawInput['returnedMessages']);

    if (
      decodedThread === null ||
      decodedMessages === null ||
      decodedTotalMessages === null ||
      decodedReturnedMessages === null
    ) {
      return null;
    }

    return {
      thread: decodedThread,
      messages: decodedMessages,
      totalMessages: decodedTotalMessages,
      returnedMessages: decodedReturnedMessages,
    };
  }
  return null;
}
