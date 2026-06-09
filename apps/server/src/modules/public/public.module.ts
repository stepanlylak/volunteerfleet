import { Module } from '@nestjs/common';
import { VehiclesModule } from '../vehicles/vehicles.module.js';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';

@Module({
  imports: [VehiclesModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
