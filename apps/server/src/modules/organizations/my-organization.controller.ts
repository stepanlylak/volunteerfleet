import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  AddMemberByEmail,
  JwtPayload,
  OrganizationMemberResponse,
  OrganizationMemberUpdate,
  OrganizationResponse,
  OrganizationUpdate,
  OrganizationWithMembersResponse,
} from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { OrgRoles } from '../../common/decorators/org-roles.decorator.js';
import { OrgContextGuard } from '../../common/guards/org-context.guard.js';
import { OrgRolesGuard } from '../../common/guards/org-roles.guard.js';
import { OrganizationsService } from './organizations.service.js';

@Controller('my-organization')
@UseGuards(OrgContextGuard, OrgRolesGuard)
@OrgRoles('coordinator')
export class MyOrganizationController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async getMyOrganization(
    @CurrentUser() user: JwtPayload,
  ): Promise<OrganizationWithMembersResponse> {
    return this.organizationsService.findById(user.activeOrgId!);
  }

  @Patch()
  async updateMyOrganization(
    @CurrentUser() user: JwtPayload,
    @Body() input: OrganizationUpdate,
  ): Promise<OrganizationResponse> {
    return this.organizationsService.update(user.activeOrgId!, input);
  }

  @Get('members')
  async listMembers(
    @CurrentUser() user: JwtPayload,
  ): Promise<OrganizationMemberResponse[]> {
    return this.organizationsService.listMembers(user.activeOrgId!);
  }

  @Post('members')
  async addMember(
    @CurrentUser() user: JwtPayload,
    @Body() input: AddMemberByEmail,
  ): Promise<void> {
    return this.organizationsService.addMember(user.activeOrgId!, input);
  }

  @Patch('members/:userId')
  async updateMemberRole(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
    @Body() input: OrganizationMemberUpdate,
  ): Promise<void> {
    return this.organizationsService.updateMemberRole(
      user.activeOrgId!,
      userId,
      input.role,
    );
  }

  @Delete('members/:userId')
  async removeMember(
    @CurrentUser() user: JwtPayload,
    @Param('userId') userId: string,
  ): Promise<void> {
    return this.organizationsService.removeMember(user.activeOrgId!, userId);
  }
}
