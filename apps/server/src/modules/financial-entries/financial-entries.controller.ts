import { Controller, ForbiddenException, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
  FinancialEntryListQuery,
  FinancialEntryListResponse,
  JwtPayload,
} from '@volunteerfleet/shared';
import { financialEntryListQuerySchema } from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { FinancialEntriesService } from './financial-entries.service.js';

@ApiTags('financial-entries')
@Controller('financial-entries')
export class FinancialEntriesController {
  constructor(private readonly service: FinancialEntriesService) {}

  @Get()
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  list(
    @Query(new ZodValidationPipe(financialEntryListQuerySchema)) query: FinancialEntryListQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<FinancialEntryListResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.list(query, user.activeOrgId);
  }
}
