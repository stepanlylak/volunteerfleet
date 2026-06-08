export const ROLES = ['admin', 'volunteer', 'guest'] as const;

export type Role = (typeof ROLES)[number];

export const ORG_ROLES = ['coordinator', 'volunteer', 'viewer'] as const;

export type OrgRole = (typeof ORG_ROLES)[number];
