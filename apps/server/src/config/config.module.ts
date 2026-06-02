import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { validate } from './env.schema.js';

export const AppConfigModule = NestConfigModule.forRoot({
  isGlobal: true,
  envFilePath: '../../.env',
  validate,
});
