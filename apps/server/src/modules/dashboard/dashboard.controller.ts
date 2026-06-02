import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { DashboardStats } from '@volunteerfleet/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  @Roles('admin', 'volunteer')
  getStats(): Promise<DashboardStats> {
    return this.service.getStats();
  }
}
