export const ADMIN_ROLES = ['ADMIN', 'SUPERVISOR', 'ASESOR'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];
