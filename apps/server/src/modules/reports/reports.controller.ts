import { Controller, ForbiddenException, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import type { IdParam, JwtPayload, VehicleReportResponse } from '@volunteerfleet/shared';
import { idParamSchema } from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
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
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<VehicleReportResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.getVehicleReport(params.id, user.activeOrgId);
  }
}
