import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialCategoriesService } from './financial-categories.service.js';

function makeRow(overrides: Partial<{ id: string; name: string; sortOrder: number }> = {}) {
  const now = new Date('2026-05-21T10:00:00.000Z');
  return {
    id: '22222222-2222-2222-2222-222222222222',
    name: 'Ремонт',
    sortOrder: 20,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('FinancialCategoriesService', () => {
  let db: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let svc: FinancialCategoriesService;

  beforeEach(() => {
    db = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    svc = new FinancialCategoriesService(db as never);
  });

  it('list returns mapped rows', async () => {
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([makeRow()]),
      }),
    });
    const result = await svc.list();
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Ремонт');
  });

  it('create returns mapped row', async () => {
    const row = makeRow({ name: 'Паливо', sortOrder: 30 });
    db.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([row]),
      }),
    });
    const result = await svc.create({ name: 'Паливо', sortOrder: 30 });
    expect(result).toMatchObject({ name: 'Паливо', sortOrder: 30 });
  });

  it('update throws NotFound when missing', async () => {
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    await expect(svc.update('id', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('remove succeeds when row existed', async () => {
    db.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: 'x' }]),
      }),
    });
    await expect(svc.remove('id')).resolves.toBeUndefined();
  });

  it('remove throws NotFound when no row', async () => {
    db.delete.mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });
    await expect(svc.remove('id')).rejects.toBeInstanceOf(NotFoundException);
  });
});
