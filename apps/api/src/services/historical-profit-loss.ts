import type { HistoricalAccountBalance, ProfitLossReport, ProfitLossSection } from '@equinoxe/shared';
const accountSections=(sections:ProfitLossSection[])=>sections.filter(section=>section.kind==='accounts');
const owner=(code:string,sections:ProfitLossSection[])=>accountSections(sections).filter(section=>section.prefixes.some(prefix=>code.startsWith(prefix))).sort((a,b)=>Math.max(...b.prefixes.filter(prefix=>code.startsWith(prefix)).map(prefix=>prefix.length))-Math.max(...a.prefixes.filter(prefix=>code.startsWith(prefix)).map(prefix=>prefix.length)))[0];
const signedAmount=(code:string,amount:number)=>/^(6|67)/.test(code)?-amount:amount;
export function recalculateProfitLoss(report:ProfitLossReport,sections:ProfitLossSection[]){
  const lines=new Map(report.lines.map(line=>[line.key,line]));
  for(const section of [...sections].sort((a,b)=>a.order-b.order)){
    if(section.kind!=='calculation')continue;
    const line=lines.get(section.id);if(!line)continue;
    line.values=Object.fromEntries(report.years.map(year=>[String(year),section.formula.reduce((total,term)=>{
      const value=lines.get(term.sectionId)?.values[String(year)]??0;
      return total+(term.operator==='subtract'?-value:value);
    },0)]));
  }
  return report;
}
export function applyHistoricalProfitLoss(report:ProfitLossReport,balances:HistoricalAccountBalance[],sections:ProfitLossSection[]){const seen=new Set<string>();for(const balance of balances){const identity=`${balance.year}:${balance.accountCode}`;if(seen.has(identity)||!report.years.includes(balance.year))continue;seen.add(identity);const section=owner(balance.accountCode,sections),line=section&&report.lines.find(item=>item.key===section.id);if(!line)continue;const year=String(balance.year),amount=signedAmount(balance.accountCode,balance.amount);line.values[year]=(line.values[year]??0)+amount;const account=line.accounts?.find(item=>item.code===balance.accountCode);if(account){account.values[year]=(account.values[year]??0)+amount}else line.accounts?.push({id:`history:${balance.accountCode}`,code:balance.accountCode,label:balance.label,values:{[year]:amount},source:'history'});}for(const line of report.lines)line.accounts?.sort((a,b)=>a.code.localeCompare(b.code));return recalculateProfitLoss(report,sections);}
