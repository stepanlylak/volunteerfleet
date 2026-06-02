import {
  BadRequestException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { VehiclePhotosService } from './vehicle-photos.service.js';

describe('VehiclePhotosService', () => {
  const svc = new VehiclePhotosService({} as never, { getPresignedDownloadUrl: vi.fn() } as never);

  it('accepts allowed image MIME types below the limit', () => {
    expect(() => svc.assertAllowedPhotoForTest('image/jpeg', 1024, 0, 26214400)).not.toThrow();
  });

  it('rejects non-image document MIME types', () => {
    expect(() => svc.assertAllowedPhotoForTest('application/pdf', 1024, 0, 26214400)).toThrow(
      UnsupportedMediaTypeException,
    );
  });

  it('rejects upload size overflow as 413', () => {
    expect(() => svc.assertAllowedPhotoForTest('image/png', 26214401, 0, 26214400)).toThrow(
      PayloadTooLargeException,
    );
  });

  it('rejects upload when vehicle already has 10 active photos', () => {
    expect(() => svc.assertAllowedPhotoForTest('image/webp', 1024, 10, 26214400)).toThrow(
      BadRequestException,
    );
  });
});
