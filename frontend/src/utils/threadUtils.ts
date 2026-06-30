import { apiClient } from '../lib/api';
import type { Message } from '../types/messages';
import { logger } from '@/services/LoggingService';
import { AxiosError } from 'axios';

/**
 * Fetch a message with exponential backoff retry logic
 * Retries transient errors (timeouts, 500s, network issues)
 * Fast-fails on 404s (comment deleted) and other client errors
 *
 * @param gameId - Game ID
 * @param messageId - Message ID to fetch
 * @param maxRetries - Maximum number of retry attempts (default: 2)
 * @returns Promise<Message>
 * @throws Error if all retries fail or on 404
 */
async function fetchMessageWithRetry(
  gameId: number,
  messageId: number,
  maxRetries: number = 2
): Promise<Message> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await apiClient.messages.getMessage(gameId, messageId);
      return response.data;
    } catch (error) {
      lastError = error as Error;

      // Check if it's an Axios error with response
      if (error instanceof AxiosError && error.response) {
        const status = error.response.status;

        // Don't retry 404s (comment deleted) or other client errors (4xx)
        if (status === 404) {
          logger.debug(`Message ${messageId} not found (404), not retrying`);
          throw error;
        }

        if (status >= 400 && status < 500) {
          logger.debug(`Client error ${status} for message ${messageId}, not retrying`);
          throw error;
        }
      }

      // If this was the last attempt, throw the error
      if (attempt === maxRetries) {
        break;
      }

      // Calculate exponential backoff delay: 100ms, 200ms
      const delay = 100 * Math.pow(2, attempt);
      logger.debug(`Retrying message ${messageId} fetch after ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);

      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  // All retries exhausted
  throw lastError || new Error('Failed to fetch message after retries');
}

/**
 * Walk up the parent chain from a given message ID until we find the root post.
 * Used to resolve the root post ID for read tracking when the full chain wasn't fetched.
 */
export async function findRootPostId(gameId: number, startMessage: Message): Promise<number> {
  let current = startMessage;

  while (current.parent_id) {
    try {
      const parent = await fetchMessageWithRetry(gameId, current.parent_id, 2);
      if (parent.message_type === 'post' || !parent.parent_id) {
        return parent.id;
      }
      current = parent;
    } catch {
      // If we can't walk further, best effort: return what we have
      return current.parent_id;
    }
  }

  // current has no parent_id — it is the root post
  return current.id;
}

/**
 * Fetch a comment with its parent chain context (up to N levels)
 * Walks up the parent chain by fetching each parent message
 * Returns messages in parent-to-child order (oldest → target)
 *
 * Uses retry logic with exponential backoff to handle transient network errors
 */
export async function fetchCommentWithParents(
  gameId: number,
  commentId: number,
  maxDepth: number = 3
): Promise<{ messages: Message[]; hasFullThread: boolean }> {
  const messages: Message[] = [];
  let currentId: number | undefined = commentId;
  let depth = 0;

  // Fetch the target comment and walk up the parent chain
  while (currentId && depth <= maxDepth) {
    try {
      // Use retry logic to handle transient network errors
      const message = await fetchMessageWithRetry(gameId, currentId, 2);

      // Prepend to array to maintain parent-to-child order
      messages.unshift(message);

      // Move to parent
      currentId = message.parent_id;
      depth++;
    } catch (error) {
      logger.error(`Failed to fetch message ${currentId} after retries`, { error });
      break;
    }
  }

  // hasFullThread = true if we reached a post (no parent) or hit max depth without finding root
  const hasFullThread = messages.length > 0 && !messages[0].parent_id;

  return { messages, hasFullThread };
}
