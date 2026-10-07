import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AnalyticProfitLossReport } from '@equinoxe/shared';
import { GimiBudgetAmountCells, GimiBudgetHeaders, GimiBudgetNote, budgetVariance, gimiBudget2026, gimiBudgetPeriodFactor } from '../src/components/GimiBudgetColumns';
import { gimiAnalyticBudget2026, gimiRevenueBudget2026 } from '../src/services/gimi-budget';

test('le budget Gimi 2026 se réconcilie avec les rubriques visibles', () => {
  expect(gimiBudget2026['Marge brute']).toBe(gimiBudget2026['Chiffre d’affaires'] + gimiBudget2026.Marchandises);
  expect(gimiBudget2026['Coûts hors achats']).toBe(
    gimiBudget2026['Sous-traitance'] +
    gimiBudget2026['Services et biens divers'] +
    gimiBudget2026.Personnel +
    gimiBudget2026['Charges d’exploitation'] +
    gimiBudget2026['Produits d’exploitation'],
  );
  expect(gimiBudget2026.EBITDA).toBe(gimiBudget2026['Marge brute'] + gimiBudget2026['Coûts hors achats']);
  expect(gimiBudget2026['Résultat d’exploitation']).toBe(gimiBudget2026.EBITDA + gimiBudget2026.Amortissements);
  expect(gimiBudget2026['Résultat avant impôts']).toBe(gimiBudget2026['Résultat d’exploitation'] + gimiBudget2026.Financier);
  expect(gimiBudget2026['Résultat après impôts']).toBe(gimiBudget2026['Résultat avant impôts'] + gimiBudget2026.Impôts);
});

test('l’écart utilise la valeur absolue du budget pour rendre les charges lisibles', () => {
  expect(budgetVariance(7_214_000, 8_012_000)).toBeCloseTo(-0.0996, 3);
  expect(budgetVariance(-1_989_000, -2_724_000)).toBeCloseTo(0.2698, 3);
  expect(budgetVariance(0, 0)).toBeNull();
});

test('les en-têtes et le sens favorable sont explicites', () => {
  const html = renderToStaticMarkup(<table><thead><tr><GimiBudgetHeaders /></tr></thead><tbody><tr><GimiBudgetAmountCells label="Marchandises" actual={-1_989_000} /></tr></tbody></table>);
  expect(html).toContain('Budget 2026');
  expect(html).toContain('Écart vs budget');
  expect(html).toContain('variance-cell favorable');
  expect(html).toContain('+27');
});

test('le budget annuel est proratisé sur la période YTD', () => {
  const html = renderToStaticMarkup(<table><tbody><tr><GimiBudgetAmountCells label="Chiffre d’affaires" actual={6_009_000} factor={9/12} /></tr></tbody></table>);
  expect(html).toContain('proratisé sur 9 mois');
  expect(html.replaceAll('\u202f', '')).toContain('6009');
  expect(html).not.toContain('variance-cell favorable');
  expect(html).not.toContain('variance-cell unfavorable');
});

test('la vue analytique décrit les sources de sa ventilation budgétaire', () => {
  const html = renderToStaticMarkup(<table><thead><tr><GimiBudgetHeaders analyticScope /></tr></thead></table>);
  const note = renderToStaticMarkup(<GimiBudgetNote analyticScope comparison="Comparaison analytique." />);
  expect(html).toContain('Budget 2026 — sélection');
  expect(html).toContain('Écart vs budget sélection');
  expect(note).toContain('comptes 70 ventilés selon l’onglet');
  expect(note).toContain('comptes 60 et autres rubriques selon les clés analytiques actuelles');
});

test('le facteur budgétaire analytique suit uniquement la période YTD', () => {
  expect(gimiBudgetPeriodFactor('annual', '2026-09')).toBe(9 / 12);
  expect(gimiBudgetPeriodFactor('ltm', '2026-09')).toBe(1);
  expect(gimiBudgetPeriodFactor('extrapolated', '2026-09')).toBe(1);
  expect(gimiBudgetPeriodFactor('annual')).toBe(1);
});

test('le budget analytique utilise le deuxième onglet pour les 70 et le split réel 2026 pour le reste', () => {
  const sourceLabels=['Chiffre d’affaires','Marchandises','Sous-traitance','Services et biens divers','Personnel','Charges d’exploitation','Produits d’exploitation','Amortissements','Financier','Impôts'];
  const report:AnalyticProfitLossReport={mode:'annual',departments:['led'],lastClosedMonth:'2026-09',periods:[{key:'2026',label:'2026',start:'2026-01-01',end:'2026-09-30',months:['2026-01'],factor:1}],revenueKey:'revenue',unallocated:[],warnings:[],generatedAt:'',lines:sourceLabels.map((label,index)=>({
    key:index===0?'revenue':`line-${index}`,label,kind:'accounts',values:{'2026':index===0?25:-25},monthlyValues:{'2026-01':index===0?25:-25},originalValues:{'2026':index===0?100:-100},originalMonthlyValues:{'2026-01':index===0?100:-100},accounts:[],subsections:[],
  }))};
  const budget=gimiAnalyticBudget2026(report,['led']);
  expect(gimiRevenueBudget2026.fireInstallation).toBe(4_108_835);
  expect(budget['Chiffre d’affaires']).toBe(784_006);
  expect(budget.Marchandises).toBe(-681_000);
  expect(budget['Marge brute']).toBe(103_006);
  expect(budget['Coûts hors achats']).toBe(-849_250);
  expect(budget.EBITDA).toBe(-746_244);
  expect(budget['Résultat après impôts']).toBe(-892_744);
});

test('une clé 2026 non calculable ne fabrique pas de budget analytique', () => {
  const report:AnalyticProfitLossReport={mode:'annual',departments:['led'],lastClosedMonth:'2026-09',periods:[],revenueKey:'revenue',unallocated:[],warnings:[],generatedAt:'',lines:[{
    key:'goods',label:'Marchandises',kind:'accounts',values:{},monthlyValues:{'2026-01':10},originalValues:{},originalMonthlyValues:{'2026-01':0},accounts:[],subsections:[],
  }]};
  expect(gimiAnalyticBudget2026(report,['led']).Marchandises).toBeUndefined();
});
