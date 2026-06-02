import { Module } from '@nestjs/common';
import { ReportsModule } from '../reports/reports.module.js';
import { VehiclesModule } from '../vehicles/vehicles.module.js';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';

@Module({
  imports: [ReportsModule, VehiclesModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
