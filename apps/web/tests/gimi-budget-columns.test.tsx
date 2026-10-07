import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { GimiBudgetAmountCells, GimiBudgetHeaders, GimiBudgetNote, budgetVariance, gimiBudget2026, gimiBudgetPeriodFactor } from '../src/components/GimiBudgetColumns';

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

test('la vue analytique indique clairement que le budget reste celui de la société', () => {
  const html = renderToStaticMarkup(<table><thead><tr><GimiBudgetHeaders companyScope /></tr></thead></table>);
  const note = renderToStaticMarkup(<GimiBudgetNote companyScope comparison="Comparaison analytique." />);
  expect(html).toContain('Budget 2026 — société');
  expect(html).toContain('Écart sélection vs budget société');
  expect(note).toContain('Budget 2026 de la société entière');
});

test('le facteur budgétaire analytique suit uniquement la période YTD', () => {
  expect(gimiBudgetPeriodFactor('annual', '2026-09')).toBe(9 / 12);
  expect(gimiBudgetPeriodFactor('ltm', '2026-09')).toBe(1);
  expect(gimiBudgetPeriodFactor('extrapolated', '2026-09')).toBe(1);
  expect(gimiBudgetPeriodFactor('annual')).toBe(1);
});
