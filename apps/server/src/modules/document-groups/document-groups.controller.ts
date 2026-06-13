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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
  DocumentGroupCreate,
  DocumentGroupMoveParams,
  DocumentGroupResponse,
  DocumentGroupUpdate,
  IdParam,
  JwtPayload,
} from '@volunteerfleet/shared';
import {
  documentGroupCreateSchema,
  documentGroupMoveParamsSchema,
  documentGroupUpdateSchema,
  idParamSchema,
} from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { DocumentGroupsService } from './document-groups.service.js';

@ApiTags('document-groups')
@Controller('document-groups')
export class DocumentGroupsController {
  constructor(private readonly service: DocumentGroupsService) {}

  @Post()
  @OrgRoles('coordinator', 'volunteer')
  create(
    @Body(new ZodValidationPipe(documentGroupCreateSchema)) dto: DocumentGroupCreate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentGroupResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.create(dto, user.sub, user.activeOrgId);
  }

  @Get(':id')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  findOne(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentGroupResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.findById(params.id, user.activeOrgId);
  }

  @Patch(':id')
  @OrgRoles('coordinator', 'volunteer')
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(documentGroupUpdateSchema)) dto: DocumentGroupUpdate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentGroupResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.updateName(params.id, dto.name, user.sub, user.activeOrgId);
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
    await this.service.deleteGroup(params.id, user.sub, user.activeOrgId);
  }

  @Post(':id/documents/:documentId')
  @OrgRoles('coordinator', 'volunteer')
  moveDocument(
    @Param(new ZodValidationPipe(documentGroupMoveParamsSchema)) params: DocumentGroupMoveParams,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentGroupResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.moveDocument(params.id, params.documentId, user.activeOrgId);
  }
}
