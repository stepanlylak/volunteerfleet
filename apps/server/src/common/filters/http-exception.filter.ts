import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

const STATUS_CODE_MAP: Record<number, string> = {
  400: 'VALIDATION_ERROR',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  413: 'PAYLOAD_TOO_LARGE',
  415: 'UNSUPPORTED_MEDIA_TYPE',
  422: 'BUSINESS_RULE_VIOLATION',
};

function toCode(status: number): string {
  return STATUS_CODE_MAP[status] ?? 'INTERNAL_ERROR';
}

interface PgError {
  code: string;
  table?: string;
  constraint?: string;
  detail?: string;
  message?: string;
}

function asPgError(exception: unknown): PgError | null {
  if (typeof exception !== 'object' || exception === null) return null;
  const candidate = exception as Record<string, unknown>;
  if (typeof candidate.code !== 'string') return null;
  return candidate as unknown as PgError;
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'Internal server error';
    let details: unknown[] | undefined;

    if (exception instanceof ZodValidationException) {
      statusCode = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Validation failed';
      details = exception.getZodError().issues.map((i) => ({
        path: i.path,
        message: i.message,
      }));
    } else if (exception instanceof ZodError) {
      statusCode = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'Validation failed';
      details = exception.issues.map((i) => ({
        path: i.path,
        message: i.message,
      }));
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      code = toCode(statusCode);
      const responseBody = exception.getResponse();
      message =
        typeof responseBody === 'string'
          ? responseBody
          : ((responseBody as { message?: string }).message ?? exception.message);
    } else {
      const pg = asPgError(exception);
      if (pg && pg.code === '23503') {
        statusCode = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'Resource is in use and cannot be deleted';
      } else if (pg && pg.code === '23505') {
        statusCode = HttpStatus.CONFLICT;
        code = 'CONFLICT';
        message = 'Resource conflicts with an existing record';
      } else if (exception instanceof Error) {
        message = exception.message;
      }
    }

    if (statusCode >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${statusCode}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(statusCode).json({
      statusCode,
      code,
      message,
      ...(details !== undefined ? { details } : {}),
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
