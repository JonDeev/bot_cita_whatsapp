import type {
  AdminSessionContext,
  CreateAdminSessionInput,
} from '../admin-auth.types';

export interface AdminAuthSessionRepository {
  create(input: CreateAdminSessionInput): Promise<number>;
  findActiveByTokenHash(
    sessionTokenHash: string,
    nowIso: string,
  ): Promise<AdminSessionContext | null>;
  updateCsrfTokenHash(
    sessionId: number,
    csrfTokenHash: string,
  ): Promise<void>;
  revokeByTokenHash(sessionTokenHash: string, revokedAtIso: string): Promise<void>;
  touchLastSeen(sessionId: number, seenAtIso: string): Promise<void>;
}
