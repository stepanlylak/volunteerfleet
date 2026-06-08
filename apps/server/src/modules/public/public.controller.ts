import { Controller, Get, Header, Param, Query, Res, StreamableFile } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
  FundingSourceReportQuery,
  IdParam,
  PublicFundingReportResponse,
  PublicReportParams,
  PublicVehicleParams,
  PublicVehicleResponse,
} from '@volunteerfleet/shared';
import {
  fundingSourceReportQuerySchema,
  idParamSchema,
  publicReportParamsSchema,
  publicVehicleParamsSchema,
} from '@volunteerfleet/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { PublicService } from './public.service.js';

@ApiTags('public')
@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly service: PublicService) {}

  @Get(':orgId/vehicles/:vehicleId')
  @Header('Access-Control-Allow-Origin', '*')
  vehicle(
    @Param(new ZodValidationPipe(publicVehicleParamsSchema)) params: PublicVehicleParams,
  ): Promise<PublicVehicleResponse> {
    return this.service.getVehicleById(params.orgId, params.vehicleId);
  }

  @Get(':orgId/reports/funding/:id')
  @Header('Access-Control-Allow-Origin', '*')
  fundingReport(
    @Param(new ZodValidationPipe(publicReportParamsSchema)) params: PublicReportParams,
    @Query(new ZodValidationPipe(fundingSourceReportQuerySchema))
    query: FundingSourceReportQuery,
  ): Promise<PublicFundingReportResponse> {
    return this.service.getFundingReport(params.orgId, params.id, query);
  }

  @Get('vehicle-photos/:id/download')
  @Header('Access-Control-Allow-Origin', '*')
  async vehiclePhoto(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { body, contentType, contentLength } = await this.service.getPhotoDownloadStream(
      params.id,
    );
    res.set({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=300',
      ...(contentLength != null ? { 'Content-Length': String(contentLength) } : {}),
    });
    return new StreamableFile(body);
  }
}
