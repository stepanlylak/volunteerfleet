import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module.js';
import { DocumentGroupsController } from './document-groups.controller.js';
import { DocumentGroupsService } from './document-groups.service.js';

@Module({
  imports: [DocumentsModule],
  controllers: [DocumentGroupsController],
  providers: [DocumentGroupsService],
  exports: [DocumentGroupsService],
})
export class DocumentGroupsModule {}
