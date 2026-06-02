import type { NamePath } from 'antd/es/form/interface';
import type { ZodError, ZodTypeAny } from 'zod';

export function zodValidator<S extends ZodTypeAny>(schema: S) {
  return async (_: unknown, value: unknown) => {
    const result = schema.safeParse(value);
    if (result.success) return;
    throw new Error(result.error.issues[0]?.message ?? 'Некоректне значення');
  };
}

export function zodToAntdFields(error: ZodError) {
  return error.issues.map((issue) => ({
    name: issue.path as NamePath,
    errors: [issue.message],
  }));
}
