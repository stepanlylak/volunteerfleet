import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload, OrgRole } from '@volunteerfleet/shared';
import { ORG_ROLES_KEY } from '../decorators/org-roles.decorator.js';

/**
 * Requires an active organization in the request context for any handler
 * decorated with @OrgRoles. Handlers without @OrgRoles are not affected.
 */
@Injectable()
export class OrgContextGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const orgRoles = this.reflector.getAllAndOverride<OrgRole[] | undefined>(ORG_ROLES_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!orgRoles) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    const user = req.user;
    if (!user) throw new ForbiddenException('NO_USER');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return true;
  }
}
