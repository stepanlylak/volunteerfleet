import {
  ForbiddenException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DocumentsService } from './documents.service.js';

const ownerId = '11111111-1111-1111-1111-111111111111';
const otherUserId = '22222222-2222-2222-2222-222222222222';
const orgId = '66666666-6666-6666-6666-666666666666';

describe('DocumentsService', () => {
  let db: {
    insert: ReturnType<typeof vi.fn>;
    select: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    query: {
      documents: {
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
      expenses: {
        findFirst: ReturnType<typeof vi.fn>;
      };
      vehicles: {
        findFirst: ReturnType<typeof vi.fn>;
      };
    };
  };
  let storage: { getObjectStream: ReturnType<typeof vi.fn> };
  let svc: DocumentsService;

  beforeEach(() => {
    db = {
      insert: vi.fn(),
      select: vi.fn(),
      update: vi.fn(),
      query: {
        documents: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
        expenses: {
          findFirst: vi.fn(),
        },
        vehicles: {
          findFirst: vi.fn(),
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
      orgId,
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
          userRole: 'user',
          orgRole: 'volunteer',
          iat: 0,
          exp: 0,
        },
        orgId,
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
      svc.softDelete(
        'doc-id',
        {
          sub: otherUserId,
          email: 'coordinator@example.com',
          userRole: 'user',
          orgRole: 'coordinator',
          iat: 0,
          exp: 0,
        },
        orgId,
      ),
    ).resolves.toBeUndefined();
  });

  it('persists documentType updates', async () => {
    const set = vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'doc-id' }]),
      }),
    });
    db.update.mockReturnValue({ set });
    db.query.documents.findFirst
      .mockResolvedValueOnce({
        id: 'doc-id',
        createdBy: ownerId,
        kind: 'link',
      })
      .mockResolvedValueOnce(makeDocumentRow('doc-id', 'Document'));

    await svc.update(
      'doc-id',
      { documentType: 'customs_declaration' },
      {
        sub: ownerId,
        email: 'owner@example.com',
        userRole: 'user',
        orgRole: 'volunteer',
        iat: 0,
        exp: 0,
      },
      orgId,
    );

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ documentType: 'customs_declaration' }),
    );
  });

  it('persists documentType when creating a link document', async () => {
    const values = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: 'doc-id' }]),
    });
    db.insert.mockReturnValue({ values });
    db.query.vehicles.findFirst.mockResolvedValue({ id: 'vehicle-id' });
    db.query.documents.findFirst.mockResolvedValue({
      ...makeDocumentRow('doc-id', 'Return act'),
      kind: 'link',
      documentType: 'return_act',
      fileKey: null,
      url: 'https://example.com/return-act',
      mimeType: null,
      sizeBytes: null,
    });

    await svc.createLink(
      {
        name: 'Return act',
        url: 'https://example.com/return-act',
        documentType: 'return_act',
        vehicleId: '44846ea1-f39a-4574-9f4f-92b5ae208045',
        expenseId: null,
      },
      ownerId,
      orgId,
    );

    expect(values).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: 'return_act',
      }),
    );
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
    documentType: 'other',
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
