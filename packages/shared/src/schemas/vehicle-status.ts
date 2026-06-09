import { z } from 'zod';
import { uuidSchema } from './common.js';

export const VEHICLE_STATUSES = [
  'new',
  'paid',
  'in_transit',
  'arrived',
  'in_repair',
  'ready',
  'transferred',
  'returned',
  'lost',
] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export const VEHICLE_STATUS_CONFIG: Record<
  VehicleStatus,
  {
    label: string;
    color: string;
    sortOrder: number;
  }
> = {
  new: { label: 'Нове', color: '#1677ff', sortOrder: 10 },
  paid: { label: 'Оплачено', color: '#faad14', sortOrder: 20 },
  in_transit: { label: 'В дорозі', color: '#722ed1', sortOrder: 30 },
  arrived: { label: 'Прибуло', color: '#13c2c2', sortOrder: 40 },
  in_repair: { label: 'На ремонті', color: '#ff7a45', sortOrder: 50 },
  ready: { label: 'Готове', color: '#52c41a', sortOrder: 60 },
  transferred: { label: 'Передано', color: '#389e0d', sortOrder: 70 },
  returned: { label: 'Повернено', color: '#eb2f96', sortOrder: 80 },
  lost: { label: 'Втрачено', color: '#ff4d4f', sortOrder: 90 },
};

export const VEHICLE_STATUS_DASHBOARD_GROUP: Record<VehicleStatus, 'in_work' | 'final' | 'other'> =
  {
    new: 'in_work',
    paid: 'in_work',
    in_transit: 'in_work',
    arrived: 'in_work',
    in_repair: 'in_work',
    ready: 'in_work',
    returned: 'in_work',
    transferred: 'final',
    lost: 'other',
  };

export const ALLOWED_TRANSITIONS: Record<VehicleStatus, VehicleStatus[]> = {
  new: ['paid', 'lost'],
  paid: ['in_transit', 'arrived', 'lost'],
  in_transit: ['arrived', 'lost'],
  arrived: ['in_repair', 'ready', 'lost'],
  in_repair: ['ready', 'lost'],
  ready: ['transferred', 'lost'],
  transferred: ['returned', 'in_repair', 'lost'],
  returned: ['in_repair', 'transferred', 'lost'],
  lost: [],
};

