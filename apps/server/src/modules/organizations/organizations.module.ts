import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module.js';
import { MyOrganizationController } from './my-organization.controller.js';
import { OrganizationsController } from './organizations.controller.js';
import { OrganizationsService } from './organizations.service.js';

@Module({
  imports: [UsersModule],
  controllers: [OrganizationsController, MyOrganizationController],
  providers: [OrganizationsService],
  exports: [OrganizationsService],
})
export class OrganizationsModule {}
