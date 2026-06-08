import {
  ForbiddenException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentsService } from './documents.service.js';

const ownerId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';

describe('DocumentsService', () => {
  let db: {
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    query: {
      documents: {
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
    };
  };
  let storage: { getObjectStream: ReturnType<typeof vi.fn> };
  let svc: DocumentsService;

  beforeEach(() => {
    db = {
      select: vi.fn(),
      update: vi.fn(),
      query: {
        documents: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
      },
    };
    storage = {
      getObjectStream: vi.fn(),
    };
    svc = new DocumentsService(db as never, storage as never);
  });

  it('hydrates listed documents by page ids and preserves page order', async () => {
    db.select
      .mockReturnValueOnce(selectWhereResult([{ count: 2 }]))
      .mockReturnValueOnce(selectPageIdsResult([{ id: 'doc-a' }, { id: 'doc-b' }]));
    db.query.documents.findMany.mockResolvedValue([
      makeDocumentRow('doc-b', 'B document'),
      makeDocumentRow('doc-a', 'A document'),
    ]);

    const result = await svc.list(
      {
        page: 1,
        pageSize: 100,
        includeDeleted: false,
        vehicleId: '44846ea1-f39a-4574-9f4f-92b5ae208045',
      },
      'volunteer',
    );

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual(['doc-a', 'doc-b']);
    expect(db.query.documents.findMany).toHaveBeenCalledTimes(1);
  });

  it('prevents volunteer from updating another user document', async () => {
    db.query.documents.findFirst.mockResolvedValue({
      id: 'doc-id',
      createdBy: ownerId,
      kind: 'link',
    });

    await expect(
      svc.update(
        'doc-id',
        { name: 'New name' },
        {
          sub: otherUserId,
          email: 'v@example.com',
          role: 'user',
          orgRole: 'volunteer',
          iat: 0,
          exp: 0,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows coordinator to delete any document', async () => {
    db.query.documents.findFirst.mockResolvedValue({
      id: 'doc-id',
      createdBy: ownerId,
    });
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    });

    await expect(
      svc.softDelete('doc-id', {
        sub: otherUserId,
        email: 'coordinator@example.com',
        role: 'user',
        orgRole: 'coordinator',
        iat: 0,
        exp: 0,
      }),
    ).resolves.toBeUndefined();
  });

  it('accepts whitelisted MIME types', () => {
    expect(() => svc.assertAllowedUploadForTest('application/pdf', 1024, 26214400)).not.toThrow();
  });

  it('rejects unsupported MIME types', () => {
    expect(() =>
      svc.assertAllowedUploadForTest('application/x-msdownload', 1024, 26214400),
    ).toThrow(UnsupportedMediaTypeException);
  });

  it('rejects upload size overflow as 413', () => {
    expect(() => svc.assertAllowedUploadForTest('application/pdf', 26214401, 26214400)).toThrow(
      PayloadTooLargeException,
    );
  });
});

function selectWhereResult(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(result),
    }),
  };
}

function selectPageIdsResult(result: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(result),
          }),
        }),
      }),
    }),
  };
}

function makeDocumentRow(id: string, name: string) {
  return {
    id,
    name,
    kind: 'upload',
    fileKey: `documents/${id}/file.pdf`,
    url: null,
    mimeType: 'application/pdf',
    sizeBytes: 1024,
    vehicleId: '44846ea1-f39a-4574-9f4f-92b5ae208045',
    vehicle: {
      id: '44846ea1-f39a-4574-9f4f-92b5ae208045',
      identifier: 'AA0001AA',
      brand: 'Toyota',
      model: 'Hilux',
    },
    expenseId: null,
    expense: null,
    createdBy: ownerId,
    updatedBy: ownerId,
    deletedAt: null,
    deletedBy: null,
    createdByUser: { id: ownerId, fullName: 'Owner' },
    updatedByUser: { id: ownerId, fullName: 'Owner' },
    deletedByUser: null,
    createdAt: new Date('2026-05-01T10:00:00.000Z'),
    updatedAt: new Date('2026-05-01T10:00:00.000Z'),
  };
}
