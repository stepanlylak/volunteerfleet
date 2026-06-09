import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
  DonationCreate,
  DonationListQuery,
  DonationListResponse,
  DonationResponse,
  DonationUpdate,
  JwtPayload,
} from '@volunteerfleet/shared';
import {
  donationCreateSchema,
  donationListQuerySchema,
  donationUpdateSchema,
  idParamSchema,
  type IdParam,
} from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { DonationsService } from './donations.service.js';

@ApiTags('donations')
@Controller('donations')
export class DonationsController {
  constructor(private readonly service: DonationsService) {}

  @Get()
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  list(
    @Query(new ZodValidationPipe(donationListQuerySchema)) query: DonationListQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DonationListResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.list(query, user.orgRole, user.activeOrgId);
  }

  @Post()
  @OrgRoles('coordinator', 'volunteer')
  create(
    @Body(new ZodValidationPipe(donationCreateSchema)) dto: DonationCreate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DonationResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.create(dto, user.sub, user.activeOrgId);
  }

  @Get(':id')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  findOne(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query('includeDeleted') includeDeleted: string | undefined,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DonationResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    const canIncludeDeleted = user.orgRole === 'coordinator' && includeDeleted === 'true';
    return this.service.findById(params.id, user.activeOrgId, canIncludeDeleted);
  }

  @Patch(':id')
  @OrgRoles('coordinator', 'volunteer')
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(donationUpdateSchema)) dto: DonationUpdate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DonationResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.update(params.id, dto, user.sub, user.activeOrgId);
  }

  @Delete(':id')
  @OrgRoles('coordinator')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<void> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    await this.service.softDelete(params.id, user.sub, user.activeOrgId);
  }

  @Post(':id/restore')
  @OrgRoles('coordinator')
  restore(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DonationResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.restore(params.id, user.sub, user.activeOrgId);
  }
}
