import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import type { JwtPayload } from '@volunteerfleet/shared';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator.js';
import type { Env } from '../../config/env.schema.js';

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null;
  return token;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly cfg: ConfigService<Env, true>,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request>();
    const cookieToken = (req.cookies as Record<string, string> | undefined)?.access_token;
    const token = extractBearer(req.headers.authorization) ?? cookieToken ?? null;
    if (!token) throw new UnauthorizedException('NO_TOKEN');

    try {
      const payload = this.jwt.verify<JwtPayload>(token, {
        secret: this.cfg.get('JWT_ACCESS_SECRET', { infer: true }),
      });
      (req as Request & { user: JwtPayload }).user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('INVALID_TOKEN');
    }
  }
}
