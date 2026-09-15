import type { AccountAllocationAmounts, AccountMonthlyAmounts, ProfitLossReport } from '@equinoxe/shared';
import type { OdooConnector } from '../connectors/odoo';
import { extrapolateProfitLoss } from './extrapolated-profit-loss';

export function allocationAmountsCutoff(lastClosedMonth: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(lastClosedMonth)) throw new Error('Mois clôturé invalide.');
  const month = lastClosedMonth > '2026-12' ? '2026-12' : lastClosedMonth;
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number, 0)).toISOString().slice(0,10);
}

/** Whole-account amounts, before analytical allocation. Reuses P&L annualisation unchanged. */
export function buildAccountAllocationAmounts(rows: AccountMonthlyAmounts[], lastClosedMonth: string): AccountAllocationAmounts {
  const through = allocationAmountsCutoff(lastClosedMonth);
  const accounts = rows.map(row => ({ id: row.accountId, code: '', label: '', values: {
    '2025': Object.entries(row.values).filter(([month]) => month.startsWith('2025-') && month <= through.slice(0,7)).reduce((sum,[,value]) => sum + value,0),
    '2026': Object.entries(row.values).filter(([month]) => month.startsWith('2026-') && month <= through.slice(0,7)).reduce((sum,[,value]) => sum + value,0),
  } }));
  const report: ProfitLossReport = { years: [2025,2026], lines: [{ key: 'accounts', label: 'Comptes', values: {}, accounts }], generatedAt: new Date().toISOString(), source: 'odoo' };
  if (lastClosedMonth.startsWith('2026-')) extrapolateProfitLoss(report,2026,Number(lastClosedMonth.slice(5,7)));
  return { lastClosedMonth, through, generatedAt: report.generatedAt,
    accounts: accounts.map(row => ({ accountId: row.id,
      amount2025: lastClosedMonth >= '2025-12' ? row.values['2025'] : null,
      amount2026: lastClosedMonth >= '2026-01' ? row.values['2026'] : null,
    })) };
}

export async function loadAccountAllocationAmounts(connector: OdooConnector, lastClosedMonth: string) {
  const through = allocationAmountsCutoff(lastClosedMonth);
  const accounts = await connector.getProfitLossAccounts();
  // Includes unclassified and unassigned accounts; zero only after a successful Odoo read.
  const rows = through < '2025-01-01' ? accounts.map(account => ({ accountId: account.id, values: {} }))
    : await connector.getProfitLossAccountMonths(accounts.map(account => account.id),[2025,2026],through);
  return buildAccountAllocationAmounts(rows,lastClosedMonth);
}
