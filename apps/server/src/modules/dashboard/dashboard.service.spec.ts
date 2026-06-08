import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from './dashboard.service.js';

const NOW = new Date('2026-05-15T12:00:00.000Z');

function makeStatusRow(
  overrides: {
    statusId?: string;
    statusName?: string;
    kind?: 'in_work' | 'final' | 'other';
    color?: string;
    sortOrder?: number;
    count?: number;
  } = {},
) {
  return {
    statusId: '11111111-1111-1111-1111-111111111111',
    statusName: 'тест',
    kind: 'in_work' as const,
    color: '#1677ff',
    sortOrder: 10,
    count: 0,
    ...overrides,
  };
}

describe('DashboardService', () => {
  let db: {
    select: ReturnType<typeof vi.fn>;
  };
  let svc: DashboardService;

  beforeEach(() => {
    db = { select: vi.fn() };
    svc = new DashboardService(db as never);
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  it('returns correct inWorkVehicles when multiple in_work statuses', async () => {
    const statusRows = [
      makeStatusRow({ kind: 'in_work', count: 3 }),
      makeStatusRow({
        statusId: '22222222-2222-2222-2222-222222222222',
        kind: 'in_work',
        count: 2,
      }),
      makeStatusRow({ statusId: '33333333-3333-3333-3333-333333333333', kind: 'final', count: 5 }),
    ];

    let callIndex = 0;
    db.select.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return {
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 10 }]) }),
        };
      }
      if (callIndex === 2) {
        return {
          select: vi.fn(),
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(statusRows),
              }),
            }),
          }),
        };
      }
      if (callIndex === 3) {
        return {
          from: vi
            .fn()
            .mockReturnValue({ where: vi.fn().mockResolvedValue([{ totalUah: '15000' }]) }),
        };
      }
      if (callIndex === 4) {
        return {
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 7 }]) }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 2 }]) }),
      };
    });

    const result = await svc.getStats('66666666-6666-6666-6666-666666666666');
    expect(result.inWorkVehicles).toBe(5);
    expect(result.transferredVehicles).toBe(5);
    expect(result.totalVehicles).toBe(10);
  });

  it('returns zero inWorkVehicles and transferredVehicles when no statuses', async () => {
    let callIndex = 0;
    db.select.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return {
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) }),
        };
      }
      if (callIndex === 2) {
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        };
      }
      if (callIndex === 3) {
        return {
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ totalUah: '0' }]) }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) }),
      };
    });

    const result = await svc.getStats('66666666-6666-6666-6666-666666666666');
    expect(result.inWorkVehicles).toBe(0);
    expect(result.transferredVehicles).toBe(0);
    expect(result.documentsTotal).toBe(0);
    expect(result.documentsThisMonth).toBe(0);
  });

  it('statusCounts include kind, color, sortOrder', async () => {
    const statusRows = [
      makeStatusRow({ kind: 'final', color: '#52c41a', sortOrder: 50, count: 3 }),
    ];

    let callIndex = 0;
    db.select.mockImplementation(() => {
      callIndex++;
      if (callIndex === 1) {
        return {
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 3 }]) }),
        };
      }
      if (callIndex === 2) {
        return {
          from: vi.fn().mockReturnValue({
            leftJoin: vi.fn().mockReturnValue({
              groupBy: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockResolvedValue(statusRows),
              }),
            }),
          }),
        };
      }
      if (callIndex === 3) {
        return {
          from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ totalUah: '0' }]) }),
        };
      }
      return {
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ count: 0 }]) }),
      };
    });

    const result = await svc.getStats('66666666-6666-6666-6666-666666666666');
    const sc = result.statusCounts[0]!;
    expect(sc.kind).toBe('final');
    expect(sc.color).toBe('#52c41a');
    expect(sc.sortOrder).toBe(50);
  });
});
