import postgres from 'postgres';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, normalize } from 'node:path';
import { config } from '../src/config';
import { reportingKeys } from '../src/repositories/eurodrill-setup';
import { Store } from '../src/repositories/store';
import { AuthService } from '../src/auth/service';
import { createApp } from '../src/http/app';
import { OdooConnector } from '../src/connectors/odoo';
import { cashSnapshotSchema, type CashHistoryStorage } from '../src/repositories/cash-history';
import { SoConsumablesRepository } from '../src/repositories/so-consumables';

// Loopback preview: real Odoo reads, disposable local configuration and user.
// The shared database is read once, then its connection is closed.
if (!config.databaseUrl) throw new Error('Configuration PostgreSQL requise.');
const sql = postgres(config.databaseUrl, { max: 1, ssl: 'require' });
const dir = await mkdtemp(join(tmpdir(), 'eurodrill-preview-'));
try {
  const rows = await sql`SELECT key, data FROM equinoxe_documents WHERE key IN ${sql([...Object.values(reportingKeys), 'bfr-sections.json'])}`;
  for (const row of rows) {
    const data = row.data;
    await Bun.write(join(dir, row.key), JSON.stringify(data));
  }
  const cash = await sql`SELECT key, data FROM equinoxe_documents WHERE key LIKE 'cash-history:%' AND key NOT LIKE '%:archive:%'`;
  for (const row of cash) await Bun.write(join(dir, row.key + '.json'), JSON.stringify(row.data));
} finally { await sql.end(); }
const store = new Store(dir), now = new Date().toISOString();
await store.users.write([{ id: 'local-preview', name: 'Aperçu local Eurodrill', email: 'preview@equinoxe.local', role: 'admin', status: 'active', analysisAccess: [], passwordHash: await Bun.password.hash('Eurodrill-local-review-2026'), passwordSalt: 'embedded-argon2id', createdAt: now, updatedAt: now, lastLoginAt: null }]);
const auth = new AuthService(store); await auth.bootstrap();
const cashHistory: CashHistoryStorage = {
  async read(companyId) { const file = Bun.file(join(dir, `cash-history:${companyId}.json`)); return await file.exists() ? cashSnapshotSchema.parse(await file.json()) : null; },
  async save(value) { const snapshot = cashSnapshotSchema.parse(value); await Bun.write(join(dir, `cash-history:${snapshot.companyId}.json`), JSON.stringify(snapshot)); },
};
const app = createApp(store, auth, new OdooConnector(), cashHistory, new SoConsumablesRepository(), undefined, "equinoxe_eurodrill_preview");
const company = (await store.companies.read()).find(row => row.slug === 'eurodrill')!;
const publicDir = join(import.meta.dir, '../../web/dist');
Bun.serve({ hostname: '127.0.0.1', port: 3002, async fetch(request) {
  const path = new URL(request.url).pathname;
  if (path.startsWith('/v1/') || path === '/health') return app(request);
  const relative = normalize(path).replace(/^([/\\])+/, ''), file = Bun.file(join(publicDir, relative || 'index.html'));
  return new Response(await file.exists() ? file : Bun.file(join(publicDir, 'index.html')));
} });
console.log(JSON.stringify({ preview: `http://127.0.0.1:3002/societes/eurodrill/tableaux-de-bord/compte-resultat`, companyId: company.id, dataDir: dir, sharedWrites: false }));
