import postgres from 'postgres';
import { deepStrictEqual } from 'node:assert';
import { config } from '../src/config';
import { SoConsumablesRepository } from '../src/repositories/so-consumables';
import type { SoConsumablesSnapshot } from '@equinoxe/shared';

if(!config.databaseUrl)throw new Error('PostgreSQL requis.');
const url=new URL(config.databaseUrl),sql=postgres(config.databaseUrl,{max:1,ssl:url.searchParams.get('sslmode')==='require'||url.hostname.endsWith('.render.com')?'require':undefined});
try{
  // The session-local temporary table shadows the real table. No real data is touched.
  await sql`CREATE TEMP TABLE equinoxe_documents (key text PRIMARY KEY,data jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now())`;
  const target=await sql`SELECT c.relpersistence FROM pg_class c WHERE c.oid='equinoxe_documents'::regclass`;
  if(target[0].relpersistence!=='t')throw new Error('Refus : table non temporaire.');
  const repo=new SoConsumablesRepository(undefined,sql),companyId='isolated-fixture';
  const snapshot:SoConsumablesSnapshot={version:1,companyId,from:'2023-01-01',through:'2026-07-31',startedAt:'2026-09-09T10:00:00.000Z',importedAt:'2026-09-09T10:01:00.000Z',accounts:[],orders:[],unlinkedInvoiceLines:0};
  const check=(condition:boolean)=>{if(!condition)throw new Error('Contrôle PostgreSQL échoué.');};
  check(await repo.read(companyId)===null);await repo.save(snapshot);deepStrictEqual(await repo.read(companyId),snapshot);
  const newer={...snapshot,startedAt:'2026-09-09T11:00:00.000Z'};
  await Promise.allSettled([repo.save(newer),repo.save(snapshot)]);check((await repo.read(companyId))?.startedAt===newer.startedAt);
  const archive=await sql`SELECT data FROM equinoxe_documents WHERE key=${`so-consumables:${companyId}:archive:${snapshot.startedAt}`}`;
  check(archive.length===1);await repo.save({...archive[0].data,startedAt:'2026-09-09T12:00:00.000Z'});
  check((await repo.read(companyId))?.startedAt==='2026-09-09T12:00:00.000Z');
  const legacy={companyId,fixture:true};await sql`INSERT INTO equinoxe_documents (key,data) VALUES (${`purchase-so:${companyId}`},${sql.json(legacy)})`;
  check(await repo.archivePreviousAnalysis(companyId)===true);check(await repo.archivePreviousAnalysis(companyId)===false);
  const retired=await sql`SELECT data FROM equinoxe_documents WHERE key LIKE ${`purchase-so:${companyId}:retired:%`}`;
  deepStrictEqual(retired[0].data,legacy);
  check(await repo.read('other-company')===null);
  console.log('PostgreSQL : création, relecture, concurrence, restauration et archivage de l’ancienne analyse vérifiés dans une table temporaire isolée.');
}finally{await sql.end();}
