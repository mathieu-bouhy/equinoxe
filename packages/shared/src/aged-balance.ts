export type TreasurySide = 'clients' | 'fournisseurs';
export type AgingBucket = 'notDue' | 'days30' | 'days60' | 'days90' | 'over90' | 'noDueDate';
export interface AgedInvoice {
  id:number; moveId:number; number:string; reference:string; partnerId:number|null; partner:string;
  account:string; date:string; invoiceDate:string|null; dueDate:string|null;
  original:number; settled:number; residual:number; daysLate:number|null; bucket:AgingBucket;
  kind:'invoice'|'credit'|'other'|'doubtful'; odooUrl:string;
}
export interface AgingTotals {
  notDue:number; days30:number; days60:number; days90:number; over90:number; noDueDate:number;
  invoices:number; overdue:number; other:number; doubtful:number; ledger:number;
}
export interface AgingMonth extends AgingTotals { date:string; control:number; difference:number }
export interface AgedBalanceReport {
  side:TreasurySide; asOf:string; closedThrough:string; readAt:string; currency:'EUR';
  totals:AgingTotals; control:number; difference:number; rows:AgedInvoice[]; history:AgingMonth[];
  accounts:Array<{code:string;label:string;balance:number}>;
  upcoming:Array<{startDay:number;endDay:number;amount:number}>;
  lateClients?:Array<{partnerId:number|null;partner:string;over90:number;days61to90:number;over60:number;oldestDueDate:string|null;invoiceCount:number}>;
  warnings:string[];
}
