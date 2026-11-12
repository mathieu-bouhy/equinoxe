import type { ProfitLossReport, ProfitLossSection } from '@equinoxe/shared';
import { recalculateProfitLoss } from './historical-profit-loss';

// Explicitly reviewed September payroll entries, posted on 5 October.
// Do not infer the payroll period from the posting month or include invoices.
export const SEPTEMBER_PAYROLL_MOVES = [
  'MISC/2026/10/0001', 'MISC/2026/10/0002',
  'MISC/2026/10/0003', 'MISC/2026/10/0004',
];
export interface PayrollCutoffEntry {
  id: number; date: string; move: string; code: string; accountId: string;
  accountLabel: string; label: string; debit: number; credit: number;
}
export interface PayrollCutoffAdjustment {
  period: string; postingPeriod: string; amount: number;
  entries: PayrollCutoffEntry[];
}

/** Adjust the projection base only; the statutory, monthly and cash reports stay posted-date based. */
export function applyLonneuxPayrollCutoff(report: ProfitLossReport, sections: ProfitLossSection[], entries: PayrollCutoffEntry[]) {
  const year = '2026', seen = new Set<number>();
  for (const entry of entries) {
    if (seen.has(entry.id)) throw new Error('Une ligne de paie est présente deux fois dans le rattachement.');
    seen.add(entry.id);
    if (!SEPTEMBER_PAYROLL_MOVES.includes(entry.move) || entry.date !== '2026-10-05' ||
        !/^Septembre 2026\s*-/.test(entry.label) || !/^62\d+$/.test(entry.code) ||
        !Number.isFinite(entry.debit) || !Number.isFinite(entry.credit)) {
      throw new Error('Le rattachement de paie Lonneux ne correspond plus aux OD de septembre vérifiées.');
    }
  }
  if (SEPTEMBER_PAYROLL_MOVES.some(move => !entries.some(entry => entry.move === move))) {
    throw new Error('Une OD de septembre est absente : rattachement de paie incomplet.');
  }
  for (const entry of entries) {
    const owner = sections.filter(section => section.kind === 'accounts' && section.prefixes.some(prefix => entry.code.startsWith(prefix)))
      .sort((a,b) => Math.max(...b.prefixes.filter(prefix=>entry.code.startsWith(prefix)).map(prefix=>prefix.length)) - Math.max(...a.prefixes.filter(prefix=>entry.code.startsWith(prefix)).map(prefix=>prefix.length)))[0];
    const line = owner && report.lines.find(line => line.key === owner.id);
    if (!line) throw new Error(`Rubrique introuvable pour le compte de paie ${entry.code}.`);
    const amount = entry.credit - entry.debit;
    line.values[year] = (line.values[year] ?? 0) + amount;
    line.accounts ??= [];
    let account = line.accounts.find(account => account.id === entry.accountId);
    if (!account) {
      account = { id: entry.accountId, code: entry.code, label: entry.accountLabel, values: {} };
      line.accounts.push(account);
      line.accounts.sort((a,b) => a.code.localeCompare(b.code));
    }
    account.values[year] = (account.values[year] ?? 0) + amount;
  }
  recalculateProfitLoss(report, sections);
  return { period: '2026-09', postingPeriod: '2026-10', amount: entries.reduce((sum,entry)=>sum+entry.credit-entry.debit,0), entries } satisfies PayrollCutoffAdjustment;
}
