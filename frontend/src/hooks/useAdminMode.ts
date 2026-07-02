/**
 * Custom hook for managing admin mode state
 *
 * Admin mode is a client-side toggle that allows administrators to:
 * - View all games on the platform (not just their own)
 * - Delete comments and posts for moderation
 * - See admin-specific UI elements
 *
 * State is persisted in localStorage and clears on logout.
 *
 * This hook is now implemented as a Context to share state across components.
 * Import from '../contexts/AdminModeContext' for the actual implementation.
 */
export { useAdminMode } from '../contexts/AdminModeContext';
