/**
 * User Profile Types
 *
 * These types match the backend API response structure for user profiles,
 * game history, and profile updates.
 */

/**
 * User profile information
 */
export interface UserProfile {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string; // ISO 8601 timestamp
  timezone: string;
  is_admin: boolean;
}

/**
 * Character within a game (for game history)
 * Only populated for non-anonymous games
 */
export interface UserGameCharacter {
  id: number;
  name: string;
  avatar_url: string | null;
  character_type: string;
}

/**
 * Game in user's game history
 */
export interface UserGame {
  game_id: number;
  title: string;
  state: string;
  is_anonymous: boolean;
  user_role: string; // "player", "gm", "co_gm"
  gm_username: string;
  created_at: string; // ISO 8601 timestamp
  updated_at: string; // ISO 8601 timestamp
  characters: UserGameCharacter[]; // Empty array for anonymous games
}

/**
 * Pagination metadata for user game history
 */
export interface UserGameHistoryMetadata {
  page: number;
  page_size: number;
  total_pages: number;
  total_count: number;
  has_next_page: boolean;
  has_previous_page: boolean;
}

/**
 * Complete user profile response from API
 */
export interface UserProfileResponse {
  user: UserProfile;
  games: UserGame[];
  metadata: UserGameHistoryMetadata;
}

/**
 * Request payload for updating user profile
 */
export interface UpdateUserProfileRequest {
  display_name?: string;
  bio?: string;
}

/**
 * Response from avatar upload
 */
export interface UploadAvatarResponse {
  avatar_url: string;
}
