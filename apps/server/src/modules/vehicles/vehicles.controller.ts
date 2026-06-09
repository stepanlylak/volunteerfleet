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
  DocumentListResponse,
  ExpenseListResponse,
  JwtPayload,
  VehicleCreate,
  VehicleListQuery,
  VehiclePhotoListResponse,
  VehiclePhotoOrderUpdate,
  VehiclePhotoResponse,
  VehiclePhotoUploadMetadata,
  VehicleListResponse,
  VehicleResponse,
  VehicleStatusHistoryListResponse,
  VehicleUpdate,
} from '@volunteerfleet/shared';
import {
  vehicleDocumentsQuerySchema,
  vehicleExpensesQuerySchema,
  idParamSchema,
  vehicleCreateSchema,
  vehicleListQuerySchema,
  vehiclePhotoOrderUpdateSchema,
  vehiclePhotoUploadMetadataSchema,
  vehicleUpdateSchema,
  vehicleTransitionRequestSchema,
  type IdParam,
  type VehicleDocumentsQuery,
  type VehicleExpensesQuery,
  type VehicleTransitionRequest,
} from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import type { Env } from '../../config/env.schema.js';
import { DocumentsService } from '../documents/documents.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { VehiclePhotosService } from './vehicle-photos.service.js';
import { VehicleTransitionService } from './vehicle-transition.service.js';
import { VehiclesService } from './vehicles.service.js';

@ApiTags('vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly service: VehiclesService,
    private readonly transitionService: VehicleTransitionService,
    private readonly expensesService: ExpensesService,
    private readonly documentsService: DocumentsService,
    private readonly photosService: VehiclePhotosService,
    private readonly cfg: ConfigService<Env, true>,
  ) {}

  @Get()
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  list(
    @Query(new ZodValidationPipe(vehicleListQuerySchema)) query: VehicleListQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleListResponse> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.list(query, user.orgRole, user.activeOrgId);
  }

  @Post()
  @OrgRoles('coordinator', 'volunteer')
  async create(
    @Body(new ZodValidationPipe(vehicleCreateSchema)) dto: VehicleCreate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.create(dto, user.sub, user.activeOrgId);
  }

  @Get(':id')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  async findOne(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query('includeDeleted') includeDeleted: string | undefined,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleResponse> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    const canIncludeDeleted = user.orgRole === 'coordinator' && includeDeleted === 'true';
    return this.service.findById(params.id, user.activeOrgId, canIncludeDeleted);
  }

  @Patch(':id')
  @OrgRoles('coordinator', 'volunteer')
  async update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(vehicleUpdateSchema)) dto: VehicleUpdate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleResponse> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');

    // Coordinator can edit public fields, volunteer cannot
    if (user.orgRole !== 'coordinator') {
      delete (dto as Partial<VehicleUpdate>).isPublic;
      delete (dto as Partial<VehicleUpdate>).publicSummary;
      delete (dto as Partial<VehicleUpdate>).publicCollectedAmountUah;
      delete (dto as Partial<VehicleUpdate>).publicGoalAmountUah;
    }

    return this.service.update(params.id, dto, user.sub, user.activeOrgId);
  }

  @Delete(':id')
  @OrgRoles('coordinator')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<void> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    await this.service.softDelete(params.id, user.sub, user.activeOrgId);
  }

  @Post(':id/restore')
  @OrgRoles('coordinator')
  async restore(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleResponse> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.restore(params.id, user.activeOrgId);
  }

  @Post(':id/transition')
  @OrgRoles('coordinator', 'volunteer')
  async transition(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(vehicleTransitionRequestSchema)) dto: VehicleTransitionRequest,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.transitionService.transition(params.id, user.sub, user.activeOrgId, dto);
  }

  @Get(':id/status-history')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  async getStatusHistory(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleStatusHistoryListResponse> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.getStatusHistory(params.id, user.activeOrgId);
  }

  @Get(':id/expenses')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  async getExpenses(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query(new ZodValidationPipe(vehicleExpensesQuerySchema)) query: VehicleExpensesQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<ExpenseListResponse> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    await this.service.findById(params.id, user.activeOrgId);
    return this.expensesService.list(
      { ...query, vehicleId: params.id },
      user.orgRole,
      user.activeOrgId,
    );
  }

  @Get(':id/documents')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  async getDocuments(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query(new ZodValidationPipe(vehicleDocumentsQuerySchema)) query: VehicleDocumentsQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentListResponse> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    await this.service.findById(params.id, user.activeOrgId);
    return this.documentsService.list(
      { ...query, vehicleId: params.id },
      user.orgRole,
      user.activeOrgId,
    );
  }

  @Get(':id/photos')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  async getPhotos(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehiclePhotoListResponse> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.photosService.list(params.id, user.activeOrgId);
  }

  @Post(':id/photos')
  @OrgRoles('coordinator', 'volunteer')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 26214400 },
    }),
  )
  uploadPhoto(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodValidationPipe(vehiclePhotoUploadMetadataSchema)) dto: VehiclePhotoUploadMetadata,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehiclePhotoResponse> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.photosService.upload(
      params.id,
      file,
      dto,
      user.sub,
      this.cfg.get('MAX_UPLOAD_BYTES', { infer: true }),
      user.activeOrgId,
    );
  }

  @Patch(':id/photos/order')
  @OrgRoles('coordinator', 'volunteer')
  reorderPhotos(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(vehiclePhotoOrderUpdateSchema)) dto: VehiclePhotoOrderUpdate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehiclePhotoListResponse> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.photosService.reorder(params.id, dto, user.sub, user.activeOrgId);
  }

  @Get(':id/photos/:photoId/download')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  async downloadPhoto(
    @Param('photoId') photoId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { body, contentType, contentLength } =
      await this.photosService.getDownloadStream(photoId);
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'private, max-age=300',
      ...(contentLength != null ? { 'Content-Length': String(contentLength) } : {}),
    });
    return new StreamableFile(body);
  }

  @Delete(':id/photos/:photoId')
  @OrgRoles('coordinator', 'volunteer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePhoto(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Param('photoId') photoId: string,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<void> {
    if (!user?.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    await this.photosService.remove(params.id, photoId, user, user.activeOrgId);
  }
}
