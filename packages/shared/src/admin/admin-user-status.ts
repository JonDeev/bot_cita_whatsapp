export const ADMIN_USER_STATUSES = ['ACTIVE', 'DISABLED'] as const;

export type AdminUserStatus = (typeof ADMIN_USER_STATUSES)[number];
