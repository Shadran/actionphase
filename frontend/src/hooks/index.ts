/**
 * Unified State Management System - Hooks Exports
 *
 * This file exports all custom hooks for easy importing.
 */

// Game-related hooks
export {
  useGamePermissions,
  type GamePermissions,
  type UserGameRole,
} from './useGamePermissions';

export {
  useUserCharacters,
  type UserCharactersResult,
} from './useUserCharacters';

export {
  useCharacterOwnership,
  type CharacterOwnershipResult,
} from './useCharacterOwnership';

export { useGameListing } from './useGameListing';

// Admin-related hooks
export { useAdminMode, type UseAdminModeReturn } from './useAdminMode';

// Message mutation hooks (posts and comments)
export { useUpdatePost, useUpdateComment, useDeleteComment } from './useCommentMutations';

// Recent comments hooks
export { useRecentComments, useTotalCommentCount } from './useRecentComments';

// Draft character updates hooks
export {
  useDraftCharacterUpdates,
  useDraftUpdateCount,
  useCreateDraftCharacterUpdate,
  useUpdateDraftCharacterUpdate,
  useDeleteDraftCharacterUpdate,
} from './useDraftCharacterUpdates';

// Draft post hooks
export {
  useDraftPost,
  useCreateDraftPost,
  useUpdateDraftPost,
  useDeleteDraftPost,
} from './useDraftPost';

// Poll hooks
export {
  usePolls,
  usePoll,
  usePollResults,
  useSubmitVote,
  usePollsByPhase,
} from './usePolls';

// UI state hooks
export { usePostCollapseState } from './usePostCollapseState';

// URL param sync hook (deep linking / permalink support)
export { useUrlParam } from './useUrlParam';
