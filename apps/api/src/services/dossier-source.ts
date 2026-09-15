import { createHash } from 'node:crypto';
import { forecastYears, operatingInputs, type AnnualInputs, type DossierSource, type DossierDocument } from '@equinoxe/shared';
import { dossierSourceSchema, DossierError } from '../repositories/sourced-dossier';

export const annual = (v: number | null): AnnualInputs => ({ 2026: v, 2027: v, 2028: v });
export function sourceCell(source: DossierSource, sheet: string, address: string) {
  return source.sheets.find(s => s.name === sheet)?.cells.find(c => c.address === address)?.value ?? null;
}
export function sourceAmount(source: DossierSource, sheet: string, row: number, year: number): number | null {
  const col: Record<number, string> = { 2025: 'D', 2024: 'E', 2023: 'F', 2022: 'G' };
  const value = col[year] ? sourceCell(source, sheet, `${col[year]}${row}`) : null;
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}
export function validateDossierSource(input: unknown) {
  const s = dossierSourceSchema.parse(input);
  if (createHash('sha256').update(Buffer.from(s.contentBase64, 'base64')).digest('hex') !== s.sha256)
    throw new DossierError('Empreinte du fichier source invalide.', 422);
  const names = ['Aperçu', 'Bilan', 'Compte de resultats', 'Traitement des résultats', 'Ratios financiers', 'Bilan social'];
  if (names.some(n => !s.sheets.some(sheet => sheet.name === n)) || s.years.join(',') !== '2022,2023,2024,2025')
    throw new DossierError('Structure ou exercices du fichier non reconnus.', 422);
  for (const sheet of s.sheets) {
    if (new Set(sheet.cells.map(c => c.address)).size !== sheet.cells.length) throw new DossierError('Cellules source dupliquées.', 422);
  }
  for (const year of s.years) {
    const a = sourceAmount(s, 'Bilan', 31, year), p = sourceAmount(s, 'Bilan', 90, year);
    if (a === null || p === null || Math.abs(a - p) > 1) throw new DossierError('Le total du bilan source ne concorde pas.', 422);
    if (sourceAmount(s, 'Compte de resultats', 3, year) === null || sourceAmount(s, 'Compte de resultats', 26, year) === null)
      throw new DossierError('Compte de résultat source incomplet.', 422);
  }
  return s;
}
export function initialDossier(source: DossierSource): DossierDocument {
  const amount = (row: number) => sourceAmount(source, 'Compte de resultats', row, 2025);
  const tax = amount(25), beforeTax = amount(22);
  return { version: 1, revision: 1, source, updatedAt: new Date().toISOString(), updatedBy: null, changes: [],
    assumptions: {
      growth: annual(0), amounts: Object.fromEntries(operatingInputs.map(i => [i.id, annual(amount(i.row))])),
      oldSalary: annual(0), newSalary: annual(0), rentDifference: annual(0),
      capex: annual(null), existingPrincipal: annual(null), dividends: annual(null), bfrChange: annual(0),
      taxRate: tax !== null && beforeTax !== null && beforeTax > 0 ? tax / beforeTax : null,
      acquisitionPrice: null, cashExtraction: null, loanAmount: null, loanYears: null, loanRate: null,
      valuationMultiple: null, surplusCash: null,
    } };
}
