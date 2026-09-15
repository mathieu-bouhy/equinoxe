import type { Company, ReportSettings } from '@equinoxe/shared';
import type { CashHistoryStorage } from '../repositories/cash-history';
import type { OdooConnector } from '../connectors/odoo';
import { ConnectorError } from '../connectors/odoo';
import { buildCashEvolution, cashCutoff, cashMonthlyCsv } from '../services/cash-history';

export async function cashHistoryResponse(options: {
  request: Request; company: Company; isAdmin: boolean; setting?: ReportSettings;
  repository: CashHistoryStorage; connector: OdooConnector; exportCsv: boolean;
}): Promise<Response> {
  const { request, company, isAdmin, setting, repository, connector, exportCsv } = options;
  const fail = (message: string, status: number) => Response.json({ error: { code: 'CASH_HISTORY', message } }, { status });
  if (!['gimi', 'eurodrill'].includes(company.slug) || company.connectorType !== 'odoo') return fail('Ce suivi n’est pas disponible pour cette société.', 409);
  if (request.method !== 'GET' && (request.method !== 'POST' || exportCsv)) return fail('Méthode non autorisée.', 405);
  if (request.method === 'POST' && !isAdmin) return fail('Seul un administrateur peut importer l’historique.', 403);
  if (!setting) return fail('Configurez le dernier mois clôturé.', 422);
  let through: string;
  try { through = cashCutoff(setting.lastClosedMonth); } catch { return fail('Sélectionnez un mois à partir de janvier 2024.', 422); }
  try {
    let snapshot = await repository.read(company.id);
    if (request.method === 'POST') {
      const imported = await connector.getCashHistory(company.id, through);
      // Reject incomplete or duplicate imports before replacing the persisted snapshot.
      const report = buildCashEvolution(imported, through);
      if (report.months.some(month => Math.abs(month.difference) > .01)) return fail('Écart de contrôle : historique précédent conservé.', 409);
      await repository.save(imported);
      snapshot = await repository.read(company.id);
    }
    if (!snapshot) return exportCsv ? fail('Importez d’abord l’historique.', 409) : Response.json({ data: null });
    const report = buildCashEvolution(snapshot, through);
    if (exportCsv) return new Response(cashMonthlyCsv(report), { headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${company.slug}-tresorerie-2024-01-${report.through.slice(0,7)}.csv"`,
      'cache-control': 'no-store',
    } });
    return Response.json({ data: report }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    return fail(error instanceof ConnectorError ? error.message : 'Impossible de lire ou enregistrer l’historique PostgreSQL. Les données précédentes sont conservées.', 503);
  }
}
