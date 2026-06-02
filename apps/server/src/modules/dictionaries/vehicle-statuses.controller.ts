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
  idParamSchema,
  vehicleStatusCreateSchema,
  vehicleStatusUpdateSchema,
  type IdParam,
  type VehicleStatus,
  type VehicleStatusCreate,
  type VehicleStatusUpdate,
} from '@volunteerfleet/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { VehicleStatusesService } from './vehicle-statuses.service.js';

@ApiTags('dictionaries')
@Controller('dictionaries/vehicle-statuses')
export class VehicleStatusesController {
  constructor(private readonly service: VehicleStatusesService) {}

  @Get()
  @Roles('admin', 'volunteer', 'guest')
  list(): Promise<VehicleStatus[]> {
    return this.service.list();
  }

  @Post()
  @Roles('admin')
  create(
    @Body(new ZodValidationPipe(vehicleStatusCreateSchema)) dto: VehicleStatusCreate,
  ): Promise<VehicleStatus> {
    return this.service.create(dto);
  }

  @Patch(':id')
  @Roles('admin')
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(vehicleStatusUpdateSchema)) dto: VehicleStatusUpdate,
  ): Promise<VehicleStatus> {
    return this.service.update(params.id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param(new ZodValidationPipe(idParamSchema)) params: IdParam): Promise<void> {
    await this.service.remove(params.id);
  }
}
