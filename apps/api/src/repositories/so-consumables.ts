import postgres from 'postgres';
import { z } from 'zod';
import type { SoConsumablesSnapshot } from '@equinoxe/shared';
import { validateSoConsumables } from '../services/so-consumables';

const id=z.number().int().positive(),amount=z.number().finite(),date=z.string().regex(/^202[3-6]-\d{2}-\d{2}$/),department=z.enum(['fireInstallation','fireMaintenance']),accountDepartment=z.enum(['fireInstallation','fireMaintenance','other']).nullable();
export const soConsumablesSchema:z.ZodType<SoConsumablesSnapshot>=z.object({
  version:z.literal(1),companyId:z.string().min(1),from:z.literal('2023-01-01'),through:date,startedAt:z.string().datetime(),importedAt:z.string().datetime(),unlinkedInvoiceLines:z.number().int().nonnegative(),
  accounts:z.array(z.object({id:z.string().regex(/^\d+$/),code:z.string(),keyId:z.string().nullable(),department:accountDepartment,hasFire:z.boolean()})),
  orders:z.array(z.object({id,reference:z.string(),date,year:z.number().int().min(2023).max(2026),currency:z.string().min(1),department:department.nullable(),status:z.enum(['allocated','ambiguous','currency']),amount,
    lines:z.array(z.object({id,productId:id,label:z.string(),quantity:amount,unitPrice:amount,discount:amount,unitPriceHt:amount,amount,sourceAmount:amount.optional(),tracked:z.boolean()})),
    invoices:z.array(z.object({lineId:id,invoiceId:id,reference:z.string(),date,accountId:z.string(),accountCode:z.string(),department:accountDepartment})),
  })),
});
export interface SoConsumablesStorage {read(companyId:string):Promise<SoConsumablesSnapshot|null>;save(snapshot:SoConsumablesSnapshot):Promise<void>}
export class SoConsumablesRepository implements SoConsumablesStorage {
  private sql?:ReturnType<typeof postgres>;
  constructor(url?:string,connection?:ReturnType<typeof postgres>){if(connection)this.sql=connection;else if(url)this.sql=postgres(url,{max:2,connect_timeout:15,idle_timeout:20,ssl:new URL(url).searchParams.get('sslmode')==='require'||new URL(url).hostname.endsWith('.render.com')?'require':undefined});}
  private connection(){if(!this.sql)throw new Error('PostgreSQL est requis pour cette analyse.');return this.sql;}
  async read(companyId:string){
    const sql=this.connection(),rows=await sql`SELECT data FROM equinoxe_documents WHERE key=${`so-consumables:${companyId}`}`;
    if(!rows.length)return null;
    const snapshot=soConsumablesSchema.parse(rows[0].data);
    if(snapshot.companyId!==companyId)throw new Error('Société incohérente.');
    validateSoConsumables(snapshot);return snapshot;
  }
  async save(input:SoConsumablesSnapshot){
    const snapshot=soConsumablesSchema.parse(input);validateSoConsumables(snapshot);
    const sql=this.connection(),key=`so-consumables:${snapshot.companyId}`;
    await sql.begin(async tx=>{
      await tx`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const previous=await tx`SELECT data FROM equinoxe_documents WHERE key=${key} FOR UPDATE`;
      if(previous[0]){
        const old=soConsumablesSchema.parse(previous[0].data);
        if(old.startedAt>snapshot.startedAt)throw new Error('Un calcul plus récent existe déjà.');
        await tx`INSERT INTO equinoxe_documents (key,data) VALUES (${`${key}:archive:${old.startedAt}`},${tx.json(old as never)}) ON CONFLICT (key) DO NOTHING`;
      }
      await tx`INSERT INTO equinoxe_documents (key,data) VALUES (${key},${tx.json(snapshot as never)}) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data,updated_at=NOW()`;
    });
  }
  /** Explicit retirement only, never invoked by startup or GET. Fully recoverable. */
  async archivePreviousAnalysis(companyId:string){
    const sql=this.connection(),key=`purchase-so:${companyId}`;
    return sql.begin(async tx=>{
      await tx`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const previous=await tx`SELECT data FROM equinoxe_documents WHERE key=${key} FOR UPDATE`;
      if(!previous.length)return false;
      if(previous[0].data.companyId!==companyId)throw new Error('Société de l’archive incohérente.');
      const archived=`${key}:retired:${new Date().toISOString()}`;
      await tx`INSERT INTO equinoxe_documents (key,data) VALUES (${archived},${tx.json(previous[0].data)})`;
      const verified=await tx`SELECT data = ${tx.json(previous[0].data)}::jsonb AS identical FROM equinoxe_documents WHERE key=${archived}`;
      if(!verified[0]?.identical)throw new Error('Archive non vérifiée.');
      await tx`DELETE FROM equinoxe_documents WHERE key=${key}`;
      return true;
    });
  }
  async close(){await this.sql?.end();}
}
