/** Financial source documents are private API data, never bundled actuals. */
export type DossierYears = 2026 | 2027 | 2028;
export type AnnualInputs = Record<DossierYears, number | null>;
export interface WorkbookCell { address: string; value: string | number | boolean | null; formula: string | null }
export interface DossierSource {
  slug: 'smp'; name: string; fiscalEnd: '06-30'; years: number[];
  fileName: string; sha256: string; contentBase64: string; importedAt: string;
  sheets: Array<{ name: string; cells: WorkbookCell[] }>;
}
export interface DossierAssumptions {
  growth: AnnualInputs;
  amounts: Record<string, AnnualInputs>;
  oldSalary: AnnualInputs; newSalary: AnnualInputs; rentDifference: AnnualInputs;
  capex: AnnualInputs; existingPrincipal: AnnualInputs; dividends: AnnualInputs; bfrChange: AnnualInputs;
  taxRate: number | null;
  acquisitionPrice: number | null; cashExtraction: number | null;
  loanAmount: number | null; loanYears: number | null; loanRate: number | null;
  valuationMultiple: number | null; surplusCash: number | null;
}
export interface DossierDocument {
  version: 1; revision: number; source: DossierSource; assumptions: DossierAssumptions;
  updatedAt: string; updatedBy: string | null;
  changes: Array<{ revision: number; at: string; userId: string; previous: DossierAssumptions }>;
}
export interface FinancialRow {
  id: string; label: string; code?: string; kind?: 'total' | 'calculation' | 'adjustment';
  values: Record<number, number | null>; note?: string; children?: FinancialRow[];
}
export interface DossierReport {
  slug: string; name: string; fiscalEnd: string; sourceFile: string; sourceHash: string;
  revision: number; updatedAt: string; assumptions: DossierAssumptions;
  pnl: FinancialRow[]; assets: FinancialRow[]; liabilities: FinancialRow[];
  bfr: FinancialRow[]; cashFlow: FinancialRow[]; cashBridge: FinancialRow[];
  valuation: FinancialRow[]; debt: FinancialRow[];
  notes: string[];
}
export const forecastYears: DossierYears[] = [2026, 2027, 2028];
export const dossierYears = [2023, 2024, 2025, ...forecastYears];
export const operatingInputs = [
  { id: 'personnel', label: 'Personnel', row: 7 },
  { id: 'depreciation', label: 'Amortissements', row: 8 },
  { id: 'impairment', label: 'Réductions de valeur', row: 9 },
  { id: 'provisions', label: 'Dotations / reprises de provisions', row: 10 },
  { id: 'otherExpenses', label: 'Autres charges d’exploitation', row: 11 },
  { id: 'nonRecurring', label: 'Charges d’exploitation non récurrentes', row: 13 },
  { id: 'financialIncome', label: 'Produits financiers', row: 15 },
  { id: 'financialExpenses', label: 'Charges financières historiques', row: 19 },
] as const;
