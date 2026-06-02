import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, eq } from 'drizzle-orm';
import type {
  FundingSource,
  FundingSourceCreate,
  FundingSourceUpdate,
} from '@volunteerfleet/shared';
import { DB } from '../../db/db.module.js';
import type { Database } from '../../db/client.js';
import { fundingSources } from '../../db/schema/index.js';

@Injectable()
export class FundingSourcesService {
  constructor(@Inject(DB) private readonly db: Database) {}

  async list(): Promise<FundingSource[]> {
    const rows = await this.db.select().from(fundingSources).orderBy(asc(fundingSources.name));
    return rows.map(toResponse);
  }

  async create(input: FundingSourceCreate): Promise<FundingSource> {
    const rows = await this.db
      .insert(fundingSources)
      .values({ ...input, description: input.description ?? null })
      .returning();
    const row = rows[0];
    if (!row) throw new Error('Insert returned no rows');
    return toResponse(row);
  }

  async update(id: string, input: FundingSourceUpdate): Promise<FundingSource> {
    const rows = await this.db
      .update(fundingSources)
      .set(input)
      .where(eq(fundingSources.id, id))
      .returning();
    const row = rows[0];
    if (!row) throw new NotFoundException(`funding_source ${id} not found`);
    return toResponse(row);
  }

  async remove(id: string): Promise<void> {
    const result = await this.db
      .delete(fundingSources)
      .where(eq(fundingSources.id, id))
      .returning({ id: fundingSources.id });
    if (result.length === 0) {
      throw new NotFoundException(`funding_source ${id} not found`);
    }
  }
}

function toResponse(row: typeof fundingSources.$inferSelect): FundingSource {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