export function isValidTransition(from: VehicleStatus, to: VehicleStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export const vehicleStatusSchema = z.enum(VEHICLE_STATUSES);

const currencyCodeSchema = z.enum(['UAH', 'USD', 'EUR']);
const rateSourceSchema = z.enum(['default', 'manual']);

const baseTransitionSchema = z
  .object({
    expectedCurrentStatus: vehicleStatusSchema,
    targetStatus: vehicleStatusSchema,
    transitionDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    note: z.string().max(2000).optional().nullable(),
  })
  .strict();

const purchasePriceFields = {
  purchasePrice: z.number().positive(),
  purchaseCurrency: currencyCodeSchema,
  purchaseRate: z.number().positive(),
  purchaseRateSource: rateSourceSchema,
};

const documentRefField = (description: string) =>
  uuidSchema.optional().nullable().describe(description);

export const transitionToPaidSchema = baseTransitionSchema
  .extend({
    targetStatus: z.literal('paid'),
    ...purchasePriceFields,
    isLocalPurchase: z.boolean().default(false),
    registrationDocId: documentRefField('Техпаспорт без печатки митниці'),
  })
  .strict();

export const transitionToInTransitSchema = baseTransitionSchema
  .extend({
    targetStatus: z.literal('in_transit'),
    customsDeclarationDocId: documentRefField('Митна декларація'),
  })
  .strict();

export const transitionToArrivedSchema = baseTransitionSchema
  .extend({
    targetStatus: z.literal('arrived'),
    borderCrossingDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional()
      .nullable(),
    stampedRegistrationDocId: documentRefField('Техпаспорт з печаткою митниці'),
    stampedCustomsDeclarationDocId: documentRefField('Скан митної декларації з печатками'),
  })
  .strict();

export const transitionToInRepairSchema = baseTransitionSchema
  .extend({
    targetStatus: z.literal('in_repair'),
  })
  .strict();

export const transitionToReadySchema = baseTransitionSchema
  .extend({
    targetStatus: z.literal('ready'),
    transferActDraftDocId: documentRefField('Акт приймання-передачі (чернетка)'),
  })
  .strict();

export const transitionToTransferredSchema = baseTransitionSchema
  .extend({
    targetStatus: z.literal('transferred'),
    transferActSignedDocId: documentRefField('Підписаний акт приймання-передачі'),
    isRegisteredAtServiceCenter: z.boolean().default(false),
  })
  .strict();

export const transitionToReturnedSchema = baseTransitionSchema
  .extend({
    targetStatus: z.literal('returned'),
    returnActDocId: documentRefField('Акт повернення'),
  })
  .strict();

export const transitionToLostSchema = baseTransitionSchema
  .extend({
    targetStatus: z.literal('lost'),
    lostReason: z.string().min(1).max(2000),
  })
  .strict();

export const vehicleTransitionRequestSchema = z.discriminatedUnion('targetStatus', [
  transitionToPaidSchema,
  transitionToInTransitSchema,
  transitionToArrivedSchema,
  transitionToInRepairSchema,
  transitionToReadySchema,
  transitionToTransferredSchema,
  transitionToReturnedSchema,
  transitionToLostSchema,
]);
export type VehicleTransitionRequest = z.infer<typeof vehicleTransitionRequestSchema>;

export const vehicleStatusHistoryEditRequestSchema = z.discriminatedUnion('targetStatus', [
  transitionToPaidSchema.omit({ expectedCurrentStatus: true }),
  transitionToInTransitSchema.omit({ expectedCurrentStatus: true }),
  transitionToArrivedSchema.omit({ expectedCurrentStatus: true }),
  transitionToInRepairSchema.omit({ expectedCurrentStatus: true }),
  transitionToReadySchema.omit({ expectedCurrentStatus: true }),
  transitionToTransferredSchema.omit({ expectedCurrentStatus: true }),
  transitionToReturnedSchema.omit({ expectedCurrentStatus: true }),
  transitionToLostSchema.omit({ expectedCurrentStatus: true }),
]);
export type VehicleStatusHistoryEditRequest = z.infer<typeof vehicleStatusHistoryEditRequestSchema>;

export const VEHICLE_ALERT_TYPES = [
  'missing_registration_doc',
  'missing_stamped_registration_doc',
  'missing_customs_declaration',
  'missing_stamped_customs_declaration',
  'missing_transfer_act_draft',
  'missing_transfer_act_signed',
  'not_registered_at_service_center',
  'missing_return_act',
] as const;
export type VehicleAlertType = (typeof VEHICLE_ALERT_TYPES)[number];

export const VEHICLE_ALERT_CONFIG: Record<VehicleAlertType, { message: string }> = {
  missing_registration_doc: { message: 'Відсутній техпаспорт без печатки митниці' },
  missing_stamped_registration_doc: { message: 'Відсутній техпаспорт з печаткою митниці' },
  missing_customs_declaration: { message: 'Відсутня митна декларація' },
  missing_stamped_customs_declaration: { message: 'Відсутній скан митної декларації з печатками' },
  missing_transfer_act_draft: { message: 'Відсутній чернетковий акт приймання-передачі' },
  missing_transfer_act_signed: { message: 'Відсутній підписаний акт приймання-передачі' },
  not_registered_at_service_center: { message: 'Авто не зареєстроване в сервісному центрі' },
  missing_return_act: { message: 'Відсутній акт повернення' },
};

export const vehicleAlertSchema = z.object({
  type: z.enum(VEHICLE_ALERT_TYPES),
  message: z.string(),
  vehicleStatusHistoryId: uuidSchema.nullable(),
});
export type VehicleAlert = z.infer<typeof vehicleAlertSchema>;
