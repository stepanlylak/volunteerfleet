import { Module } from '@nestjs/common';
import { StorageModule } from '../../storage/storage.module.js';
import { PublicController } from './public.controller.js';
import { PublicService } from './public.service.js';

@Module({
  imports: [StorageModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
