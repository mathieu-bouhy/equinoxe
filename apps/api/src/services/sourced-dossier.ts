import { dossierYears, forecastYears, operatingInputs, type DossierDocument, type DossierReport, type FinancialRow, type DossierAssumptions, type DossierSource } from '@equinoxe/shared';
import { sourceAmount, sourceCell } from './dossier-source';

const historical = [2022, 2023, 2024, 2025];
const allYears = [...historical, ...forecastYears];
const resultSheet = 'Compte de resultats';
const sum = (values: Array<number | null>): number | null => values.some(v => v === null) ? null : (values as number[]).reduce((a, b) => a + b, 0);
const negate = (v: number | null) => v === null ? null : -v;
const values = (fn: (year: number) => number | null) => Object.fromEntries(allYears.map(y => [y, fn(y)]));

export function loanSchedule(a: DossierAssumptions) {
  if (a.loanAmount === null || a.loanAmount === 0) return forecastYears.map(year => ({ year, opening: 0, interest: 0, principal: 0, payment: 0, closing: 0 }));
  if (a.loanYears === null || a.loanRate === null) throw new Error('Financement incomplet.');
  const payment = a.loanRate === 0 ? a.loanAmount / a.loanYears : a.loanAmount * a.loanRate / (1 - (1 + a.loanRate) ** -a.loanYears);
  let remaining = a.loanAmount;
  return Array.from({ length: a.loanYears }, (_, i) => {
    const opening = remaining, interest = opening * a.loanRate!, principal = Math.min(opening, payment - interest);
    remaining = Math.max(0, opening - principal);
    return { year: 2026 + i, opening, interest, principal, payment: interest + principal, closing: remaining };
  });
}

