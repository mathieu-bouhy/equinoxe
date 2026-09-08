export type CashMovement = {
  id: number; date: string; accountId: number; moveId: number; label: string;
  debit: number; credit: number;
};
export type CashAccount = { id: number; code: string; label: string; opening: number; closing: number };
export type CashHistorySnapshot = {
  version: 1; companyId: string; from: string; through: string;
  source: 'odoo'; accountPrefix: '5'; currency: 'EUR';
  startedAt: string; importedAt: string;
  accounts: CashAccount[]; movements: CashMovement[];
  monthlyControls: Array<{ month: string; closing: number; difference: number }>;
};
export type CashDay = { date: string; movement: number; closing: number };
export type CashMonth = {
  month: string; days: number; opening: number; closing: number; movement: number;
  average: number; minimum: number; maximum: number;
  minimumDate: string; maximumDate: string; difference: number;
};
export type CashEvolutionReport = {
  companyId: string; from: string; through: string; requestedThrough: string;
  importedAt: string; needsSync: boolean; opening: number; closing: number;
  movementCount: number; accounts: CashAccount[]; days: CashDay[]; months: CashMonth[];
};
