import postgres from 'postgres';
import { z } from 'zod';
import type { CashHistorySnapshot } from '@equinoxe/shared';

const amount = z.number().finite(), date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
export const cashSnapshotSchema: z.ZodType<CashHistorySnapshot> = z.object({
  version: z.literal(1), companyId: z.string().min(1), source: z.literal('odoo'), currency: z.literal('EUR'), accountPrefix: z.literal('5'),
  from: z.literal('2024-01-01'), through: date, startedAt: z.string().datetime(), importedAt: z.string().datetime(),
  accounts: z.array(z.object({ id: z.number().int().positive(), code: z.string().regex(/^5\d{1,11}$/), label: z.string(), opening: amount, closing: amount })).min(1),
  movements: z.array(z.object({ id: z.number().int().positive(), date, accountId: z.number().int().positive(), moveId: z.number().int().positive(), label: z.string(), debit: amount, credit: amount })),
  monthlyControls: z.array(z.object({ month: z.string(), closing: amount, difference: amount })),
});
export interface CashHistoryStorage {
  read(companyId: string): Promise<CashHistorySnapshot | null>;
  save(snapshot: CashHistorySnapshot): Promise<void>;
}

/** One isolated document per company. No legacy import or filesystem fallback. */
export class CashHistoryRepository implements CashHistoryStorage {
  private sql?: ReturnType<typeof postgres>;
  constructor(url?: string) {
    if (url) this.sql = postgres(url, { max: 2, connect_timeout: 15, idle_timeout: 20,
      ssl: new URL(url).searchParams.get('sslmode') === 'require' || new URL(url).hostname.endsWith('.render.com') ? 'require' : undefined });
  }
  private connection() {
    if (!this.sql) throw new Error('PostgreSQL est requis pour l’historique de trésorerie.');
    return this.sql;
  }
  async read(companyId: string) {
    const sql = this.connection();
    const rows = await sql`SELECT data FROM equinoxe_documents WHERE key = ${`cash-history:${companyId}`}`;
    if (!rows.length) return null;
    const snapshot = cashSnapshotSchema.parse(rows[0].data);
    if (snapshot.companyId !== companyId) throw new Error('Historique de trésorerie incohérent.');
    return snapshot;
  }
  async save(value: CashHistorySnapshot) {
    const sql = this.connection(), snapshot = cashSnapshotSchema.parse(value);
    // Atomic creation/update; an older import finishing later cannot overwrite a newer one.
    const rows = await sql`INSERT INTO equinoxe_documents (key, data, updated_at)
      VALUES (${`cash-history:${snapshot.companyId}`}, ${sql.json(snapshot as never)}, NOW())
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
      WHERE equinoxe_documents.data->>'startedAt' <= EXCLUDED.data->>'startedAt'
      RETURNING key`;
    if (!rows.length) throw new Error('Un import plus récent existe déjà. Rechargez le suivi.');
  }
  async close() { await this.sql?.end(); }
}
