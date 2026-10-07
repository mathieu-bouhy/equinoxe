import { Fragment } from 'react';
import { budgetVariance, gimiBudget2026 } from '../services/gimi-budget';
export { budgetVariance, gimiBudget2026, gimiBudgetPeriodFactor } from '../services/gimi-budget';

const budgetRevenue = gimiBudget2026['Chiffre d’affaires'];
const amount = (value: number) => new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 }).format(value / 1000);
const ratio = (value: number) => new Intl.NumberFormat('fr-BE', { style: 'percent', maximumFractionDigits: 0 }).format(value);
const signedRatio = (value: number) => new Intl.NumberFormat('fr-BE', { style: 'percent', maximumFractionDigits: 1, signDisplay: 'always' }).format(value);
const points = (value: number) => `${new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 1, signDisplay: 'always' }).format(value * 100)} pt`;

const tone = (value: number | null) => value === null || Math.abs(value) < 0.0005 ? '' : value > 0 ? ' favorable' : ' unfavorable';
const budgetTitle = (label: string) => label === 'Amortissements'
  ? 'Budget Excel : amortissements (-200 k€) et réduction de valeur sur créances (+10 k€), regroupés pour réconcilier les totaux.'
  : 'Budget Gimi 2026 · 12 mois';

export function GimiBudgetHeaders({ analyticScope = false }: { analyticScope?: boolean }) {
  return <Fragment>
    <th rowSpan={2} className="budget-header">{analyticScope ? 'Budget 2026 — sélection' : 'Budget 2026'}</th>
    <th rowSpan={2} className="variance-header">{analyticScope ? 'Écart vs budget sélection' : 'Écart vs budget'}</th>
  </Fragment>;
}

export function GimiBudgetAmountCells({ label, actual, factor = 1, budget: override }: { label: string; actual: number; factor?: number; budget?: number | null }) {
  const annualBudget = override === undefined ? gimiBudget2026[label] : override ?? undefined, budget = annualBudget === undefined ? undefined : annualBudget * factor, variance = budgetVariance(actual, budget);
  return <Fragment>
    <td className="budget-cell" title={budget === undefined ? 'Budget non disponible pour ce niveau de détail.' : factor === 1 ? budgetTitle(label) : `${budgetTitle(label)} · proratisé sur ${Math.round(factor * 12)} mois.`}>{budget === undefined ? '—' : amount(budget)}</td>
    <td className={`variance-cell${tone(variance)}`} title="(Montant affiché − budget) ÷ valeur absolue du budget. Un résultat positif est favorable.">{variance === null ? '—' : signedRatio(variance)}</td>
  </Fragment>;
}

export function GimiBudgetRatioCells({ label, actual, revenue, budget: override, revenueBudget: revenueOverride }: { label: string; actual: number; revenue: number; budget?: number | null; revenueBudget?: number | null }) {
  const budget = override === undefined ? gimiBudget2026[label] : override ?? undefined, revenueBudget = revenueOverride === undefined ? budgetRevenue : revenueOverride ?? undefined;
  if (budget === undefined || !revenueBudget || !revenue) return <Fragment><td className="budget-cell">—</td><td className="variance-cell">—</td></Fragment>;
  const budgetRatio = budget / revenueBudget, actualRatio = actual / revenue, difference = actualRatio - budgetRatio;
  return <Fragment><td className="budget-cell">{ratio(budgetRatio)}</td><td className={`variance-cell${tone(difference)}`}>{points(difference)}</td></Fragment>;
}

export function EmptyGimiBudgetCells() {
  return <Fragment><td className="budget-cell">—</td><td className="variance-cell">—</td></Fragment>;
}

export function GimiBudgetNote({ comparison, analyticScope = false }: { comparison: string; analyticScope?: boolean }) {
  return <p className="report-note budget-note">{analyticScope?'Budget analytique 2026 : comptes 70 ventilés selon l’onglet « analyse 60 et 70 » ; comptes 60 et autres rubriques selon les clés analytiques actuelles appliquées au réalisé 2026. Les formules sont recalculées.':'Budget 2026 issu du fichier Gimi « Budget 2026 - 12 mois ».'} {comparison} L’écart est calculé par rapport à la valeur absolue du budget : positif = favorable, négatif = défavorable.</p>;
}
