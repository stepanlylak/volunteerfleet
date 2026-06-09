import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
  DonorCreate,
  DonorLink,
  DonorListQuery,
  DonorListResponse,
  DonorResolveResponse,
  DonorResponse,
  JwtPayload,
} from '@volunteerfleet/shared';
import {
  donorCreateSchema,
  donorLinkSchema,
  donorListQuerySchema,
  idParamSchema,
  type IdParam,
} from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { DonorsService } from './donors.service.js';

@ApiTags('donors')
@Controller('donors')
export class DonorsController {
  constructor(private readonly service: DonorsService) {}

  @Get()
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  list(
    @Query(new ZodValidationPipe(donorListQuerySchema)) query: DonorListQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DonorListResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.list(query, user.activeOrgId);
  }

  @Post()
  @OrgRoles('coordinator', 'volunteer')
  create(
    @Body(new ZodValidationPipe(donorCreateSchema)) dto: DonorCreate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DonorResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.create(dto, user.sub, user.activeOrgId);
  }

  @Get('resolve/:id')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  resolve(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DonorResolveResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.resolve(params.id, user.activeOrgId);
  }

  @Post('link')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  link(
    @Body(new ZodValidationPipe(donorLinkSchema)) dto: DonorLink,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DonorResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.link(dto, user.sub, user.activeOrgId);
  }

  @Delete(':id/link')
  @OrgRoles('coordinator')
  @HttpCode(HttpStatus.NO_CONTENT)
  async unlink(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<void> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    await this.service.unlink(params.id, user.sub, user.activeOrgId);
  }
}
