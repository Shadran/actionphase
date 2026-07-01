export interface User {
  id: number;
  username: string;
  email: string;
  email_verified?: boolean;
  password?: string;
  bio?: string | null;
  avatar_url?: string | null;
  is_admin?: boolean;
  is_banned?: boolean;
  pending_approval?: boolean;
  createdAt?: string;
}

export interface LoginRequest {
  username: string;
  password: string;
  fingerprint?: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  hcaptcha_token?: string;
  honeypot_value?: string;
  fingerprint?: string;
}

export interface AuthResponse {
  user?: User;
  Token: string; // Backend uses capital T
  token?: string; // Keep lowercase for backward compatibility
}

interface AuthError {
  message: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface ChangePasswordResponse {
  message: string;
}

interface Session {
  id: number;
  created_at: string;
  expires: string;
  is_current: boolean;
}

export interface SessionsListResponse {
  sessions: Session[];
}
