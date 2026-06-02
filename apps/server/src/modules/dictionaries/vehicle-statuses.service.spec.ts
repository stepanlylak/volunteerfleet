import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VehicleStatusesService } from './vehicle-statuses.service.js';

function makeRow(
  overrides: Partial<{
    id: string;
    name: string;
    sortOrder: number;
    isDefault: boolean;
    kind: 'in_work' | 'final' | 'other';
    color: string;
  }> = {},
) {
  const now = new Date('2026-05-21T10:00:00.000Z');
  return {
    id: '11111111-1111-1111-1111-111111111111',
    name: 'тест',
    sortOrder: 10,
    isDefault: false,
    kind: 'other' as const,
    color: '#8c8c8c',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('VehicleStatusesService', () => {
  let db: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let svc: VehicleStatusesService;

  beforeEach(() => {
    db = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    svc = new VehicleStatusesService(db as never);
  });

  it('list returns ordered rows', async () => {
    const rows = [makeRow({ name: 'a', sortOrder: 10 })];
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    });
    const result = await svc.list();
    expect(result).toHaveLength(1);
    const first = result[0]!;
    expect(first).toMatchObject({ name: 'a', sortOrder: 10, isDefault: false });
    expect(first.createdAt).toBe('2026-05-21T10:00:00.000Z');
  });

  it('create inserts and returns mapped row', async () => {
    const row = makeRow({ name: 'новий', sortOrder: 5, isDefault: true });
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([row]),
      }),
    });
    const result = await svc.create({ name: 'новий', sortOrder: 5, isDefault: true, kind: 'in_work', color: '#52c41a' });
    expect(result.name).toBe('новий');
    expect(result.isDefault).toBe(true);
  });

  it('update returns updated row', async () => {
    const row = makeRow({ name: 'оновлено' });
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([row]),
        }),
      }),
    });
    const result = await svc.update(row.id, { name: 'оновлено' });
    expect(result.name).toBe('оновлено');
  });

  it('update throws NotFound when row missing', async () => {
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    await expect(
      svc.update('00000000-0000-0000-0000-000000000000', { name: 'x' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove succeeds when row existed', async () => {
    db.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'x' }]),
      }),
    });
    await expect(svc.remove('11111111-1111-1111-1111-111111111111')).resolves.toBeUndefined();
  });

  it('remove throws NotFound when no row', async () => {
    db.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });
    await expect(svc.remove('11111111-1111-1111-1111-111111111111')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('remove propagates pg foreign key violation (filter maps it to 409)', async () => {
    const pgErr = Object.assign(new Error('violates foreign key constraint'), { code: '23503' });
    db.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockRejectedValue(pgErr),
      }),
    });
    await expect(svc.remove('11111111-1111-1111-1111-111111111111')).rejects.toMatchObject({
      code: '23503',
    });
  });
});
