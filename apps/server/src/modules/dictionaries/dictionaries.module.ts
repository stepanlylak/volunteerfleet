import { Module } from '@nestjs/common';
import { ExpenseCategoriesController } from './expense-categories.controller.js';
import { ExpenseCategoriesService } from './expense-categories.service.js';
import { FundingSourcesController } from './funding-sources.controller.js';
import { FundingSourcesService } from './funding-sources.service.js';
import { VehicleStatusesController } from './vehicle-statuses.controller.js';
import { VehicleStatusesService } from './vehicle-statuses.service.js';

@Module({
  controllers: [VehicleStatusesController, ExpenseCategoriesController, FundingSourcesController],
  providers: [VehicleStatusesService, ExpenseCategoriesService, FundingSourcesService],
  exports: [VehicleStatusesService, ExpenseCategoriesService, FundingSourcesService],
})
export class DictionariesModule {}
