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
  financialCategoryCreateSchema,
  financialCategoryUpdateSchema,
  idParamSchema,
  type FinancialCategory,
  type FinancialCategoryCreate,
  type FinancialCategoryUpdate,
  type IdParam,
} from '@volunteerfleet/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { FinancialCategoriesService } from './financial-categories.service.js';

@ApiTags('dictionaries')
@Controller('dictionaries/financial-categories')
export class FinancialCategoriesController {
  constructor(private readonly service: FinancialCategoriesService) {}

  @Get()
  list(): Promise<FinancialCategory[]> {
    return this.service.list();
  }

  @Post()
  @Roles('superuser')
  create(
    @Body(new ZodValidationPipe(financialCategoryCreateSchema)) dto: FinancialCategoryCreate,
  ): Promise<FinancialCategory> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('superuser')
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(financialCategoryUpdateSchema)) dto: FinancialCategoryUpdate,
  ): Promise<FinancialCategory> {
    return this.service.update(params.id, dto);
  }

  @Delete(':id')
  @Roles('superuser')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param(new ZodValidationPipe(idParamSchema)) params: IdParam): Promise<void> {
    await this.service.remove(params.id);
  }
}
