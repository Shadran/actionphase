import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type { MarkPostReadRequest, ReadMarker, ManualCommentReads } from '../types/messages';
import { useMemo } from 'react';

/**
 * Hook to fetch all read markers for a game
 */
export function useReadMarkers(gameId: number | undefined) {
  return useQuery({
    queryKey: ['readMarkers', gameId],
    queryFn: async () => {
      if (!gameId) throw new Error('Game ID required');
      const response = await apiClient.messages.getReadMarkers(gameId);
      return response.data;
    },
    enabled: !!gameId,
    // Don't refetch automatically - only when user navigates or marks as read
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });
}

/**
 * Hook to fetch unread info for all posts in a game
 */
export function usePostsUnreadInfo(gameId: number | undefined) {
  return useQuery({
    queryKey: ['postsUnreadInfo', gameId],
    queryFn: async () => {
      if (!gameId) throw new Error('Game ID required');
      const response = await apiClient.messages.getPostsUnreadInfo(gameId);
      return response.data;
    },
    enabled: !!gameId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });
}

/**
 * Hook to mark a post as read
 */
export function useMarkPostAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ gameId, postId, data }: { gameId: number; postId: number; data?: MarkPostReadRequest }) => {
      const response = await apiClient.messages.markPostAsRead(gameId, postId, data || {});
      return response.data;
    },
    onSuccess: async (_, variables) => {
      // Use refetchQueries instead of invalidateQueries to bypass staleTime
      // This ensures fresh data is fetched immediately after marking as read
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ['readMarkers', variables.gameId] }),
        queryClient.refetchQueries({ queryKey: ['postsUnreadInfo', variables.gameId] }),
        queryClient.refetchQueries({ queryKey: ['unreadCommentIDs', variables.gameId] }),
      ]);
    },
  });
}

/**
 * Combined hook that provides unread status for posts
 * Returns a map of postId -> isUnread and unread comment count
 */
export function useUnreadStatus(gameId: number | undefined) {
  const { data: readMarkers = [] } = useReadMarkers(gameId);
  const { data: postsUnreadInfo = [] } = usePostsUnreadInfo(gameId);

  return useMemo(() => {
    const unreadMap = new Map<number, { isUnread: boolean; unreadCount: number }>();

    // Create a map of post ID -> read marker
    const readMarkersMap = new Map<number, ReadMarker>();
    readMarkers.forEach(marker => {
      readMarkersMap.set(marker.post_id, marker);
    });

    // For each post, determine if it has unread content
    postsUnreadInfo.forEach(postInfo => {
      const marker = readMarkersMap.get(postInfo.post_id);

      if (!marker) {
        // No read marker means post is completely unread
        unreadMap.set(postInfo.post_id, {
          isUnread: true,
          unreadCount: postInfo.total_comments,
        });
        return;
      }

      // Check if there are new comments since last read
      const hasNewComments =
        postInfo.latest_comment_at &&
        new Date(postInfo.latest_comment_at) > new Date(marker.last_read_at);

      if (hasNewComments) {
        // Post has new comments
        // We can't accurately count unread comments without more data,
        // so we just indicate there are unread items
        unreadMap.set(postInfo.post_id, {
          isUnread: true,
          unreadCount: postInfo.total_comments, // Approximate - might show more than actual unread
        });
      } else {
        // Post is fully read
        unreadMap.set(postInfo.post_id, {
          isUnread: false,
          unreadCount: 0,
        });
      }
    });

    return unreadMap;
  }, [readMarkers, postsUnreadInfo]);
}

/**
 * Helper hook to get unread status for a specific post
 */
export function usePostUnreadStatus(gameId: number | undefined, postId: number | undefined) {
  const unreadStatusMap = useUnreadStatus(gameId);

  return useMemo(() => {
    if (!postId) return { isUnread: false, unreadCount: 0 };
    return unreadStatusMap.get(postId) || { isUnread: false, unreadCount: 0 };
  }, [unreadStatusMap, postId]);
}

/**
 * Hook to fetch unread comment IDs for all posts in a game
 * Returns specific comment IDs that are "new since last visit"
 */
export function useUnreadCommentIDs(gameId: number | undefined) {
  return useQuery({
    queryKey: ['unreadCommentIDs', gameId],
    queryFn: async () => {
      if (!gameId) throw new Error('Game ID required');
      const response = await apiClient.messages.getUnreadCommentIDs(gameId);
      return response.data;
    },
    enabled: !!gameId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // Consider fresh for 5 minutes
  });
}

/**
 * Helper hook to get unread comment IDs for a specific post
 */
export function usePostUnreadCommentIDs(gameId: number | undefined, postId: number | undefined) {
  const { data: unreadComments = [] } = useUnreadCommentIDs(gameId);

  return useMemo(() => {
    if (!postId) return [];
    const postData = unreadComments.find(pc => pc.post_id === postId);
    return postData?.unread_comment_ids || [];
  }, [unreadComments, postId]);
}

/**
 * Hook to fetch all comment IDs manually marked as read by the user in a game
 */
export function useManualReadCommentIDs(gameId: number | undefined) {
  return useQuery({
    queryKey: ['manualReadCommentIDs', gameId],
    queryFn: async () => {
      if (!gameId) throw new Error('Game ID required');
      const response = await apiClient.messages.getManualReadCommentIDs(gameId);
      return response.data as ManualCommentReads[];
    },
    enabled: !!gameId,
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Helper hook to get manually read comment IDs for a specific post
 */
export function usePostManualReadCommentIDs(gameId: number | undefined, postId: number | undefined) {
  const { data: manualReads = [] } = useManualReadCommentIDs(gameId);

  return useMemo(() => {
    if (!postId) return [];
    const postData = manualReads.find(mr => mr.post_id === postId);
    return postData?.read_comment_ids || [];
  }, [manualReads, postId]);
}

/**
 * Mutation to toggle a single comment's manual read state
 */
export function useToggleCommentRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      gameId,
      postId,
      commentId,
      read,
    }: {
      gameId: number;
      postId: number;
      commentId: number;
      read: boolean;
    }) => {
      await apiClient.messages.toggleCommentRead(gameId, postId, commentId, read);
    },
    onSuccess: (_, variables) => {
      queryClient.refetchQueries({
        queryKey: ['manualReadCommentIDs', variables.gameId],
      });
    },
  });
}
