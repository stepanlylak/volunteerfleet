import { isNull, type Column } from 'drizzle-orm';

type SoftDeletableTable = { deletedAt: Column };

export function notDeleted(table: SoftDeletableTable) {
  return isNull(table.deletedAt);
}
