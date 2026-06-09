import { Module } from '@nestjs/common';
import { ExpenseCategoriesController } from './expense-categories.controller.js';
import { ExpenseCategoriesService } from './expense-categories.service.js';
import { FundingSourcesController } from './funding-sources.controller.js';
import { FundingSourcesService } from './funding-sources.service.js';

@Module({
  controllers: [ExpenseCategoriesController, FundingSourcesController],
  providers: [ExpenseCategoriesService, FundingSourcesService],
  exports: [ExpenseCategoriesService, FundingSourcesService],
})
export class DictionariesModule {}
