import { Fragment } from 'react';

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

const budgetRevenue = gimiBudget2026['Chiffre d’affaires'];
const amount = (value: number) => new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 }).format(value / 1000);
const ratio = (value: number) => new Intl.NumberFormat('fr-BE', { style: 'percent', maximumFractionDigits: 0 }).format(value);
const signedRatio = (value: number) => new Intl.NumberFormat('fr-BE', { style: 'percent', maximumFractionDigits: 1, signDisplay: 'always' }).format(value);
const points = (value: number) => `${new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 1, signDisplay: 'always' }).format(value * 100)} pt`;

export function budgetVariance(actual: number, budget: number | undefined) {
  return budget === undefined || budget === 0 ? null : (actual - budget) / Math.abs(budget);
}

const tone = (value: number | null) => value === null || Math.abs(value) < 0.0005 ? '' : value > 0 ? ' favorable' : ' unfavorable';
const budgetTitle = (label: string) => label === 'Amortissements'
  ? 'Budget Excel : amortissements (-200 k€) et réduction de valeur sur créances (+10 k€), regroupés pour réconcilier les totaux.'
  : 'Budget Gimi 2026 · 12 mois';

export function GimiBudgetHeaders() {
  return <Fragment><th rowSpan={2} className="budget-header">Budget 2026</th><th rowSpan={2} className="variance-header">Écart vs budget</th></Fragment>;
}

export function GimiBudgetAmountCells({ label, actual, factor = 1 }: { label: string; actual: number; factor?: number }) {
  const annualBudget = gimiBudget2026[label], budget = annualBudget === undefined ? undefined : annualBudget * factor, variance = budgetVariance(actual, budget);
  return <Fragment>
    <td className="budget-cell" title={budget === undefined ? 'Budget non disponible pour ce niveau de détail.' : factor === 1 ? budgetTitle(label) : `${budgetTitle(label)} · proratisé sur ${Math.round(factor * 12)} mois.`}>{budget === undefined ? '—' : amount(budget)}</td>
    <td className={`variance-cell${tone(variance)}`} title="(Montant affiché − budget) ÷ valeur absolue du budget. Un résultat positif est favorable.">{variance === null ? '—' : signedRatio(variance)}</td>
  </Fragment>;
}

export function GimiBudgetRatioCells({ label, actual, revenue }: { label: string; actual: number; revenue: number }) {
  const budget = gimiBudget2026[label];
  if (budget === undefined || !budgetRevenue || !revenue) return <Fragment><td className="budget-cell">—</td><td className="variance-cell">—</td></Fragment>;
  const budgetRatio = budget / budgetRevenue, actualRatio = actual / revenue, difference = actualRatio - budgetRatio;
  return <Fragment><td className="budget-cell">{ratio(budgetRatio)}</td><td className={`variance-cell${tone(difference)}`}>{points(difference)}</td></Fragment>;
}

export function EmptyGimiBudgetCells() {
  return <Fragment><td className="budget-cell">—</td><td className="variance-cell">—</td></Fragment>;
}

export function GimiBudgetNote({ comparison }: { comparison: string }) {
  return <p className="report-note budget-note">Budget 2026 issu du fichier Gimi « Budget 2026 - 12 mois ». {comparison} L’écart est calculé par rapport à la valeur absolue du budget : positif = favorable, négatif = défavorable.</p>;
}
