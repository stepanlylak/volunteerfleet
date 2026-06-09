import { z } from 'zod';
import { vehicleStatusSchema, VEHICLE_STATUS_DASHBOARD_GROUP } from './vehicle-status.js';

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
  monthlyExpenseUah: z.number().min(0),
  documentsTotal: z.number().int().min(0),
  documentsThisMonth: z.number().int().min(0),
});
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;
