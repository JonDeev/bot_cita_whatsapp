import type { AdminAuthUserRecord } from '../admin-auth.types';

export interface AdminAuthUserRepository {
  findByEmail(email: string): Promise<AdminAuthUserRecord | null>;
  findByUsername(username: string): Promise<AdminAuthUserRecord | null>;
}
