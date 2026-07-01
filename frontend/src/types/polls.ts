/**
 * Polls Types
 *
 * Common Room Polling System allows GMs and players to create polls for games.
 * Polls support optional "other" text responses. Results can show vote counts
 * or individual voters (with character names when available).
 */

interface PollOption {
  id: number;
  poll_id: number;
  option_text: string;
  display_order: number;
  created_at?: string;
}

export interface Poll {
  id: number;
  game_id: number;
  phase_id?: number;
  created_by_user_id: number;
  created_by_character_id?: number;
  question: string;
  description?: string;
  deadline: string; // ISO 8601 timestamp
  show_individual_votes: boolean;
  allow_other_option: boolean;
  is_deleted: boolean;
  created_at: string;
  updated_at?: string;
  // Computed properties from backend
  is_expired?: boolean;
  user_has_voted?: boolean;
}

export interface PollWithOptions extends Poll {
  options: PollOption[];
  user_vote_option_id?: number;
  user_vote_other_response?: string;
}

export interface PollVote {
  id: number;
  poll_id: number;
  user_id: number;
  selected_option_id?: number;
  other_response?: string;
  created_at: string;
  updated_at?: string;
}

interface VoterInfo {
  user_id: number;
  character_name: string;
  other_response?: string;
}

interface OptionResult {
  poll_option_id?: number;
  option_text?: string;
  vote_count: number;
  voters?: VoterInfo[]; // Only populated if show_individual_votes is true
}

interface OtherResponse {
  vote_id: number;
  other_text: string;
  character_name: string;
}

export interface PollResults {
  poll: Poll;
  option_results: OptionResult[];
  other_responses: OtherResponse[];
  total_votes: number;
  show_individual_votes: boolean;
}

// Request types
interface CreatePollOptionRequest {
  text: string;
  display_order: number;
}

export interface CreatePollRequest {
  question: string;
  description?: string;
  deadline: string; // ISO 8601 timestamp
  show_individual_votes: boolean;
  allow_other_option: boolean;
  phase_id?: number;
  created_by_character_id?: number;
  options: CreatePollOptionRequest[];
}

export interface UpdatePollRequest {
  question: string;
  description?: string;
  deadline: string; // ISO 8601 timestamp
  show_individual_votes: boolean;
  allow_other_option: boolean;
}

export interface SubmitVoteRequest {
  selected_option_id?: number;
  other_response?: string;
}
