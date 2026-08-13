import type { ProfitLossReport } from '@equinoxe/shared';

/** Annualises only the in-progress year; closed prior years are left untouched. */
export function extrapolateProfitLoss(report:ProfitLossReport,year:number,closedMonth:number){
  const factor=12/closedMonth,key=String(year);
  for(const line of report.lines){
    line.values[key]=(line.values[key]??0)*factor;
    for(const account of line.accounts??[])account.values[key]=(account.values[key]??0)*factor;
    for(const subsection of line.subsections??[]){
      subsection.values[key]=(subsection.values[key]??0)*factor;
      for(const account of subsection.accounts)account.values[key]=(account.values[key]??0)*factor;
    }
  }
  return report;
}
