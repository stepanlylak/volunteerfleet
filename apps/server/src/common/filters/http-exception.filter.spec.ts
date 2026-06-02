import { ArgumentsHost, HttpException } from '@nestjs/common';
import { describe, it, expect, vi } from 'vitest';
import { HttpExceptionFilter } from './http-exception.filter.js';

function makeHost() {
  const status = vi.fn().mockReturnThis();
  const json = vi.fn();
  const response = { status, json };
  const request = { method: 'DELETE', url: '/api/v1/dictionaries/vehicle-statuses/abc' };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => request,
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('HttpExceptionFilter', () => {
  it('maps pg 23503 to 409 CONFLICT with in-use message', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = makeHost();
    const err = Object.assign(new Error('violates foreign key'), { code: '23503' });

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(409);
    const body = json.mock.calls[0]![0];
    expect(body.statusCode).toBe(409);
    expect(body.code).toBe('CONFLICT');
    expect(body.message).toMatch(/in use/i);
  });

  it('maps pg 23505 unique violation to 409', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = makeHost();
    const err = Object.assign(new Error('duplicate key'), { code: '23505' });

    filter.catch(err, host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json.mock.calls[0]![0].code).toBe('CONFLICT');
  });

  it('preserves HttpException semantics', () => {
    const filter = new HttpExceptionFilter();
    const { host, status, json } = makeHost();

    filter.catch(new HttpException('boom', 404), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(json.mock.calls[0]![0].code).toBe('NOT_FOUND');
  });
});
