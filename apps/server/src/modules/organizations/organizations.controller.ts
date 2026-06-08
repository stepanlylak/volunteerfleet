import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  AddMemberByEmail,
  JwtPayload,
  OrganizationCreate,
  OrganizationListQuery,
  OrganizationListResponse,
  OrganizationMemberUpdate,
  OrganizationResponse,
  OrganizationUpdate,
  OrganizationWithMembersResponse,
} from '@volunteerfleet/shared';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { OrganizationsService } from './organizations.service.js';

@Controller('organizations')
@Roles('superuser')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  async list(@Query() query: OrganizationListQuery): Promise<OrganizationListResponse> {
    return this.organizationsService.list(query);
  }

  @Post()
  async create(
    @Body() input: OrganizationCreate,
    @CurrentUser() user: JwtPayload,
  ): Promise<OrganizationResponse> {
    return this.organizationsService.create(input, user.userId);
  }

  @Get(':id')
  async findById(@Param('id') id: string): Promise<OrganizationWithMembersResponse> {
    return this.organizationsService.findById(id);
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() input: OrganizationUpdate,
  ): Promise<OrganizationResponse> {
    return this.organizationsService.update(id, input);
  }

  @Post(':id/members')
  async addMember(@Param('id') id: string, @Body() input: AddMemberByEmail): Promise<void> {
    return this.organizationsService.addMember(id, input);
  }

  @Patch(':id/members/:userId')
  async updateMemberRole(
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() input: OrganizationMemberUpdate,
  ): Promise<void> {
    return this.organizationsService.updateMemberRole(id, userId, input.role);
  }

  @Delete(':id/members/:userId')
  async removeMember(@Param('id') id: string, @Param('userId') userId: string): Promise<void> {
    return this.organizationsService.removeMember(id, userId);
  }
}
