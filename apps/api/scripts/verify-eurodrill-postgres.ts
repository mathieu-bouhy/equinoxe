import postgres from 'postgres';
import { deepStrictEqual, ok } from 'node:assert';
import { config } from '../src/config';
import { stageEurodrill, reportingKeys } from '../src/repositories/eurodrill-setup';

if (!config.databaseUrl) throw new Error('PostgreSQL Equinoxe requis.');
const url = new URL(config.databaseUrl);
const sql = postgres(config.databaseUrl, { max: 1, ssl: url.searchParams.get('sslmode') === 'require' || url.hostname.endsWith('.render.com') ? 'require' : undefined });
try {
  const original = await sql`SELECT key, data FROM equinoxe_documents WHERE key IN ${sql(Object.values(reportingKeys))} ORDER BY key`;
  await sql`CREATE TEMP TABLE equinoxe_documents (key text PRIMARY KEY, data jsonb NOT NULL, updated_at timestamptz NOT NULL DEFAULT now())`;
  const target = await sql`SELECT relpersistence FROM pg_class WHERE oid = 'equinoxe_documents'::regclass`;
  ok(target[0].relpersistence === 't');
  for (const row of original) await sql`INSERT INTO equinoxe_documents (key, data) VALUES (${row.key}, ${sql.json(row.data)})`;
  const results = await Promise.all([stageEurodrill(sql, '2026-07'), stageEurodrill(sql, '2026-07')]);
  ok(results.filter(result => result.created).length === 1);
  ok(results[0].company.id === results[1].company.id);
  const after = await sql`SELECT key, data FROM equinoxe_documents WHERE key IN ${sql(Object.values(reportingKeys))} ORDER BY key`;
  const euroId = results[0].company.id;
  for (const row of after) deepStrictEqual(row.data.filter((item: { id?: string; companyId?: string }) => item.id !== euroId && item.companyId !== euroId), original.find(before => before.key === row.key)!.data);
  const archive = await sql`SELECT data FROM equinoxe_documents WHERE key = ${results.find(result => result.created)!.archiveKey!}`;
  // Restore only the temporary table, then compare every restored document.
  for (const [key, data] of Object.entries(archive[0].data.before)) await sql`UPDATE equinoxe_documents SET data = ${sql.json(data as never)} WHERE key = ${key}`;
  const restored = await sql`SELECT key, data FROM equinoxe_documents WHERE key IN ${sql(Object.values(reportingKeys))} ORDER BY key`;
  deepStrictEqual([...restored], [...original]);
  console.log('Table temporaire : création transactionnelle, concurrence sans doublon, préservation des sociétés et restauration vérifiées.');
} catch {
  console.error('Vérification PostgreSQL Eurodrill échouée.'); process.exitCode = 1;
} finally { await sql.end(); }
