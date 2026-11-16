/** Shared financial convention: series identity, independently of favourable/unfavourable deltas. */
export const reportColors={actual:'#111111',budget:'#2563eb',prior:'#16804a',neutral:'#7c8790',alert:'#b13e4e'} as const;
export type MonthlyPerformanceRow={name:string;caActual:number|null;caPrior:number|null;caBudget:number|null;grossActual:number|null;grossPrior:number|null;grossBudget:number|null};
export function monthlyPerformanceRows(year:number,month:number,mode:'ytd'|'ltm',read:(key:string,label:string)=>number|undefined,annualBudget:Readonly<Record<string,number|undefined>>,label:(month:string)=>string):MonthlyPerformanceRow[]{
 return Array.from({length:mode==='ytd'?month:12},(_,i)=>{
  const key=new Date(Date.UTC(year,mode==='ytd'?i:month-12+i,1)).toISOString().slice(0,7),prior=`${Number(key.slice(0,4))-1}${key.slice(4)}`;
  const value=(date:string,name:string)=>{const n=read(date,name);return n===undefined?null:n/1000;};
  // Same approved flat prorating as YTD: no unvalidated seasonal profile.
  const budget=(name:string)=>key.startsWith('2026-')&&annualBudget[name]!==undefined?annualBudget[name]!/12/1000:null;
  return {name:label(key),caActual:value(key,'Chiffre d’affaires'),caPrior:value(prior,'Chiffre d’affaires'),caBudget:budget('Chiffre d’affaires'),grossActual:value(key,'Marge brute'),grossPrior:value(prior,'Marge brute'),grossBudget:budget('Marge brute')};
 });
}
