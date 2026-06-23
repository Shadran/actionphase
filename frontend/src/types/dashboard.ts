/**
 * Dashboard Types
 *
 * Type definitions for the user dashboard data aggregation feature.
 */

export interface DashboardGameCard {
  game_id: number;
  title: string;
  description?: string | null;
  state: string;
  genre?: string | null;
  gm_user_id: number;
  gm_username: string;
  user_role: string; // player, gm, co_gm, audience
  has_pending_action: boolean;
  pending_applications: number;
  unread_comments: number;
  unvoted_polls: number;
  current_phase_id?: number | null;
  current_phase_type?: string | null;
  current_phase_title?: string | null;
  current_phase_deadline?: string | null; // ISO 8601 timestamp
  deadline_status: 'critical' | 'warning' | 'normal';
  is_urgent: boolean;
  updated_at: string; // ISO 8601 timestamp
  created_at: string; // ISO 8601 timestamp
}

export interface DashboardMessage {
  message_id: number;
  game_id: number;
  game_title: string;
  author_name: string;
  character_name?: string | null;
  content: string; // Truncated to 100 chars
  message_type: 'post' | 'comment' | 'private_message';
  phase_id?: number | null;
  created_at: string; // ISO 8601 timestamp
}

export interface DashboardDeadline {
  deadline_type: string; // "phase", "deadline", or "poll"
  source_id: number;
  phase_id: number;
  game_id: number;
  game_title: string;
  title: string;
  phase_type: string;
  phase_title: string;
  phase_number: number;
  end_time: string; // ISO 8601 timestamp
  has_pending_submission: boolean;
  hours_remaining: number;
}

export interface DashboardData {
  user_id: number;
  has_games: boolean;
  player_games: DashboardGameCard[];
  gm_games: DashboardGameCard[];
  audience_games: DashboardGameCard[];
  mixed_role_games: DashboardGameCard[];
  recent_messages: DashboardMessage[];
  upcoming_deadlines: DashboardDeadline[];
  unread_notifications: number;
  notifications_by_type: Record<string, number>;
}
