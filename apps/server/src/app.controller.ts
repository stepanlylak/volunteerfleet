import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators/public.decorator.js';

@Controller()
export class AppController {
  @Get()
  @Public()
  healthRoot() {
    return { status: 'ok', name: 'volunteerfleet-server' };
  }
}
