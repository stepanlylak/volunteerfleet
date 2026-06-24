import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ZodValidationPipe } from 'nestjs-zod';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { AppModule } from './app.module.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import type { Env } from './config/env.schema.js';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService<Env, true>);

  app.setGlobalPrefix('api/v1');

  // CSP is configured to allow Ant Design inline styles and Vite inline scripts.
  // Document/photo URLs from object storage are now proxied through the app.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          frameSrc: ["'self'"],
        },
      },
    }),
  );
  app.use(cookieParser());

  app.enableCors({
    origin: config.get('CORS_ORIGIN', { infer: true }),
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  });

  app.useGlobalPipes(new ZodValidationPipe());
  app.useGlobalFilters(new HttpExceptionFilter());

  // In production the server also serves the built client (single-container
  // deploy → frontend and API share one origin, so auth cookies stay first-party).
  if (config.get('NODE_ENV', { infer: true }) === 'production') {
    const clientDir =
      process.env.CLIENT_DIST_PATH ??
      join(fileURLToPath(new URL('.', import.meta.url)), '../client');
    if (existsSync(clientDir)) {
      app.useStaticAssets(clientDir, { index: false });
      const indexHtml = join(clientDir, 'index.html');
      app.use((req: Request, res: Response, next: NextFunction) => {
        if (req.method !== 'GET' || req.path.startsWith('/api')) {
          next();
          return;
        }
        res.sendFile(indexHtml);
      });
    }
  }

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('VolunteerFleet API')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/v1/docs', app, document);
  }

  await app.listen(config.get('PORT', { infer: true }));

  const url = await app.getUrl();
  // eslint-disable-next-line no-console
  console.log(`Listening on ${url}`);
}

bootstrap();
