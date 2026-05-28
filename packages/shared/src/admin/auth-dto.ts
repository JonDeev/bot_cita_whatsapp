import type { AdminRole } from './admin-role.js';
import type { AdminUserStatus } from './admin-user-status.js';

export interface AdminAuthMeResponseDto {
  id: number;
  email: string;
  username: string;
  displayName: string;
  role: AdminRole;
  status: AdminUserStatus;
}

export interface AdminLoginRequestDto {
  identifier: string;
  password: string;
}

export interface AdminLoginResponseDto {
  user: AdminAuthMeResponseDto;
}
