import type { Request } from 'express';
import type { AdminRole, AdminUserStatus } from '@whatsapp-bot/shared';

export interface AuthenticatedAdminContext {
  sessionId: number;
  sessionTokenHash: string;
  csrfTokenHash: string | null;
  expiresAtIso: string;
  user: {
    id: number;
    email: string;
    username: string;
    displayName: string;
    role: AdminRole;
    status: AdminUserStatus;
  };
}

export interface AdminAuthRequest extends Request {
  adminAuth?: AuthenticatedAdminContext;
}
