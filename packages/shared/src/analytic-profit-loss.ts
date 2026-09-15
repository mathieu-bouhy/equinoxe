import type { AllocationDepartment } from './employee-cost-allocation';
import type { AccountingEntry, ProfitLossPeriod } from './index';

export type AnalyticReportMode = 'annual' | 'ltm' | 'extrapolated';
export interface AnalyticPeriod extends ProfitLossPeriod { months:string[]; factor:number }
export interface AnalyticAccount {
  id:string; code:string; label:string; keyLabel:string;
  values:Record<string,number>; originalValues:Record<string,number>;
  monthlyValues:Record<string,number>; originalMonths:Record<string,number>;
}
export interface AnalyticLine {
  key:string; label:string; kind:'accounts'|'calculation'; values:Record<string,number>;
  monthlyValues:Record<string,number>; accounts:AnalyticAccount[];
  subsections:Array<{id:string;label:string;accounts:AnalyticAccount[];values:Record<string,number>;monthlyValues:Record<string,number>}>;
}
export interface AnalyticProfitLossReport {
  mode:AnalyticReportMode; departments:AllocationDepartment[]; lastClosedMonth:string;
  periods:AnalyticPeriod[]; lines:AnalyticLine[]; revenueKey:string;
  unallocated:AnalyticAccount[]; warnings:string[]; generatedAt:string;
}
export interface AnalyticEntry extends AccountingEntry { originalAmount:number; share:number; allocatedAmount:number; projectedAmount:number }
export interface AnalyticEntriesReport { rows:AnalyticEntry[]; factor:number; originalTotal:number; allocatedTotal:number; projectedTotal:number }
