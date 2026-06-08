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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import type {
  ExpenseCreate,
  ExpenseListQuery,
  ExpenseListResponse,
  ExpenseResponse,
  ExpenseUpdate,
  JwtPayload,
} from '@volunteerfleet/shared';
import {
  expenseCreateSchema,
  expenseListQuerySchema,
  expenseUpdateSchema,
  idParamSchema,
  type IdParam,
} from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { ExpensesService } from './expenses.service.js';

@ApiTags('expenses')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly service: ExpensesService) {}

  @Get()
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  list(
    @Query(new ZodValidationPipe(expenseListQuerySchema)) query: ExpenseListQuery,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<ExpenseListResponse> {
    return this.service.list(query, user?.orgRole);
  }

  @Post()
  @OrgRoles('coordinator', 'volunteer')
  create(
    @Body(new ZodValidationPipe(expenseCreateSchema)) dto: ExpenseCreate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<ExpenseResponse> {
    if (!user) throw new Error('User required');
    if (!user.activeOrgId) throw new ForbiddenException('NO_ACTIVE_ORG');
    return this.service.create(dto, user.sub, user.activeOrgId);
  }

  @Get(':id')
  @OrgRoles('coordinator', 'volunteer', 'viewer')
  findOne(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Query('includeDeleted') includeDeleted: string | undefined,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<ExpenseResponse> {
    const canIncludeDeleted = user?.orgRole === 'coordinator' && includeDeleted === 'true';
    return this.service.findById(params.id, canIncludeDeleted);
  }

  @Patch(':id')
  @OrgRoles('coordinator', 'volunteer')
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(expenseUpdateSchema)) dto: ExpenseUpdate,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<ExpenseResponse> {
    if (!user) throw new Error('User required');
    return this.service.update(params.id, dto, user.sub);
  }

  @Delete(':id')
  @OrgRoles('coordinator')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<void> {
    if (!user) throw new Error('User required');
    await this.service.softDelete(params.id, user.sub);
  }

  @Post(':id/restore')
  @OrgRoles('coordinator')
  restore(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @CurrentUser() user: JwtPayload | undefined,
  ): Promise<ExpenseResponse> {
    if (!user) throw new Error('User required');
    return this.service.restore(params.id, user.sub);
  }
}
