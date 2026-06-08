import { Inject, Injectable, Scope, UnauthorizedException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import type { Request } from 'express';
import type { JwtPayload } from '@volunteerfleet/shared';

@Injectable({ scope: Scope.REQUEST })
export class TenantContext {
  constructor(@Inject(REQUEST) private request: Request) {}

  /**
   * Returns the active organization ID from the JWT payload.
   * Throws UnauthorizedException if there is no active organization in the token.
   */
  get activeOrgId(): string {
    const user = this.request.user as JwtPayload | undefined;
    if (!user?.activeOrgId) {
      throw new UnauthorizedException('No active organization in context');
    }
    return user.activeOrgId;
  }

  /**
   * Returns the organization role of the current user in the active organization, or null.
   */
  get orgRole() {
    const user = this.request.user as JwtPayload | undefined;
    return user?.orgRole ?? null;
  }

  /**
   * Checks if the current context has an active organization without throwing an error.
   */
  get hasActiveOrg(): boolean {
    const user = this.request.user as JwtPayload | undefined;
    return !!user?.activeOrgId;
  }
}
