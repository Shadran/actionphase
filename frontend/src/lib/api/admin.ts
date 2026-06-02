import { BaseApiClient } from './client';

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  createdAt: string;
}

export interface BannedUser {
  id: number;
  username: string;
  email: string;
  banned_at: string;
  banned_by_user_id: number;
  banned_by_username: string;
  created_at: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  is_banned: boolean;
  pending_approval: boolean;
  pending_approval_since?: string;
  email_verified: boolean;
  createdAt: string;
  created_at?: string;
}

export interface UserListResponse {
  users: User[];
  total: number;
  page: number;
  page_size: number;
}

export interface IPBan {
  id: number;
  ip_address: string;
  created_by: number;
  created_at: string;
  reason?: string;
  expires_at?: string;
  banned_user_id?: number;
  banned_username?: string;
}

export interface FingerprintBan {
  id: number;
  fingerprint: string;
  created_by: number;
  created_at: string;
  reason?: string;
  banned_user_id?: number;
  banned_username?: string;
}

export interface SessionDetail {
  id: number;
  ip_address?: string;
  user_agent?: string;
  fingerprint?: string;
  created_at: string;
  last_seen_at: string;
  expires: string;
}

/**
 * Admin API client
 * Handles admin operations like user management, banning, etc.
 */
export class AdminApi extends BaseApiClient {
  /**
   * List all users with admin privileges
   */
  async listAdmins() {
    return this.client.get<AdminUser[]>('/api/v1/admin/admins');
  }

  /**
   * Grant admin privileges to a user
   */
  async grantAdminStatus(userId: number) {
    return this.client.put(`/api/v1/admin/users/${userId}/admin`, {});
  }

  /**
   * Revoke admin privileges from a user
   */
  async revokeAdminStatus(userId: number) {
    return this.client.delete(`/api/v1/admin/users/${userId}/admin`);
  }

  /**
   * Ban a user from the platform
   */
  async banUser(userId: number) {
    return this.client.post(`/api/v1/admin/users/${userId}/ban`, {});
  }

  /**
   * Unban a user
   */
  async unbanUser(userId: number) {
    return this.client.delete(`/api/v1/admin/users/${userId}/ban`);
  }

  /**
   * List all banned users
   */
  async listBannedUsers() {
    return this.client.get<BannedUser[]>('/api/v1/admin/users/banned');
  }

  /**
   * Delete a message (post or comment) (soft delete)
   */
  async deleteMessage(messageId: number) {
    return this.client.delete(`/api/v1/admin/messages/${messageId}`);
  }

  // ── User list ────────────────────────────────────────────────────────────

  async listUsers(page = 1, limit = 25, search = '') {
    return this.client.get<UserListResponse>(
      `/api/v1/admin/users?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`
    );
  }

  async listPendingUsers() {
    return this.client.get<User[]>('/api/v1/admin/users/pending');
  }

  async approveUser(userId: number) {
    return this.client.post(`/api/v1/admin/users/${userId}/approve`, {});
  }

  async rejectUser(userId: number) {
    return this.client.post(`/api/v1/admin/users/${userId}/reject`, {});
  }

  async getUserSessions(userId: number) {
    return this.client.get<SessionDetail[]>(`/api/v1/admin/users/${userId}/sessions`);
  }

  // ── IP bans ──────────────────────────────────────────────────────────────

  async listIPBans() {
    return this.client.get<IPBan[]>('/api/v1/admin/ip-bans');
  }

  async createIPBan(ipAddress: string, reason: string, expiresAt?: string, bannedUserId?: number) {
    return this.client.post<IPBan>('/api/v1/admin/ip-bans', {
      ip_address: ipAddress,
      reason,
      expires_at: expiresAt,
      banned_user_id: bannedUserId,
    });
  }

  async deleteIPBan(id: number) {
    return this.client.delete(`/api/v1/admin/ip-bans/${id}`);
  }

  // ── Fingerprint bans ─────────────────────────────────────────────────────

  async listFingerprintBans() {
    return this.client.get<FingerprintBan[]>('/api/v1/admin/fingerprint-bans');
  }

  async createFingerprintBan(fingerprint: string, reason: string, bannedUserId?: number) {
    return this.client.post<FingerprintBan>('/api/v1/admin/fingerprint-bans', {
      fingerprint,
      reason,
      banned_user_id: bannedUserId,
    });
  }

  async deleteFingerprintBan(id: number) {
    return this.client.delete(`/api/v1/admin/fingerprint-bans/${id}`);
  }
}