export function buildDossierReport(document: DossierDocument): DossierReport {
  const s = document.source, a = document.assumptions;
  const sourceRow = (sheet: string, row: number, id: string, label?: string, sign = 1): FinancialRow => ({
    id, label: label ?? String(sourceCell(s, sheet, `A${row}`) ?? ''),
    code: String(sourceCell(s, sheet, `C${row}`) ?? ''),
    values: values(y => { const n = sourceAmount(s, sheet, row, y); return n === null ? null : n * sign; }),
    note: `${s.fileName} · ${sheet}, ligne ${row}. Rubrique publiée, pas un compte du grand livre.`,
  });
  const calculated = (id: string, label: string, rows: FinancialRow[], kind: FinancialRow['kind'] = 'calculation'): FinancialRow => ({
    id, label, kind, values: values(y => sum(rows.map(r => r.values[y] ?? null))), children: rows,
  });
  const unknown = (id: string, label: string, note: string): FinancialRow => ({ id, label, values: values(() => null), note });
  const forecastInput = (id: string, label: string, key: 'oldSalary' | 'newSalary' | 'rentDifference' | 'capex' | 'existingPrincipal' | 'dividends' | 'bfrChange', sign: number): FinancialRow => ({
    id, label, kind: 'adjustment', note: 'Hypothèse de simulation uniquement, sans modification de l’historique.',
    values: values(y => y < 2026 ? null : a[key][y as 2026] === null ? null : a[key][y as 2026]! * sign),
  });
  const margin = sourceRow(resultSheet, 3, 'margin', 'Marge brute publiée (après achats et services)'); margin.kind = 'total';
  let prior = margin.values[2025];
  for (const year of forecastYears) {
    const growth = a.growth[year]; prior = prior === null || growth === null ? null : prior * (1 + growth);
    margin.values[year] = prior;
  }
  const inputs = Object.fromEntries(operatingInputs.map(i => {
    const sign = i.id === 'financialIncome' ? 1 : -1;
    const row = sourceRow(resultSheet, i.row, i.id, i.label, sign);
    for (const year of forecastYears) { const n = a.amounts[i.id]?.[year] ?? null; row.values[year] = n === null ? null : sign * n; }
    return [i.id, row];
  }));
  const oldSalary = forecastInput('oldSalary', 'Retrait du salaire de l’ancien dirigeant', 'oldSalary', 1);
  const newSalary = forecastInput('newSalary', 'Salaire du nouveau dirigeant', 'newSalary', -1);
  const rent = forecastInput('rentDifference', 'Différence de loyer', 'rentDifference', -1);
  // Published EBITDA is kept as reported. Forecast EBITDA excludes D&A, impairments and provisions.
  const ebitda = sourceRow('Ratios financiers', 5, 'ebitda', 'EBITDA'); ebitda.kind = 'total';
  const operating = sourceRow(resultSheet, 14, 'operating', 'Résultat d’exploitation'); operating.kind = 'calculation';
  const pretax = sourceRow(resultSheet, 22, 'pretax', 'Résultat avant impôts'); pretax.kind = 'calculation';
  const tax = sourceRow(resultSheet, 25, 'tax', 'Impôts sur le résultat', -1);
  const net = sourceRow(resultSheet, 26, 'net', 'Résultat après impôts'); net.kind = 'total';
  const schedule = loanSchedule(a);
  const interest: FinancialRow = { id: 'newInterest', label: 'Intérêts du nouveau crédit', values: values(y => y < 2026 ? null : -(schedule.find(d => d.year === y)?.interest ?? 0)), kind: 'adjustment', note: 'Crédit d’acquisition simulé dès l’exercice 2026. Aucun intérêt historique réattribué.' };
  const ebitdaInputs = [margin, inputs.personnel, rent, oldSalary, newSalary, inputs.otherExpenses, inputs.nonRecurring];
  for (const year of forecastYears) {
    ebitda.values[year] = sum(ebitdaInputs.map(r => r.values[year]));
    operating.values[year] = sum([ebitda.values[year], inputs.depreciation.values[year], inputs.impairment.values[year], inputs.provisions.values[year]]);
    pretax.values[year] = sum([operating.values[year], inputs.financialIncome.values[year], inputs.financialExpenses.values[year], interest.values[year]]);
    tax.values[year] = pretax.values[year] === null || a.taxRate === null ? null : -Math.max(0, pretax.values[year]!) * a.taxRate;
    net.values[year] = sum([pretax.values[year], tax.values[year]]);
  }
  ebitda.note = 'Historique : EBITDA publié dans Ratios financiers. Prévisions : marge publiée moins personnel et autres charges décaissables, avec ajustements. Les conventions de l’export peuvent différer ; les montants publiés restent inchangés.';
  const pnl = [sourceRow(resultSheet, 5, 'revenue', 'Chiffre d’affaires'),
    unknown('goods', 'Marchandises et approvisionnements', 'Non ventilés dans le schéma abrégé.'),
    unknown('otherIncome', 'Autres produits d’exploitation', 'Inclus dans la marge publiée, montant distinct indisponible.'),
    unknown('services', 'Services et biens divers', 'Déjà déduits dans la marge publiée, ne pas les déduire une seconde fois.'),
    margin, inputs.personnel, rent, oldSalary, newSalary, inputs.otherExpenses, inputs.nonRecurring, ebitda,
    inputs.depreciation, inputs.impairment, inputs.provisions, operating, inputs.financialIncome, inputs.financialExpenses,
    interest, pretax, tax, net];

  const b = (row: number, children: FinancialRow[] = []): FinancialRow => ({ ...sourceRow('Bilan', row, `balance-${row}`), ...(children.length ? { children } : {}) });
  const group = (row: number, children: FinancialRow[]) => ({ ...b(row, children), kind: 'total' as const });
  const assets = [b(4), group(6, [b(7), b(8, [9, 10, 11, 12, 13, 14].map(r => b(r))), b(15)]),
    group(17, [b(18, [b(19), b(20)]), b(21, [b(22), b(23)]), b(24, [b(25), b(26)]), b(27), b(28), b(29)]), group(31, [])];
  const liabilities = [group(35, [b(36, [37, 38, 39, 40, 41, 42, 43].map(r => b(r))), b(45, [b(46, [47, 48, 49, 50, 51].map(r => b(r))), b(52), b(53)]), b(54), b(55), b(56)]),
    group(58, [b(59, [60, 61, 62, 63, 64].map(r => b(r))), b(65)]),
    group(67, [b(68, [b(69, [b(70), b(71)]), b(72), b(73), b(74)]), b(75, [b(76), b(77, [b(78), b(79)]), b(80, [b(81), b(82)]), b(83), b(84, [b(85), b(86)]), b(87)]), b(88)]), group(90, [])];

  // Narrow identifiable operating scope. No wholesale inclusion of tax/dividend/other debts.
  const bfrRows = [[22, 1], [23, 1], [25, 1], [81, -1], [86, -1], [29, 1]].map(([row, sign]) => sourceRow('Bilan', row, `bfr-${row}`, undefined, sign));
  const bfrTotal = calculated('bfr', 'BFR opérationnel identifiable', bfrRows, 'total');
  bfrTotal.note = 'Stocks + en-cours + clients + régularisations actives − fournisseurs − dettes sociales. Hors autres créances, impôts, autres dettes et régularisations passives non ventilées.';
  const bfrDelta: FinancialRow = { id: 'bfrDelta', label: 'Variation du BFR identifiable', kind: 'calculation',
    values: values(y => sum([bfrTotal.values[y] ?? null, negate(bfrTotal.values[y - 1] ?? null)])),
    children: [ { ...bfrTotal, id: 'bfrClosing' }, { ...bfrTotal, id: 'bfrOpening', label: '− BFR de l’exercice précédent', values: values(y => negate(bfrTotal.values[y - 1] ?? null)), children: undefined } ] };
  const bfr = [...bfrRows, bfrTotal, bfrDelta, sourceRow('Ratios financiers', 16, 'sourceBfr', 'BFR publié par la source (périmètre non documenté)')];

  const addback = (row: FinancialRow, label: string) => ({ ...row, id: `addback-${row.id}`, label, values: values(y => negate(row.values[y])) });
  const depAddback = addback(inputs.depreciation, '+ Amortissements non décaissés');
  const impairAddback = addback(inputs.impairment, '+ / − Réductions de valeur');
  const provisionAddback = addback(inputs.provisions, '+ / − Dotations / reprises de provisions');
  const deltaCash = forecastInput('cashBfr', '− Variation du BFR identifiable', 'bfrChange', -1);
  for (const year of historical) deltaCash.values[year] = negate(bfrDelta.values[year]);
  deltaCash.children = bfrDelta.children;
  const capacity = calculated('capacity', 'Flux après impôts et BFR, avant investissements', [net, depAddback, impairAddback, provisionAddback, deltaCash], 'total');
  const capex = forecastInput('capex', '− Investissements décaissés (CapEx)', 'capex', -1);
  const existingPrincipal = forecastInput('existingPrincipal', '− Capital remboursé sur la dette historique', 'existingPrincipal', -1);
  const newPrincipal: FinancialRow = { id: 'newPrincipal', label: '− Capital remboursé sur le nouveau crédit', values: values(y => y < 2026 ? null : -(schedule.find(d => d.year === y)?.principal ?? 0)) };
  // Net income already includes acquisition interest: no second interest expense here.
  const free = calculated('free', 'Cash-flow libre après dette', [capacity, capex, existingPrincipal, newPrincipal], 'total');
  const cashFlow = [net, depAddback, impairAddback, provisionAddback, deltaCash, capacity, capex, existingPrincipal, newPrincipal, free];
  const opening: FinancialRow = { id: 'cashOpening', label: 'Trésorerie au début de l’exercice', values: values(y => sourceAmount(s, 'Bilan', 28, y - 1)), code: '54/58' };
  const dividends = forecastInput('dividends', '− Dividendes effectivement versés', 'dividends', -1);
  dividends.note = 'L’affectation du résultat ne prouve pas un paiement. Les flux historiques restent à documenter.';
  const extraction: FinancialRow = { id: 'extraction', label: '− Trésorerie extraite pour l’acquisition', values: values(y => y < 2026 ? null : y === 2026 ? -(a.cashExtraction ?? 0) : 0), kind: 'adjustment' };
  const closing = sourceRow('Bilan', 28, 'cashClosing', 'Trésorerie en fin d’exercice'); closing.kind = 'total';
  for (const year of forecastYears) {
    opening.values[year] = closing.values[year - 1];
    closing.values[year] = sum([opening.values[year], free.values[year], dividends.values[year], extraction.values[year]]);
  }
  const cashChange: FinancialRow = { id: 'cashChange', label: 'Variation constatée au bilan', values: values(y => y >= 2026 ? null : sum([closing.values[y], negate(opening.values[y])])), kind: 'calculation' };
  const cashBridge = [opening, free, dividends, extraction, cashChange, closing];

  const debt = ['opening', 'interest', 'principal', 'payment', 'closing'].map((key, i): FinancialRow => ({
    id: `debt-${key}`, label: ['Capital début', 'Intérêts', 'Capital remboursé', 'Annuité (capital + intérêts)', 'Capital fin'][i],
    values: Object.fromEntries(schedule.map(d => [d.year, d[key as 'opening']])), kind: key === 'payment' ? 'total' : undefined,
  }));
  const baseEbitda = ebitda.values[2025];
  const normalized = sum([baseEbitda, a.oldSalary[2026], negate(a.newSalary[2026]), negate(a.rentDifference[2026])]);
  const ev = normalized === null || a.valuationMultiple === null ? null : normalized * a.valuationMultiple;
  // 2025 >1yr financial debt is blank, not proof of zero. Infer zero only from debt total = short term total.
  const longDebt = sourceAmount(s, 'Bilan', 69, 2025) ?? (sourceAmount(s, 'Bilan', 67, 2025) === sourceAmount(s, 'Bilan', 75, 2025) ? 0 : null);
  const financialDebt = sum([longDebt, sourceAmount(s, 'Bilan', 76, 2025), sourceAmount(s, 'Bilan', 77, 2025)]);
  const valueRow = (id: string, label: string, n: number | null, kind?: FinancialRow['kind']): FinancialRow => ({ id, label, values: { 2025: n }, kind });
  const valuation = [valueRow('valuationEbitda', 'EBITDA publié 2025', baseEbitda),
    valueRow('valuationSalaryOld', '+ Ancien dirigeant (ajustement 2026)', a.oldSalary[2026]),
    valueRow('valuationSalaryNew', '− Nouveau dirigeant (ajustement 2026)', negate(a.newSalary[2026])),
    valueRow('valuationRent', '− Différence de loyer (ajustement 2026)', negate(a.rentDifference[2026])),
    valueRow('normalized', 'EBITDA normalisé indicatif', normalized, 'total'),
    valueRow('enterpriseValue', 'Valeur d’entreprise indicative', ev, 'total'),
    valueRow('financialDebt', '− Dette financière à la clôture 2025', negate(financialDebt)),
    valueRow('surplusCash', '+ Trésorerie excédentaire retenue', a.surplusCash),
    valueRow('equityValue', 'Valeur indicative des titres', sum([ev, negate(financialDebt), a.surplusCash]), 'total')];
  return { slug: s.slug, name: s.name, fiscalEnd: s.fiscalEnd, sourceFile: s.fileName, sourceHash: s.sha256,
    revision: document.revision, updatedAt: document.updatedAt, assumptions: a,
    pnl, assets, liabilities, bfr, cashFlow, cashBridge, valuation, debt,
    notes: [
      'Exercices du 1er juillet au 30 juin. 2023–2025 : comptes publiés. 2026–2028 : simulations, même si un exercice est déjà clôturé à la date de consultation.',
      'Chiffre d’affaires, achats et services distincts absents du fichier : les ratios sur CA ne sont pas calculables. La projection porte sur la marge publiée, pas sur un CA inventé.',
      'Les cellules vides restent indisponibles. Les totaux historiques publiés sont conservés ; de petits écarts d’arrondi existent dans la source.',
      'BFR : périmètre identifiable seulement. Les autres dettes 47/48 peuvent contenir des dividendes ; elles ne sont pas assimilées à des dettes d’exploitation.',
      'Les CapEx payés, remboursements et dividendes payés ne sont pas fournis. Le cash-flow final reste indisponible tant que ces hypothèses ne sont pas renseignées. Les soldes historiques ne constituent pas une réconciliation des flux.',
      'Le crédit d’acquisition est simulé en holding : aucun apport du crédit à la trésorerie de S.M.P. Son service est inclus dans le scénario de trésorerie consolidé, sans double déduction des intérêts. Sans montant de crédit, aucun financement d’acquisition n’est simulé.',
    ] };
}
