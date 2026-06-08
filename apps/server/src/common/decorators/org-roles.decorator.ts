import { SetMetadata } from '@nestjs/common';
import type { OrgRole } from '@volunteerfleet/shared';

export const ORG_ROLES_KEY = 'orgRoles';
export const OrgRoles = (...roles: OrgRole[]) => SetMetadata(ORG_ROLES_KEY, roles);
