import { Controller, Get, Header, HttpStatus, Param, Query, Redirect } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
  FundingSourceReportQuery,
  IdParam,
  PublicFundingReportResponse,
  PublicSlugParam,
  PublicVehicleResponse,
} from '@volunteerfleet/shared';
import {
  fundingSourceReportQuerySchema,
  idParamSchema,
  publicSlugParamSchema,
} from '@volunteerfleet/shared';
import { Public } from '../../common/decorators/public.decorator.js';
import { PublicService } from './public.service.js';

@ApiTags('public')
@Public()
@Controller('public')
export class PublicController {
  constructor(private readonly service: PublicService) {}

  @Get('vehicles/:slug')
  @Header('Access-Control-Allow-Origin', '*')
  vehicle(
    @Param(new ZodValidationPipe(publicSlugParamSchema)) params: PublicSlugParam,
  ): Promise<PublicVehicleResponse> {
    return this.service.getVehicleBySlug(params.slug);
  }

  @Get('reports/funding/:id')
  @Header('Access-Control-Allow-Origin', '*')
  fundingReport(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query(new ZodValidationPipe(fundingSourceReportQuerySchema))
    query: FundingSourceReportQuery,
  ): Promise<PublicFundingReportResponse> {
    return this.service.getFundingReport(params.id, query);
  }

  @Get('vehicle-photos/:id/download')
  @Header('Access-Control-Allow-Origin', '*')
  @Redirect('', HttpStatus.FOUND)
  async vehiclePhoto(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<{ url: string; statusCode: number }> {
    return { url: await this.service.getPhotoDownloadUrl(params.id), statusCode: HttpStatus.FOUND };
  }
}
