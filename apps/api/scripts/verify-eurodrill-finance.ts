import postgres from 'postgres';
import { deepStrictEqual, equal } from 'node:assert';
import { config } from '../src/config';
import { addEurodrillFinance } from '../src/repositories/eurodrill-finance';

if (!config.databaseUrl) throw new Error('PostgreSQL requis.');
const sql=postgres(config.databaseUrl,{max:1,ssl:'require'});
try {
  const original=await sql`SELECT key,data FROM equinoxe_documents WHERE key IN ('companies.json','dashboards.json') ORDER BY key`;
  const company=original.find(row=>row.key==='companies.json')!.data.find((row:{slug:string})=>row.slug==='eurodrill');
  const before=original.find(row=>row.key==='dashboards.json')!.data.filter((row:{companyId:string;slug:string})=>row.companyId!==company.id||!['bilan','evolution-tresorerie'].includes(row.slug));
  await sql`CREATE TEMP TABLE equinoxe_documents (key text PRIMARY KEY,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())`;
  equal((await sql`SELECT relpersistence FROM pg_class WHERE oid='equinoxe_documents'::regclass`)[0].relpersistence,'t');
  for(const row of original)await sql`INSERT INTO equinoxe_documents (key,data) VALUES (${row.key},${sql.json(row.key==='dashboards.json'?before:row.data)})`;
  equal((await addEurodrillFinance(sql)).added,2); equal((await addEurodrillFinance(sql)).added,0);
  const after=(await sql`SELECT data FROM equinoxe_documents WHERE key='dashboards.json'`)[0].data;
  deepStrictEqual(after.slice(0,before.length),before);
  deepStrictEqual((await sql`SELECT data FROM equinoxe_documents WHERE key='companies.json'`)[0].data,original.find(row=>row.key==='companies.json')!.data);
  const archives=await sql`SELECT data FROM equinoxe_documents WHERE key LIKE 'configuration-archive:eurodrill-finance:%'`;
  equal(archives.length,1); deepStrictEqual(archives[0].data.before,before);
  await sql`UPDATE equinoxe_documents SET data=${sql.json(archives[0].data.before)} WHERE key='dashboards.json'`;
  deepStrictEqual((await sql`SELECT data FROM equinoxe_documents WHERE key='dashboards.json'`)[0].data,before);
  console.log('Table temporaire : ajout ciblé, idempotence, préservation des sociétés et restauration vérifiés.');
} catch { console.error('Vérification isolée Eurodrill échouée.'); process.exitCode=1; }
finally { await sql.end(); }
