import { NotFoundException } from '@nestjs/common';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FundingSourcesService } from './funding-sources.service.js';

function makeRow(
  overrides: Partial<{
    id: string;
    name: string;
    type: 'donor' | 'fundraiser' | 'initiative' | 'other';
    description: string | null;
  }> = {},
) {
  const now = new Date('2026-05-21T10:00:00.000Z');
  return {
    id: '33333333-3333-3333-3333-333333333333',
    name: 'Загальний збір',
    type: 'fundraiser' as const,
    description: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe('FundingSourcesService', () => {
  let db: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let svc: FundingSourcesService;

  beforeEach(() => {
    db = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    svc = new FundingSourcesService(db as never);
  });

  it('list returns rows', async () => {
    db.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue([makeRow()]),
      }),
    });
    const result = await svc.list();
    expect(result).toHaveLength(1);
    expect(result[0]!.type).toBe('fundraiser');
  });

  it('create normalizes optional description to null', async () => {
    const valuesMock = vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([makeRow({ name: 'Donor A', type: 'donor' })]),
    });
    db.insert.mockReturnValue({ values: valuesMock });
    const result = await svc.create({
      name: 'Donor A',
      type: 'donor',
      organizationId: '11111111-1111-1111-1111-111111111111',
    });
    expect(valuesMock).toHaveBeenCalledWith({
      name: 'Donor A',
      type: 'donor',
      organizationId: '11111111-1111-1111-1111-111111111111',
      description: null,
    });
    expect(result.name).toBe('Donor A');
  });

  it('update throws NotFound', async () => {
    db.update.mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([]),
        }),
      }),
    });
    await expect(svc.update('id', { name: 'x' })).rejects.toBeInstanceOf(NotFoundException);
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
