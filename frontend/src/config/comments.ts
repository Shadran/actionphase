/**
 * Comment Threading Configuration
 *
 * Centralized configuration for comment threading depth limits.
 *
 * These values control:
 * - How many nesting levels are visible in main view
 * - When "Continue thread" button appears
 * - When Reply buttons are shown
 *
 * **Behavior**:
 * - Comments at depths 0 through (MAX_DEPTH - 1) are visible with Reply buttons
 * - Comments at depth (MAX_DEPTH - 1) with deeper replies show "Continue thread" button
 * - Comments at depth MAX_DEPTH and beyond are NOT visible in main view
 *
 * **Example with MAX_DEPTH = 5**:
 * - Depths 0-4: Visible with Reply buttons
 * - Depth 4 with children: Shows "Continue thread"
 * - Depth 5+: Hidden (accessible via thread view modal)
 */

import { logger } from '@/services/LoggingService';

/**
 * Desktop comment threading depth limit
 * Default: 5 (shows depths 0-4, "Continue thread" at depth 4)
 */
export const COMMENT_MAX_DEPTH = parseInt(
  import.meta.env.VITE_COMMENT_MAX_DEPTH || '5',
  10
);

/**
 * Mobile comment threading depth limit
 * Lower than desktop to save screen space
 * Default: 3 (shows depths 0-2, "Continue thread" at depth 2)
 */
export const COMMENT_MAX_DEPTH_MOBILE = parseInt(
  import.meta.env.VITE_COMMENT_MAX_DEPTH_MOBILE || '3',
  10
);


// Validate configuration
if (COMMENT_MAX_DEPTH < 1 || COMMENT_MAX_DEPTH > 10) {
  logger.error(`Invalid VITE_COMMENT_MAX_DEPTH: ${COMMENT_MAX_DEPTH}. Must be 1-10.`);
}

if (COMMENT_MAX_DEPTH_MOBILE < 1 || COMMENT_MAX_DEPTH_MOBILE > 10) {
  logger.error(`Invalid VITE_COMMENT_MAX_DEPTH_MOBILE: ${COMMENT_MAX_DEPTH_MOBILE}. Must be 1-10.`);
}

/**
 * Thread view modal depth limit
 * When viewing a specific thread in modal, show many levels
 * Default: 10 (nearly unlimited for thread view)
 */
export const THREAD_VIEW_MAX_DEPTH = 10;
