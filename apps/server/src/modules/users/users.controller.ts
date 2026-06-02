import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import {
  idParamSchema,
  userCreateSchema,
  userListQuerySchema,
  userUpdateSchema,
  type IdParam,
  type ResetPasswordResponse,
  type UserCreate,
  type UserCreateResponse,
  type UserListQuery,
  type UserListResponse,
  type UserResponse,
  type UserUpdate,
} from '@volunteerfleet/shared';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { UsersService } from './users.service.js';

@ApiTags('users')
@Controller('users')
@Roles('admin')
export class UsersController {
  constructor(private readonly service: UsersService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(userListQuerySchema)) query: UserListQuery,
  ): Promise<UserListResponse> {
    return this.service.list(query);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(userCreateSchema)) dto: UserCreate,
  ): Promise<UserCreateResponse> {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
    @Body(new ZodValidationPipe(userUpdateSchema)) dto: UserUpdate,
  ): Promise<UserResponse> {
    return this.service.update(params.id, dto);
  }

  @Post(':id/reset-password')
  resetPassword(
    @Param(new ZodValidationPipe(idParamSchema)) params: IdParam,
  ): Promise<ResetPasswordResponse> {
    return this.service.resetPassword(params.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param(new ZodValidationPipe(idParamSchema)) params: IdParam): Promise<void> {
    await this.service.softDelete(params.id);
  }
}
