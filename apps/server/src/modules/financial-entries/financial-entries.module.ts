import { Module } from '@nestjs/common';
import { FinancialEntriesController } from './financial-entries.controller.js';
import { FinancialEntriesService } from './financial-entries.service.js';

@Module({
  controllers: [FinancialEntriesController],
  providers: [FinancialEntriesService],
  exports: [FinancialEntriesService],
})
export class FinancialEntriesModule {}
