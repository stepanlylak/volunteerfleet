import { z } from 'zod';

export const uuidSchema = z.string().uuid();

export const nonEmptyString = z.string().trim().min(1);

declare const minorAmountBrand: unique symbol;
export type MinorAmount = number & { readonly [minorAmountBrand]: 'MinorAmount' };

export const minorAmountSchema = z.number().int();

export const positiveMinorAmountSchema = minorAmountSchema.refine((value) => value > 0, {
  message: 'Amount must be positive',
});

export const idParamSchema = z.object({
  id: uuidSchema,
});
export type IdParam = z.infer<typeof idParamSchema>;

export const sortParamSchema = z
  .string()
  .regex(/^[a-zA-Z][a-zA-Z0-9_]*:(asc|desc)(,[a-zA-Z][a-zA-Z0-9_]*:(asc|desc))*$/);
export type SortParam = z.infer<typeof sortParamSchema>;

export const errorIssueSchema = z.object({
  path: z.array(z.union([z.string(), z.number()])),
  message: z.string(),
});

export const errorResponseSchema = z.object({
  statusCode: z.number().int(),
  code: z.string(),
  message: z.string(),
  details: z.array(errorIssueSchema).optional(),
  timestamp: z.string().datetime(),
  path: z.string(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
