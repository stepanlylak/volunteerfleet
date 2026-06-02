import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { VehiclePhotosService } from './vehicle-photos.service.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [ExpensesModule, DocumentsModule, StorageModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclePhotosService],
  exports: [VehiclesService, VehiclePhotosService],
})
export class VehiclesModule {}
