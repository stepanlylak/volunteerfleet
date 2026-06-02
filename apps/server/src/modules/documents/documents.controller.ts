import {
  Body,
  Controller,
  Delete,
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
import { Roles } from '../../common/decorators/roles.decorator.js';
import { DocumentsService } from './documents.service.js';

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly service: DocumentsService,
    private readonly cfg: ConfigService<Env, true>,
  ) {}

  @Get()
  @Roles('admin', 'volunteer')
  list(
    @Query(new ZodValidationPipe(documentListQuerySchema)) query: DocumentListQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentListResponse> {
    return this.service.list(query, user?.role ?? 'volunteer');
  }

  @Post('upload')
  @Roles('admin', 'volunteer')
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
    return this.service.upload(
      file,
      dto,
      user.sub,
      this.cfg.get('MAX_UPLOAD_BYTES', { infer: true }),
    );
  }

  @Patch(':id/upload')
  @Roles('admin', 'volunteer')
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
    return this.service.replaceUpload(
      params.id,
      file,
      dto,
      user,
      this.cfg.get('MAX_UPLOAD_BYTES', { infer: true }),
    );
  }

  @Post('link')
  @Roles('admin', 'volunteer')
  createLink(
    @Body(new ZodValidationPipe(documentLinkCreateSchema)) dto: DocumentLinkCreate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentResponse> {
    if (!user) throw new Error('User required');
    return this.service.createLink(dto, user.sub);
  }

  @Get(':id')
  @Roles('admin', 'volunteer')
  findOne(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query('includeDeleted') includeDeleted: string | undefined,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentResponse> {
    const canIncludeDeleted = user?.role === 'admin' && includeDeleted === 'true';
    return this.service.findById(params.id, canIncludeDeleted);
  }

  @Get(':id/download')
  @Roles('admin', 'volunteer')
  async download(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile | undefined> {
    const result = await this.service.getDownload(params.id);
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
  @Roles('admin', 'volunteer')
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(documentUpdateSchema)) dto: DocumentUpdate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentResponse> {
    if (!user) throw new Error('User required');
    return this.service.update(params.id, dto, user);
  }

  @Delete(':id')
  @Roles('admin', 'volunteer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<void> {
    if (!user) throw new Error('User required');
    await this.service.softDelete(params.id, user);
  }

  @Post(':id/restore')
  @Roles('admin')
  restore(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentResponse> {
    if (!user) throw new Error('User required');
    return this.service.restore(params.id, user.sub);
  }
}
