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
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
  DocumentLinkCreate,
  DocumentListQuery,
  DocumentListResponse,
  DocumentResponse,
  DocumentUpdate,
  DocumentUploadMetadata,
  DocumentUploadReplaceMetadata,
  JwtPayload,
} from '@volunteerfleet/shared';
import {
  documentLinkCreateSchema,
  documentListQuerySchema,
  documentUpdateSchema,
  documentUploadMetadataSchema,
  documentUploadReplaceMetadataSchema,
  idParamSchema,
  type IdParam,
} from '@volunteerfleet/shared';
import type { Env } from '../../config/env.schema.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { DocumentsService } from './documents.service.js';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly cfg: ConfigService<Env, true>,
  ) {}

  @Get()
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  list(
    @Query(new ZodValidationPipe(documentListQuerySchema)) query: DocumentListQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentListResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.list(query, user.orgRole, user.activeOrgId);
  }

  @Post('upload')
  @OrgRoles('coordinator', 'volunteer')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 26214400 },
    }),
  )
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(documentUploadMetadataSchema)) dto: DocumentUploadMetadata,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.upload(
      file,
      dto,
      user.sub,
      user.activeOrgId,
      this.cfg.get('MAX_UPLOAD_BYTES', { infer: true }),
    );
  }

  @Patch(':id/upload')
  @OrgRoles('coordinator', 'volunteer')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 26214400 },
    }),
  )
  replaceUpload(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(documentUploadReplaceMetadataSchema))
    dto: DocumentUploadReplaceMetadata,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.replaceUpload(
      params.id,
      file,
      dto,
      user,
      this.cfg.get('MAX_UPLOAD_BYTES', { infer: true }),
      user.activeOrgId,
    );
  }

  @Post('link')
  @OrgRoles('coordinator', 'volunteer')
  createLink(
    @Body(new ZodValidationPipe(documentLinkCreateSchema)) dto: DocumentLinkCreate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.createLink(dto, user.sub, user.activeOrgId);
  }

  @Get(':id')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  findOne(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query('includeDeleted') includeDeleted: string | undefined,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    const canIncludeDeleted = user.orgRole === 'coordinator' && includeDeleted === 'true';
    return this.service.findById(params.id, user.activeOrgId, canIncludeDeleted);
  }

  @Get(':id/download')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  async download(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Res({ passthrough: true }) res: Response,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<StreamableFile | undefined> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    const result = await this.service.getDownload(params.id, user.activeOrgId);
    if (result.kind === 'link') {
      res.redirect(HttpStatus.FOUND, result.url);
      return undefined;
    }
    res.set({
      'Content-Type': result.contentType,
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(result.fileName)}`,
      ...(result.contentLength != null ? { 'Content-Length': String(result.contentLength) } : {}),
    });
    return new StreamableFile(result.body);
  }

  @Patch(':id')
  @OrgRoles('coordinator', 'volunteer')
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(documentUpdateSchema)) dto: DocumentUpdate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.update(params.id, dto, user, user.activeOrgId);
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
    await this.service.softDelete(params.id, user, user.activeOrgId);
  }

  @Post(':id/restore')
  @OrgRoles('coordinator')
  restore(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.restore(params.id, user.sub, user.activeOrgId);
  }
}
