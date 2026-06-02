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
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  expenseCategoryCreateSchema,
  expenseCategoryUpdateSchema,
  idParamSchema,
  type ExpenseCategory,
  type ExpenseCategoryCreate,
  type ExpenseCategoryUpdate,
  type IdParam,
} from '@volunteerfleet/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ExpenseCategoriesService } from './expense-categories.service.js';

@ApiTags('dictionaries')
@Controller('dictionaries/expense-categories')
export class ExpenseCategoriesController {
  constructor(private readonly service: ExpenseCategoriesService) {}

  @Get()
  @Roles('admin', 'volunteer', 'guest')
  list(): Promise<ExpenseCategory[]> {
    return this.service.list();
  }

  @Post()
  @Roles('admin')
  create(
    @Body(new ZodValidationPipe(expenseCategoryCreateSchema)) dto: ExpenseCategoryCreate,
  ): Promise<ExpenseCategory> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(expenseCategoryUpdateSchema)) dto: ExpenseCategoryUpdate,
  ): Promise<ExpenseCategory> {
    return this.service.update(params.id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param(new ZodValidationPipe(idParamSchema)) params: IdParam): Promise<void> {
    await this.service.remove(params.id);
  }
}
