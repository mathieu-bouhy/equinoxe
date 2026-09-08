// Explicit import, never called at startup. Odoo stays read-only.
// From apps/api: bun --env-file=.env.local src/scripts/import-gimi-cash-history.ts --apply
import { config } from '../config';
import { Store } from '../repositories/store';
import { CashHistoryRepository } from '../repositories/cash-history';
import { OdooConnector } from '../connectors/odoo';
import { buildCashEvolution, cashCutoff } from '../services/cash-history';

if (!config.databaseUrl) throw new Error('PostgreSQL est obligatoire.');
const store = new Store(config.dataDir, config.databaseUrl);
const company = (await store.companies.read()).find(row => row.slug === 'gimi' && row.status === 'active');
if (!company) throw new Error('Gimi introuvable.');
const setting = (await store.reportSettings.read()).find(row => row.companyId === company.id);
if (!setting) throw new Error('Mois clôturé introuvable.');
const repository = new CashHistoryRepository(config.databaseUrl);
const snapshot = await new OdooConnector().getCashHistory(company.id, cashCutoff(setting.lastClosedMonth));
const report = buildCashEvolution(snapshot, snapshot.through);
if (report.months.some(month => Math.abs(month.difference) > .01)) throw new Error('Écart de contrôle.');
console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'application' : 'contrôle',
  through: report.through, movements: report.movementCount, accounts: report.accounts.length, days: report.days.length,
  months: report.months.length, opening: report.opening, closing: report.closing,
  maximumControlGap: Math.max(...report.months.map(month => Math.abs(month.difference))) }));
if (process.argv.includes('--apply')) {
  await repository.save(snapshot);
  const saved = await repository.read(company.id);
  if (!saved || saved.importedAt !== snapshot.importedAt || saved.movements.length !== snapshot.movements.length) throw new Error('Relecture non conforme.');
  await store.dashboards.mutate(current => {
    const rows = [...current];
    for (const [slug, label] of [['flux-tresorerie', 'Flux de trésorerie'], ['evolution-tresorerie', 'Évolution trésorerie']]) {
      if (!rows.some(row => row.companyId === company.id && row.slug === slug)) rows.push({
        id: crypto.randomUUID(), companyId: company.id, slug, label,
        order: Math.max(0, ...rows.filter(row => row.companyId === company.id).map(row => row.order)) + 1, status: 'active',
      });
    }
    return { values: rows, result: null };
  });
  console.log('Historique enregistré et relu dans PostgreSQL ; deux onglets ajoutés au registre Gimi.');
}
await repository.close();
