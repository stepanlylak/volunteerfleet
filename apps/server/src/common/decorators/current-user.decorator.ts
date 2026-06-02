import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { JwtPayload } from '@volunteerfleet/shared';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): JwtPayload | undefined => {
    const req = ctx.switchToHttp().getRequest<Request & { user?: JwtPayload }>();
    return req.user;
  },
);
