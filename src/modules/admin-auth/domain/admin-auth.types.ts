import type { AdminRole, AdminUserStatus } from '@whatsapp-bot/shared';

export interface AdminAuthUserRecord {
  id: number;
  email: string;
  username: string;
  displayName: string;
  passwordHash: string;
  role: AdminRole;
  status: AdminUserStatus;
}

export interface AdminAuthSessionRecord {
  id: number;
  userId: number;
  sessionTokenHash: string;
  csrfTokenHash: string | null;
  ipHash: string | null;
  userAgent: string | null;
  lastSeenAt: string | null;
  expiresAt: string;
  revokedAt: string | null;
}

export interface AdminSessionContext {
  session: AdminAuthSessionRecord;
  user: Omit<AdminAuthUserRecord, 'passwordHash'>;
}

export interface CreateAdminSessionInput {
  userId: number;
  sessionTokenHash: string;
  csrfTokenHash: string | null;
  ipHash: string | null;
  userAgent: string | null;
  expiresAtIso: string;
}
