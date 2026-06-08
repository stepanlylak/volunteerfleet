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
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { ReportsService } from './reports.service.js';

@ApiTags('reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly service: ReportsService) {}

  @Get('vehicle/:id')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  vehicleReport(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<VehicleReportResponse> {
    return this.service.getVehicleReport(params.id);
  }

  @Get('funding-source/:id')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  fundingSourceReport(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query(new ZodValidationPipe(fundingSourceReportQuerySchema))
    query: FundingSourceReportQuery,
  ): Promise<FundingSourceReportResponse> {
    return this.service.getFundingSourceReport(params.id, query);
  }
}
