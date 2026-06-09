import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { ExchangeRatesModule } from '../exchange-rates/exchange-rates.module.js';
import { ExpensesModule } from '../expenses/expenses.module.js';
import { VehicleAlertService } from './vehicle-alert.service.js';
import { VehiclePhotosService } from './vehicle-photos.service.js';
import { VehicleTransitionService } from './vehicle-transition.service.js';
import { VehiclesController } from './vehicles.controller.js';
import { VehiclesService } from './vehicles.service.js';

@Module({
  imports: [ExpensesModule, DocumentsModule, StorageModule, ExchangeRatesModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, VehiclePhotosService, VehicleTransitionService, VehicleAlertService],
  exports: [VehiclesService, VehiclePhotosService, VehicleTransitionService, VehicleAlertService],
})
export class VehiclesModule {}
