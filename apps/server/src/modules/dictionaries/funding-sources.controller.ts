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
  fundingSourceCreateSchema,
  fundingSourceUpdateSchema,
  idParamSchema,
  type FundingSource,
  type FundingSourceCreate,
  type FundingSourceUpdate,
  type IdParam,
} from '@volunteerfleet/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { FundingSourcesService } from './funding-sources.service.js';

@ApiTags('dictionaries')
@Controller('dictionaries/funding-sources')
export class FundingSourcesController {
  constructor(private readonly service: FundingSourcesService) {}

  @Get()
  list(): Promise<FundingSource[]> {
    return this.service.list();
  }

  @Post()
  @Roles('superuser')
  create(
    @Body(new ZodValidationPipe(fundingSourceCreateSchema)) dto: FundingSourceCreate,
  ): Promise<FundingSource> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('superuser')
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(fundingSourceUpdateSchema)) dto: FundingSourceUpdate,
  ): Promise<FundingSource> {
    return this.service.update(params.id, dto);
  }

  @Delete(':id')
  @Roles('superuser')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param(new ZodValidationPipe(idParamSchema)) params: IdParam): Promise<void> {
    await this.service.remove(params.id);
  }
}
