import { Module } from '@nestjs/common';
import { DonorsController } from './donors.controller.js';
import { DonorsService } from './donors.service.js';

@Module({
  controllers: [DonorsController],
  providers: [DonorsService],
  exports: [DonorsService],
})
export class DonorsModule {}
