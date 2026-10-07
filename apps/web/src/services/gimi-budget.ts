import type { AllocationDepartment, AnalyticProfitLossReport } from '@equinoxe/shared';

export const gimiBudget2026: Readonly<Record<string, number>> = {
  'Chiffre d’affaires': 8_012_000,
  Marchandises: -2_724_000,
  'Marge brute': 5_288_000,
  'Sous-traitance': -400_000,
  'Services et biens divers': -1_032_000,
  Personnel: -2_125_000,
  'Charges d’exploitation': -17_000,
  'Produits d’exploitation': 177_000,
  'Coûts hors achats': -3_397_000,
  EBITDA: 1_891_000,
  Amortissements: -190_000,
  'Résultat d’exploitation': 1_701_000,
  Financier: 38_000,
  'Résultat avant impôts': 1_739_000,
  Impôts: -434_000,
  'Résultat après impôts': 1_305_000,
};

/** Onglet « analyse 60 et 70 », colonne « SUM de Budget 2026 ». */
export const gimiRevenueBudget2026: Readonly<Record<AllocationDepartment, number>> = {
  fireInstallation: 291_046 + 1_952_317 + 1_865_472,
  fireMaintenance: 2_087_766,
  intrusion: 427_565,
  led: 784_006,
};

const allocatedSourceLabels = [
  'Marchandises',
  'Sous-traitance',
  'Services et biens divers',
  'Personnel',
  'Charges d’exploitation',
  'Produits d’exploitation',
  'Amortissements',
  'Financier',
  'Impôts',
] as const;

const formulaLabels: Readonly<Record<string, readonly string[]>> = {
  'Marge brute': ['Chiffre d’affaires', 'Marchandises'],
  'Coûts hors achats': ['Sous-traitance', 'Services et biens divers', 'Personnel', 'Charges d’exploitation', 'Produits d’exploitation'],
  EBITDA: ['Marge brute', 'Coûts hors achats'],
  'Résultat d’exploitation': ['EBITDA', 'Amortissements'],
  'Résultat avant impôts': ['Résultat d’exploitation', 'Financier'],
  'Résultat après impôts': ['Résultat avant impôts', 'Impôts'],
};

const ytd2026 = (values: Record<string, number>, closed: string) => Object.entries(values)
  .filter(([month]) => month.startsWith('2026-') && month <= closed)
  .reduce((sum, [, value]) => sum + value, 0);

export function gimiAnalyticBudget2026(report: AnalyticProfitLossReport, departments: AllocationDepartment[]) {
  const values: Record<string, number | undefined> = {
    'Chiffre d’affaires': departments.reduce((sum, department) => sum + gimiRevenueBudget2026[department], 0),
  };

  for (const label of allocatedSourceLabels) {
    const line = report.lines.find(item => item.label === label);
    const companyBudget = gimiBudget2026[label];
    if (!line || companyBudget === undefined) continue;
    const companyActual = ytd2026(line.originalMonthlyValues, report.lastClosedMonth);
    const selectedActual = ytd2026(line.monthlyValues, report.lastClosedMonth);
    if (Math.abs(companyActual) < 0.01) continue;
    const rawShare = selectedActual / companyActual;
    if (!Number.isFinite(rawShare) || rawShare < -0.000001 || rawShare > 1.000001) continue;
    values[label] = companyBudget * Math.min(1, Math.max(0, rawShare));
  }

  for (const [label, terms] of Object.entries(formulaLabels)) {
    const parts = terms.map(term => values[term]);
    if (parts.every((value): value is number => value !== undefined)) values[label] = parts.reduce((sum, value) => sum + value, 0);
  }
  return values;
}

export function budgetVariance(actual: number, budget: number | undefined) {
  return budget === undefined || budget === 0 ? null : (actual - budget) / Math.abs(budget);
}

export function gimiBudgetPeriodFactor(mode: 'annual' | 'ltm' | 'extrapolated', lastClosedMonth?: string) {
  if (mode !== 'annual') return 1;
  const month = Number(lastClosedMonth?.slice(5, 7));
  return Number.isFinite(month) && month > 0 ? Math.min(12, month) / 12 : 1;
}
