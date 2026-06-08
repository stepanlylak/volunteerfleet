import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload, OrgRole } from '@volunteerfleet/shared';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator.js';

/**
 * Authorizes org-scoped handlers by the caller's role in the active
 * organization (`orgRole`). Handlers without @OrgRoles are not affected;
 * presence of `activeOrgId` is enforced separately by OrgContextGuard.
 */
@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<OrgRole[] | undefined>(ORG_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('NO_USER');
    if (!user.orgRole || !required.includes(user.orgRole)) {
      throw new ForbiddenException('INSUFFICIENT_ORG_ROLE');
    }
    return true;
  }
}
