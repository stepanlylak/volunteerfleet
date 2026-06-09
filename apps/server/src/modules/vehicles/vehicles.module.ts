import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { VehicleAlertService } from './vehicle-alert.service.js';
import { VehicleGalleriesService } from './vehicle-galleries.service.js';
import { VehiclePhotosService } from './vehicle-photos.service.js';
import { VehicleTransitionService } from './vehicle-transition.service.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [ExpensesModule, DocumentsModule, StorageModule],
  controllers: [VehiclesController],
  providers: [
    VehiclesService,
    VehiclePhotosService,
    VehicleGalleriesService,
    VehicleTransitionService,
    VehicleAlertService,
  ],
  exports: [
    VehiclesService,
    VehiclePhotosService,
    VehicleGalleriesService,
    VehicleTransitionService,
    VehicleAlertService,
  ],
})
export class VehiclesModule {}
