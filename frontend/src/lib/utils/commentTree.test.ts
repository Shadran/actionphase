import { describe, it, expect } from 'vitest';
import { buildCommentTree, flattenCommentTree, countCommentsInTree, pruneDeletedLeaves } from './commentTree';
import type { CommentWithDepth } from '@/types/messages';

describe('commentTree utilities', () => {
  describe('buildCommentTree', () => {
    it('should build a tree from flat comments with depth field', () => {
      // Arrange: Flat array with depth field (as returned by backend)
      const comments: CommentWithDepth[] = [
        {
          id: 1,
          depth: 0,
          parent_id: undefined,
          content: 'Top-level comment',
          created_at: '2024-01-01T12:00:00Z',
        } as CommentWithDepth,
        {
          id: 2,
          depth: 1,
          parent_id: 1,
          content: 'Reply to comment 1',
          created_at: '2024-01-01T12:01:00Z',
        } as CommentWithDepth,
        {
          id: 3,
          depth: 2,
          parent_id: 2,
          content: 'Nested reply to comment 2',
          created_at: '2024-01-01T12:02:00Z',
        } as CommentWithDepth,
      ];

      // Act
      const tree = buildCommentTree(comments);

      // Assert
      expect(tree).toHaveLength(1); // 1 top-level comment
      expect(tree[0].id).toBe(1);
      expect(tree[0].children).toHaveLength(1); // 1 reply
      expect(tree[0].children[0].id).toBe(2);
      expect(tree[0].children[0].children).toHaveLength(1); // 1 nested reply
      expect(tree[0].children[0].children[0].id).toBe(3);
    });

    it('should handle multiple top-level comments', () => {
      // Arrange
      const comments: CommentWithDepth[] = [
        {
          id: 1,
          depth: 0,
          parent_id: undefined,
          content: 'First top-level',
          created_at: '2024-01-01T12:00:00Z',
        } as CommentWithDepth,
        {
          id: 2,
          depth: 0,
          parent_id: undefined,
          content: 'Second top-level',
          created_at: '2024-01-01T12:01:00Z',
        } as CommentWithDepth,
        {
          id: 3,
          depth: 1,
          parent_id: 1,
          content: 'Reply to first',
          created_at: '2024-01-01T12:02:00Z',
        } as CommentWithDepth,
      ];

      // Act
      const tree = buildCommentTree(comments);

      // Assert
      expect(tree).toHaveLength(2); // 2 top-level comments
      expect(tree[0].id).toBe(1);
      expect(tree[0].children).toHaveLength(1);
      expect(tree[1].id).toBe(2);
      expect(tree[1].children).toHaveLength(0);
    });

    it('should handle comments with missing parent gracefully', () => {
      // Arrange: Comment with parent_id but parent not in the list
      const comments: CommentWithDepth[] = [
        {
          id: 1,
          depth: 0,
          parent_id: undefined,
          content: 'Top-level comment',
          created_at: '2024-01-01T12:00:00Z',
        } as CommentWithDepth,
        {
          id: 3,
          depth: 1,
          parent_id: 999, // Parent doesn't exist
          content: 'Orphan reply',
          created_at: '2024-01-01T12:01:00Z',
        } as CommentWithDepth,
      ];

      // Act
      const tree = buildCommentTree(comments);

      // Assert: Orphan should be treated as top-level
      expect(tree).toHaveLength(2);
      expect(tree.find(c => c.id === 3)).toBeDefined();
    });

    it('should sort children by created_at DESC (newest first)', () => {
      // Arrange: Comments in random order
      const comments: CommentWithDepth[] = [
        {
          id: 1,
          depth: 0,
          parent_id: undefined,
          content: 'Top-level',
          created_at: '2024-01-01T12:00:00Z',
        } as CommentWithDepth,
        {
          id: 2,
          depth: 1,
          parent_id: 1,
          content: 'Oldest reply',
          created_at: '2024-01-01T12:01:00Z',
        } as CommentWithDepth,
        {
          id: 3,
          depth: 1,
          parent_id: 1,
          content: 'Newest reply',
          created_at: '2024-01-01T12:03:00Z',
        } as CommentWithDepth,
        {
          id: 4,
          depth: 1,
          parent_id: 1,
          content: 'Middle reply',
          created_at: '2024-01-01T12:02:00Z',
        } as CommentWithDepth,
      ];

      // Act
      const tree = buildCommentTree(comments);

      // Assert: Children should be sorted newest first
      expect(tree[0].children).toHaveLength(3);
      expect(tree[0].children[0].id).toBe(3); // Newest
      expect(tree[0].children[1].id).toBe(4); // Middle
      expect(tree[0].children[2].id).toBe(2); // Oldest
    });

    it('should handle empty array', () => {
      // Act
      const tree = buildCommentTree([]);

      // Assert
      expect(tree).toHaveLength(0);
    });

    it('should handle deeply nested comments (5 levels)', () => {
      // Arrange: Comments nested 5 levels deep
      const comments: CommentWithDepth[] = [
        {
          id: 1,
          depth: 0,
          parent_id: undefined,
          content: 'Level 0',
          created_at: '2024-01-01T12:00:00Z',
        } as CommentWithDepth,
        {
          id: 2,
          depth: 1,
          parent_id: 1,
          content: 'Level 1',
          created_at: '2024-01-01T12:01:00Z',
        } as CommentWithDepth,
        {
          id: 3,
          depth: 2,
          parent_id: 2,
          content: 'Level 2',
          created_at: '2024-01-01T12:02:00Z',
        } as CommentWithDepth,
        {
          id: 4,
          depth: 3,
          parent_id: 3,
          content: 'Level 3',
          created_at: '2024-01-01T12:03:00Z',
        } as CommentWithDepth,
        {
          id: 5,
          depth: 4,
          parent_id: 4,
          content: 'Level 4',
          created_at: '2024-01-01T12:04:00Z',
        } as CommentWithDepth,
        {
          id: 6,
          depth: 5,
          parent_id: 5,
          content: 'Level 5',
          created_at: '2024-01-01T12:05:00Z',
        } as CommentWithDepth,
      ];

      // Act
      const tree = buildCommentTree(comments);

      // Assert: Navigate through the tree
      expect(tree).toHaveLength(1);
      expect(tree[0].id).toBe(1);
      expect(tree[0].children[0].id).toBe(2);
      expect(tree[0].children[0].children[0].id).toBe(3);
      expect(tree[0].children[0].children[0].children[0].id).toBe(4);
      expect(tree[0].children[0].children[0].children[0].children[0].id).toBe(5);
      expect(tree[0].children[0].children[0].children[0].children[0].children[0].id).toBe(6);
    });
  });

  describe('flattenCommentTree', () => {
    it('should flatten a tree back to a flat array', () => {
      // Arrange: Build a tree first
      const comments: CommentWithDepth[] = [
        {
          id: 1,
          depth: 0,
          parent_id: undefined,
          content: 'Top-level',
          created_at: '2024-01-01T12:00:00Z',
        } as CommentWithDepth,
        {
          id: 2,
          depth: 1,
          parent_id: 1,
          content: 'Reply',
          created_at: '2024-01-01T12:01:00Z',
        } as CommentWithDepth,
        {
          id: 3,
          depth: 2,
          parent_id: 2,
          content: 'Nested reply',
          created_at: '2024-01-01T12:02:00Z',
        } as CommentWithDepth,
      ];
      const tree = buildCommentTree(comments);

      // Act
      const flattened = flattenCommentTree(tree);

      // Assert: Should be in depth-first order
      expect(flattened).toHaveLength(3);
      expect(flattened[0].id).toBe(1);
      expect(flattened[1].id).toBe(2);
      expect(flattened[2].id).toBe(3);
    });

    it('should handle empty tree', () => {
      // Act
      const flattened = flattenCommentTree([]);

      // Assert
      expect(flattened).toHaveLength(0);
    });
  });

  describe('pruneDeletedLeaves', () => {
    it('removes a deleted top-level comment with no children', () => {
      const comments: CommentWithDepth[] = [
        { id: 1, depth: 0, parent_id: undefined, content: 'Active', is_deleted: false, created_at: '2024-01-01T12:00:00Z' } as CommentWithDepth,
        { id: 2, depth: 0, parent_id: undefined, content: 'Deleted leaf', is_deleted: true, created_at: '2024-01-01T12:01:00Z' } as CommentWithDepth,
      ];
      const tree = buildCommentTree(comments);
      const pruned = pruneDeletedLeaves(tree);

      expect(pruned).toHaveLength(1);
      expect(pruned[0].id).toBe(1);
    });

    it('keeps a deleted comment that has surviving children', () => {
      const comments: CommentWithDepth[] = [
        { id: 1, depth: 0, parent_id: undefined, content: 'Deleted middle', is_deleted: true, created_at: '2024-01-01T12:00:00Z' } as CommentWithDepth,
        { id: 2, depth: 1, parent_id: 1, content: 'Active child', is_deleted: false, created_at: '2024-01-01T12:01:00Z' } as CommentWithDepth,
      ];
      const tree = buildCommentTree(comments);
      const pruned = pruneDeletedLeaves(tree);

      expect(pruned).toHaveLength(1);
      expect(pruned[0].id).toBe(1);
      expect(pruned[0].children).toHaveLength(1);
      expect(pruned[0].children[0].id).toBe(2);
    });

    it('removes a deleted child when all its descendants are also deleted', () => {
      const comments: CommentWithDepth[] = [
        { id: 1, depth: 0, parent_id: undefined, content: 'Active root', is_deleted: false, created_at: '2024-01-01T12:00:00Z' } as CommentWithDepth,
        { id: 2, depth: 1, parent_id: 1, content: 'Deleted', is_deleted: true, created_at: '2024-01-01T12:01:00Z' } as CommentWithDepth,
        { id: 3, depth: 2, parent_id: 2, content: 'Also deleted', is_deleted: true, created_at: '2024-01-01T12:02:00Z' } as CommentWithDepth,
      ];
      const tree = buildCommentTree(comments);
      const pruned = pruneDeletedLeaves(tree);

      expect(pruned).toHaveLength(1);
      expect(pruned[0].id).toBe(1);
      expect(pruned[0].children).toHaveLength(0);
    });

    it('keeps a deleted middle node when a live comment exists below it', () => {
      const comments: CommentWithDepth[] = [
        { id: 1, depth: 0, parent_id: undefined, content: 'Active root', is_deleted: false, created_at: '2024-01-01T12:00:00Z' } as CommentWithDepth,
        { id: 2, depth: 1, parent_id: 1, content: 'Deleted middle', is_deleted: true, created_at: '2024-01-01T12:01:00Z' } as CommentWithDepth,
        { id: 3, depth: 2, parent_id: 2, content: 'Live grandchild', is_deleted: false, created_at: '2024-01-01T12:02:00Z' } as CommentWithDepth,
      ];
      const tree = buildCommentTree(comments);
      const pruned = pruneDeletedLeaves(tree);

      expect(pruned[0].children).toHaveLength(1);
      expect(pruned[0].children[0].id).toBe(2);
      expect(pruned[0].children[0].children[0].id).toBe(3);
    });
  });

  describe('countCommentsInTree', () => {
    it('should count all comments including nested', () => {
      // Arrange
      const comments: CommentWithDepth[] = [
        {
          id: 1,
          depth: 0,
          parent_id: undefined,
          content: 'Top-level',
          created_at: '2024-01-01T12:00:00Z',
        } as CommentWithDepth,
        {
          id: 2,
          depth: 1,
          parent_id: 1,
          content: 'Reply',
          created_at: '2024-01-01T12:01:00Z',
        } as CommentWithDepth,
        {
          id: 3,
          depth: 2,
          parent_id: 2,
          content: 'Nested reply',
          created_at: '2024-01-01T12:02:00Z',
        } as CommentWithDepth,
      ];
      const tree = buildCommentTree(comments);

      // Act
      const count = countCommentsInTree(tree);

      // Assert
      expect(count).toBe(3);
    });

    it('should return 0 for empty tree', () => {
      // Act
      const count = countCommentsInTree([]);

      // Assert
      expect(count).toBe(0);
    });
  });
});
