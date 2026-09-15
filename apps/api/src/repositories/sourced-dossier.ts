import postgres from 'postgres';
import { z } from 'zod';
import type { DossierAssumptions, DossierDocument, DossierSource } from '@equinoxe/shared';

const number = z.number().finite(), optional = number.nullable();
const annual = z.object({ 2026: optional, 2027: optional, 2028: optional }).strict();
const positiveAnnual = annual.refine(v => Object.values(v).every(n => n === null || n >= 0));
export const dossierAssumptionsSchema: z.ZodType<DossierAssumptions> = z.object({
  growth: annual.refine(v => Object.values(v).every(n => n === null || n >= -1 && n <= 10)),
  amounts: z.record(z.string(), annual), oldSalary: positiveAnnual, newSalary: positiveAnnual,
  rentDifference: annual, capex: positiveAnnual, existingPrincipal: positiveAnnual,
  dividends: positiveAnnual, bfrChange: annual,
  taxRate: number.min(0).max(1).nullable(), acquisitionPrice: number.nonnegative().nullable(),
  cashExtraction: number.nonnegative().nullable(), loanAmount: number.nonnegative().nullable(),
  loanYears: number.int().min(1).max(40).nullable(), loanRate: number.min(0).max(1).nullable(),
  valuationMultiple: number.min(0).max(50).nullable(), surplusCash: number.nonnegative().nullable(),
}).strict().superRefine((v, ctx) => {
  if (v.loanAmount !== null && v.loanAmount > 0 && (v.loanYears === null || v.loanRate === null))
    ctx.addIssue({ code: 'custom', message: 'Durée et taux requis pour le crédit.' });
  for (const [key, years] of Object.entries(v.amounts)) {
    if (key !== 'provisions' && Object.values(years).some(n => n !== null && n < 0))
      ctx.addIssue({ code: 'custom', message: 'Saisissez les charges en coût positif (hors reprises de provisions).' });
  }
});
export const dossierSourceSchema: z.ZodType<DossierSource> = z.object({
  slug: z.literal('smp'), name: z.string().min(1), fiscalEnd: z.literal('06-30'),
  years: z.array(number.int()).length(4), fileName: z.string(), sha256: z.string().regex(/^[a-f0-9]{64}$/),
  contentBase64: z.string().min(1), importedAt: z.string().datetime(),
  sheets: z.array(z.object({ name: z.string(), cells: z.array(z.object({
    address: z.string().regex(/^[A-Z]+[1-9]\d*$/), value: z.union([z.string(), number, z.boolean(), z.null()]), formula: z.string().nullable(),
  })) })).length(6),
});
export const dossierDocumentSchema: z.ZodType<DossierDocument> = z.object({
  version: z.literal(1), revision: number.int().positive(), source: dossierSourceSchema,
  assumptions: dossierAssumptionsSchema, updatedAt: z.string().datetime(), updatedBy: z.string().nullable(),
  changes: z.array(z.object({ revision: number.int(), at: z.string().datetime(), userId: z.string(), previous: dossierAssumptionsSchema })),
});
export class DossierError extends Error { constructor(message: string, public status = 503) { super(message); } }
export interface DossierStorage {
  read(): Promise<DossierDocument | null>;
  create(document: DossierDocument): Promise<boolean>;
  save(assumptions: DossierAssumptions, revision: number, userId: string): Promise<DossierDocument>;
}
/** A single private document. No seed, legacy migration, or writes on GET/startup. */
export class SourcedDossierRepository implements DossierStorage {
  private sql?: ReturnType<typeof postgres>;
  private readonly key = 'analysed-file:smp:v1';
  constructor(url?: string) {
    if (url) this.sql = postgres(url, { max: 2, connect_timeout: 15, idle_timeout: 20,
      ssl: new URL(url).searchParams.get('sslmode') === 'require' || new URL(url).hostname.endsWith('.render.com') ? 'require' : undefined });
  }
  private connection() {
    if (!this.sql) throw new DossierError('PostgreSQL est requis pour le dossier S.M.P.');
    return this.sql;
  }
  async read() {
    const rows = await this.connection()`SELECT data FROM equinoxe_documents WHERE key = ${this.key}`;
    return rows[0] ? dossierDocumentSchema.parse(rows[0].data) : null;
  }
  async create(value: DossierDocument) {
    const sql = this.connection(), document = dossierDocumentSchema.parse(value);
    const rows = await sql`INSERT INTO equinoxe_documents (key,data,updated_at)
      VALUES (${this.key},${sql.json(document as never)},NOW()) ON CONFLICT (key) DO NOTHING RETURNING key`;
    return rows.length === 1;
  }
  async save(value: DossierAssumptions, revision: number, userId: string) {
    const sql = this.connection(), assumptions = dossierAssumptionsSchema.parse(value);
    return await sql.begin(async tx => {
      const rows = await tx`SELECT data FROM equinoxe_documents WHERE key = ${this.key} FOR UPDATE`;
      if (!rows[0]) throw new DossierError('Le fichier S.M.P. doit d’abord être importé.', 404);
      const current = dossierDocumentSchema.parse(rows[0].data);
      if (current.revision !== revision) throw new DossierError('Les hypothèses ont changé dans une autre session. Rechargez avant d’enregistrer.', 409);
      const at = new Date().toISOString();
      const next: DossierDocument = { ...current, assumptions, revision: revision + 1, updatedAt: at, updatedBy: userId,
        changes: [...current.changes, { revision, at, userId, previous: current.assumptions }] };
      await tx`UPDATE equinoxe_documents SET data = ${tx.json(next as never)}, updated_at = NOW() WHERE key = ${this.key}`;
      return next;
    }) as DossierDocument;
  }
  async close() { await this.sql?.end(); }
}
