import postgres from 'postgres';
import { readFile } from 'node:fs/promises';
import { config } from '../src/config';
import { CashHistoryRepository, cashSnapshotSchema } from '../src/repositories/cash-history';
import { addEurodrillFinance } from '../src/repositories/eurodrill-finance';
import { buildCashEvolution } from '../src/services/cash-history';
import type { BalanceReport } from '@equinoxe/shared';

if (!config.databaseUrl || !process.argv[2] || !process.argv[3]) throw new Error('Fichiers de contrôle trésorerie et bilan requis.');
const snapshot = cashSnapshotSchema.parse(JSON.parse(await readFile(process.argv[2], 'utf8')));
const balance = JSON.parse(await readFile(process.argv[3], 'utf8')) as BalanceReport;
const report = buildCashEvolution(snapshot, snapshot.through);
if (report.months.some(month => Math.abs(month.difference) > .01)) throw new Error('Trésorerie non rapprochée.');
const balanceCash = balance.assets.find(line=>line.key==='cash');
for (const period of balance.periods ?? []) {
  const month = report.months.find(row=>row.month===period.asOf.slice(0,7));
  if (!month || Math.abs(month.closing-(balanceCash?.values[period.year] ?? NaN)) > .01 || !Number.isFinite(balanceCash?.values[period.year])) throw new Error('Bilan et trésorerie non rapprochés.');
}
const sql = postgres(config.databaseUrl, { max: 1, ssl: 'require' });
const repository = new CashHistoryRepository(config.databaseUrl);
try {
  const companies = await sql`SELECT data FROM equinoxe_documents WHERE key='companies.json'`;
  const company = companies[0].data.find((row:{id:string;slug:string})=>row.slug==='eurodrill');
  if (!company || company.id!==snapshot.companyId) throw new Error('Société incorrecte.');
  if (process.argv.includes('--apply')) {
    // Preserve a previous source snapshot, should this explicit import be repeated.
    const previous = await repository.read(company.id);
    if (previous) await sql`INSERT INTO equinoxe_documents (key,data) VALUES (${`cash-history:${company.id}:archive:${previous.startedAt}`},${sql.json(previous as never)}) ON CONFLICT DO NOTHING`;
    await repository.save(snapshot);
    const saved = await repository.read(company.id);
    if (saved?.startedAt!==snapshot.startedAt || saved.movements.length!==snapshot.movements.length) throw new Error('Relecture de l’historique non conforme.');
    const boards = await addEurodrillFinance(sql);
    console.log(JSON.stringify({saved:true,...boards,months:report.months.length,movements:report.movementCount,closing:report.closing,balanceReconciled:true}));
  } else console.log(JSON.stringify({validated:true,months:report.months.length,movements:report.movementCount,closing:report.closing,balanceReconciled:true}));
} catch {
  console.error('Configuration Eurodrill non terminée ; les détails de connexion restent masqués.'); process.exitCode=1;
} finally { await sql.end(); await repository.close(); }
