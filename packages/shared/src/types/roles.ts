export const ROLES = ['admin', 'volunteer', 'guest'] as const;

export type Role = (typeof ROLES)[number];
