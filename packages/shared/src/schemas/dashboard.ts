import { z } from 'zod';
import { vehicleStatusSchema } from './vehicle-status.js';
import { minorAmountSchema } from './common.js';

export const dashboardStatusCountSchema = z.object({
  status: vehicleStatusSchema,
  statusName: z.string(),
  count: z.number().int().min(0),
  kind: z.enum(['in_work', 'final', 'other']),
  color: z.string(),
  sortOrder: z.number().int(),
});
export type DashboardStatusCount = z.infer<typeof dashboardStatusCountSchema>;

export const dashboardStatsSchema = z.object({
  totalVehicles: z.number().int().min(0),
  inWorkVehicles: z.number().int().min(0),
  transferredVehicles: z.number().int().min(0),
  statusCounts: z.array(dashboardStatusCountSchema),
  monthlyExpenseUahMinor: minorAmountSchema.refine((value) => value >= 0),
  documentsTotal: z.number().int().min(0),
  documentsThisMonth: z.number().int().min(0),
  // Finance KPI
  totalDonationsUahMinor: minorAmountSchema.refine((value) => value >= 0),
  monthlyDonationsUahMinor: minorAmountSchema.refine((value) => value >= 0),
  totalExpensesUahMinor: minorAmountSchema.refine((value) => value >= 0),
  balanceUahMinor: minorAmountSchema,
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
