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
  Redirect,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
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
  type IdParam,
  type VehicleDocumentsQuery,
  type VehicleExpensesQuery,
} from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { Env } from '../../config/env.schema.js';
import { DocumentsService } from '../documents/documents.service.js';
import { ExpensesService } from '../expenses/expenses.service.js';
import { VehiclePhotosService } from './vehicle-photos.service.js';
import { VehiclesService } from './vehicles.service.js';

@ApiTags('vehicles')
@Controller('vehicles')
export class VehiclesController {
  constructor(
    private readonly service: VehiclesService,
    private readonly expensesService: ExpensesService,
    private readonly documentsService: DocumentsService,
    private readonly photosService: VehiclePhotosService,
    private readonly cfg: ConfigService<Env, true>,
  ) {}

  @Get()
  @Roles('admin', 'volunteer', 'guest')
  list(
    @Query(new ZodValidationPipe(vehicleListQuerySchema)) query: VehicleListQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleListResponse> {
    return this.service.list(query, user?.role ?? 'guest');
  }

  @Post()
  @Roles('admin', 'volunteer')
  async create(
    @Body(new ZodValidationPipe(vehicleCreateSchema)) dto: VehicleCreate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleResponse> {
    if (!user) throw new Error('User required');
    return this.service.create(dto, user.sub);
  }

  @Get(':id')
  @Roles('admin', 'volunteer', 'guest')
  async findOne(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query('includeDeleted') includeDeleted: string | undefined,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleResponse> {
    const canIncludeDeleted = user?.role === 'admin' && includeDeleted === 'true';
    return this.service.findById(params.id, canIncludeDeleted);
  }

  @Patch(':id')
  @Roles('admin', 'volunteer')
  async update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(vehicleUpdateSchema)) dto: VehicleUpdate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleResponse> {
    if (!user) throw new Error('User required');

    // Admin can edit public fields, volunteer cannot
    if (user.role !== 'admin') {
      delete (dto as Partial<VehicleUpdate>).isPublic;
      delete (dto as Partial<VehicleUpdate>).publicSlug;
      delete (dto as Partial<VehicleUpdate>).publicSummary;
      delete (dto as Partial<VehicleUpdate>).publicCollectedAmountUah;
      delete (dto as Partial<VehicleUpdate>).publicGoalAmountUah;
    }

    return this.service.update(params.id, dto, user.sub);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<void> {
    if (!user) throw new Error('User required');
    await this.service.softDelete(params.id, user.sub);
  }

  @Post(':id/restore')
  @Roles('admin')
  async restore(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<VehicleResponse> {
    return this.service.restore(params.id);
  }

  @Get(':id/status-history')
  @Roles('admin', 'volunteer', 'guest')
  async getStatusHistory(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<VehicleStatusHistoryListResponse> {
    return this.service.getStatusHistory(params.id);
  }

  @Get(':id/expenses')
  @Roles('admin', 'volunteer')
  async getExpenses(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query(new ZodValidationPipe(vehicleExpensesQuerySchema)) query: VehicleExpensesQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<ExpenseListResponse> {
    await this.service.findById(params.id);
    return this.expensesService.list({ ...query, vehicleId: params.id }, user?.role ?? 'volunteer');
  }

  @Get(':id/documents')
  @Roles('admin', 'volunteer')
  async getDocuments(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query(new ZodValidationPipe(vehicleDocumentsQuerySchema)) query: VehicleDocumentsQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<DocumentListResponse> {
    await this.service.findById(params.id);
    return this.documentsService.list(
      { ...query, vehicleId: params.id },
      user?.role ?? 'volunteer',
    );
  }

  @Get(':id/photos')
  @Roles('admin', 'volunteer')
  async getPhotos(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<VehiclePhotoListResponse> {
    return this.photosService.list(params.id);
  }

  @Post(':id/photos')
  @Roles('admin', 'volunteer')
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
    if (!user) throw new Error('User required');
    return this.photosService.upload(
      params.id,
      file,
      dto,
      user.sub,
      this.cfg.get('MAX_UPLOAD_BYTES', { infer: true }),
    );
  }

  @Patch(':id/photos/order')
  @Roles('admin', 'volunteer')
  reorderPhotos(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(vehiclePhotoOrderUpdateSchema)) dto: VehiclePhotoOrderUpdate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehiclePhotoListResponse> {
    if (!user) throw new Error('User required');
    return this.photosService.reorder(params.id, dto, user.sub);
  }

  @Get(':id/photos/:photoId/download')
  @Roles('admin', 'volunteer')
  @Redirect('', HttpStatus.FOUND)
  async downloadPhoto(
    @Param('photoId') photoId: string,
  ): Promise<{ url: string; statusCode: number }> {
    return {
      url: await this.photosService.getDownloadUrl(photoId),
      statusCode: HttpStatus.FOUND,
    };
  }

  @Delete(':id/photos/:photoId')
  @Roles('admin', 'volunteer')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removePhoto(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Param('photoId') photoId: string,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<void> {
    if (!user) throw new Error('User required');
    await this.photosService.remove(params.id, photoId, user);
  }
}
