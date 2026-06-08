import { Controller, ForbiddenException, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { DashboardStats, JwtPayload } from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { DashboardService } from './dashboard.service.js';

@ApiTags('dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly service: DashboardService) {}

  @Get('stats')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  getStats(@CurrentUser() user: JwtPayload | undefined): Promise<DashboardStats> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.getStats(user.activeOrgId);
  }
}
