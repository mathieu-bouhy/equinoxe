import type { GimiBudgetProjection, ProfitLossMonthlyReport } from '@equinoxe/shared';

export interface GimiBudgetSeasonalityMonth { month:string; revenueShare:number; grossMarginShare:number; revenue:number; grossMargin:number; grossMarginRate:number|null }

const lineValues=(report:ProfitLossMonthlyReport,label:string)=>report.lines.find(line=>line.label===label)?.values;
const monthlyValues=(report:ProfitLossMonthlyReport,label:string)=>{
  const values=lineValues(report,label);return Array.from({length:12},(_,index)=>values?.[`${report.year}-${String(index+1).padStart(2,'0')}`]??0);
};
const shares=(full:number[],partial:number[],closedMonths:number)=>{
  const fullTotal=full.reduce((sum,value)=>sum+value,0);if(Math.abs(fullTotal)<.01)return null;
  const fullShares=full.map(value=>value/fullTotal),observedMass=fullShares.slice(0,closedMonths).reduce((sum,value)=>sum+value,0),partialObserved=partial.slice(0,closedMonths).reduce((sum,value)=>sum+value,0),fullObserved=full.slice(0,closedMonths).reduce((sum,value)=>sum+value,0);
  const result=fullShares.map((value,index)=>{
    if(index>=closedMonths||Math.abs(partialObserved)<.01||Math.abs(fullObserved)<.01)return value;
    return observedMass*((full[index]/fullObserved+partial[index]/partialObserved)/2);
  });
  const total=result.reduce((sum,value)=>sum+value,0);return Math.abs(total)<.01?null:result.map(value=>value/total);
};

export function gimiBudgetSeasonality(report2025:ProfitLossMonthlyReport|undefined,report2026:ProfitLossMonthlyReport|undefined,projection:GimiBudgetProjection|undefined):GimiBudgetSeasonalityMonth[]|null{
  if(!report2025||!report2026||!projection)return null;
  const revenue2025=monthlyValues(report2025,"Chiffre d’affaires"),revenue2026=monthlyValues(report2026,"Chiffre d’affaires"),gross2025=monthlyValues(report2025,'Marge brute'),gross2026=monthlyValues(report2026,'Marge brute');
  const closedMonths=Math.max(0,revenue2026.reduce((last,value,index)=>Math.abs(value)>.01?index+1:last,0));if(!closedMonths)return null;
  const revenueShares=shares(revenue2025,revenue2026,closedMonths),grossShares=shares(gross2025,gross2026,closedMonths);if(!revenueShares||!grossShares)return null;
  const annualRevenue=projection.lines.find(line=>line.key==='revenue')?.values['2027'],annualGross=projection.lines.find(line=>line.key==='grossMargin')?.values['2027'];if(annualRevenue===undefined||annualGross===undefined)return null;
  return revenueShares.map((revenueShare,index)=>{const grossMarginShare=grossShares[index],revenue=annualRevenue*revenueShare,grossMargin=annualGross*grossMarginShare;return {month:`2027-${String(index+1).padStart(2,'0')}`,revenueShare,grossMarginShare,revenue,grossMargin,grossMarginRate:Math.abs(revenue)<.01?null:grossMargin/revenue};});
}

