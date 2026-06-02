import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { ZodValidationPipe } from 'nestjs-zod';
import type { Request, Response, CookieOptions } from 'express';
import {
  loginRequestSchema,
  type LoginRequest,
  type LoginResponse,
  type MeResponse,
  type RefreshResponse,
  type AuthUser,
  type JwtPayload,
} from '@volunteerfleet/shared';
import type { Env } from '../../config/env.schema.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

const REFRESH_COOKIE = 'refresh_token';
const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE_MAX_AGE_MS = 2_592_000_000;

const TTL_UNIT_MS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };

function ttlToMs(ttl: string): number {
  const unit = ttl.slice(-1);
  return Number(ttl.slice(0, -1)) * (TTL_UNIT_MS[unit] ?? 0);
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly cfg: ConfigService<Env, true>,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  async login(
    @Body(new ZodValidationPipe(loginRequestSchema)) dto: LoginRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<LoginResponse> {
    const { response, refreshToken } = await this.auth.login(dto);
    res.cookie(REFRESH_COOKIE, refreshToken, this.cookieOptions());
    res.cookie(ACCESS_COOKIE, response.accessToken, this.accessCookieOptions());
    return response;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate refresh token and issue a new access token' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RefreshResponse> {
    const refreshToken = (req.cookies as Record<string, string> | undefined)?.[REFRESH_COOKIE];
    const { response, refreshToken: rotated } = await this.auth.refresh(refreshToken);
    res.cookie(REFRESH_COOKIE, rotated, this.cookieOptions());
    res.cookie(ACCESS_COOKIE, response.accessToken, this.accessCookieOptions());
    return response;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout — clear refresh cookie' })
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(REFRESH_COOKIE, this.cookieOptions(0));
    res.clearCookie(ACCESS_COOKIE, this.accessCookieOptions(0));
  }

  @Get('me')
  @ApiOperation({ summary: 'Return current authenticated user' })
  async me(@CurrentUser() jwtUser: JwtPayload | undefined): Promise<MeResponse> {
    if (!jwtUser) throw new NotFoundException('USER_NOT_FOUND');
    const user = await this.users.findById(jwtUser.sub);
    if (!user || !user.isActive) throw new NotFoundException('USER_NOT_FOUND');
    const authUser: AuthUser = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
    };
    return authUser;
  }

  private cookieOptions(maxAgeMs: number = REFRESH_COOKIE_MAX_AGE_MS): CookieOptions {
    const isProd = this.cfg.get('NODE_ENV', { infer: true }) === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/api/v1/auth',
      maxAge: maxAgeMs,
    };
  }

  private accessCookieOptions(maxAgeMs?: number): CookieOptions {
    const isProd = this.cfg.get('NODE_ENV', { infer: true }) === 'production';
    return {
      httpOnly: true,
      secure: isProd,
      sameSite: 'strict',
      path: '/api/v1',
      maxAge: maxAgeMs ?? ttlToMs(this.cfg.get('JWT_ACCESS_TTL', { infer: true })),
    };
  }
}
