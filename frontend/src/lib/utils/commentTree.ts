import type { CommentWithDepth } from '@/types/messages';
import { logger } from '@/services/LoggingService';

export interface CommentTreeNode extends CommentWithDepth {
  children: CommentTreeNode[];
}

/**
 * Builds a tree structure from a flat array of comments with depth field
 *
 * The backend returns comments in a flat array sorted by created_at DESC,
 * with a depth field indicating nesting level (0 = top-level, 1+ = nested).
 *
 * This function organizes them into a tree structure where each comment
 * has a `children` array containing its nested replies.
 *
 * @param comments - Flat array of comments from backend (with depth field)
 * @returns Array of top-level comments with nested children
 *
 * @example
 * const response = await api.getPostCommentsWithThreads(gameId, postId, 5, 0);
 * const tree = buildCommentTree(response.data.comments);
 * // tree[0].children[0].children[0] = deeply nested comment
 */
export function buildCommentTree(comments: CommentWithDepth[]): CommentTreeNode[] {
  // Create a map for O(1) lookups
  const commentMap = new Map<number, CommentTreeNode>();

  // Initialize all comments with empty children arrays
  comments.forEach(comment => {
    commentMap.set(comment.id, {
      ...comment,
      children: []
    });
  });

  // Separate top-level comments (depth=0) from nested replies
  const topLevelComments: CommentTreeNode[] = [];

  // Build the tree by connecting children to parents
  comments.forEach(comment => {
    const node = commentMap.get(comment.id)!;

    if (comment.depth === 0 || !comment.parent_id) {
      // Top-level comment
      topLevelComments.push(node);
    } else {
      // Nested reply - add to parent's children
      const parent = commentMap.get(comment.parent_id);
      if (parent) {
        parent.children.push(node);
      } else {
        // Parent not found (shouldn't happen with proper backend data)
        // Treat as top-level to avoid losing the comment
        logger.warn(`Comment ${comment.id} has parent_id ${comment.parent_id} but parent not found`);
        topLevelComments.push(node);
      }
    }
  });

  // Sort children arrays by created_at DESC (newest first) for consistent ordering
  const sortChildren = (node: CommentTreeNode) => {
    node.children.sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    node.children.forEach(sortChildren);
  };
  topLevelComments.forEach(sortChildren);

  return topLevelComments;
}

/**
 * Recursively removes deleted comments that have no children.
 * A deleted comment is only kept when it has surviving descendants (to preserve
 * thread structure). This runs bottom-up: children are pruned first, then the
 * parent is evaluated based on the post-prune children array.
 */
export function pruneDeletedLeaves(nodes: CommentTreeNode[]): CommentTreeNode[] {
  return nodes
    .map(node => {
      const children = pruneDeletedLeaves(node.children);
      // Only override reply_count when deleted leaves were actually pruned — otherwise
      // preserve the original count, which may reflect replies beyond the loaded max_depth.
      const prunedCount = node.children.length - children.length;
      const reply_count = prunedCount > 0
        ? Math.max(0, (node.reply_count ?? node.children.length) - prunedCount)
        : node.reply_count;
      return { ...node, children, reply_count };
    })
    .filter(node => !node.is_deleted || node.children.length > 0);
}

/**
 * Flattens a comment tree back into a flat array (useful for rendering)
 *
 * @param tree - Tree of comments with children
 * @returns Flat array of all comments in depth-first order
 */
export function flattenCommentTree(tree: CommentTreeNode[]): CommentTreeNode[] {
  const result: CommentTreeNode[] = [];

  const traverse = (node: CommentTreeNode) => {
    result.push(node);
    node.children.forEach(traverse);
  };

  tree.forEach(traverse);
  return result;
}

/**
 * Counts total comments in a tree (including all nested replies)
 *
 * @param tree - Tree of comments
 * @returns Total number of comments
 */
export function countCommentsInTree(tree: CommentTreeNode[]): number {
  return flattenCommentTree(tree).length;
}
