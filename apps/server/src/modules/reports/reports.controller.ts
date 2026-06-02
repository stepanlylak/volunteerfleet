import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
  FundingSourceReportQuery,
  FundingSourceReportResponse,
  IdParam,
  VehicleReportResponse,
} from '@volunteerfleet/shared';
import { fundingSourceReportQuerySchema, idParamSchema } from '@volunteerfleet/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('vehicle/:id')
  @Roles('admin', 'volunteer')
  vehicleReport(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<VehicleReportResponse> {
    return this.service.getVehicleReport(params.id);
  }

  @Get('funding-source/:id')
  @Roles('admin', 'volunteer')
  fundingSourceReport(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query(new ZodValidationPipe(fundingSourceReportQuerySchema))
    query: FundingSourceReportQuery,
  ): Promise<FundingSourceReportResponse> {
    return this.service.getFundingSourceReport(params.id, query);
  }
}
