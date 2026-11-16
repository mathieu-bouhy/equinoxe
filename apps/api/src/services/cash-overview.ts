import type { BfrSection, CashOverviewReport, ProfitLossSection } from '@equinoxe/shared';
import type { OdooConnector } from '../connectors/odoo';
import { treasuryMonthEnds } from './aged-balance';

/** Same configurable BFR and class-5 cash as existing Gimi reports. */
export async function loadCashOverview(connector:OdooConnector,through:string,sections:BfrSection[],pnlSections:ProfitLossSection[]):Promise<CashOverviewReport>{
  if(!sections.length)throw new Error('Les rubriques BFR doivent être configurées.');
  const months:CashOverviewReport['months']=[];
  for(const date of treasuryMonthEnds(through)){
    const year=Number(date.slice(0,4)),key=String(year);
    const [balance,bfr]=await Promise.all([connector.getBalance([year],date),connector.getBfr([year],sections,date)]);
    const cash=balance.assets.find(line=>line.key==='cash')?.values[key];
    if(cash===undefined||bfr.total[key]===undefined)throw new Error('Une période de trésorerie ou BFR est indisponible.');
    const inventory=balance.assets.find(line=>line.key==='inventory')?.accounts??[];
    months.push({date,cash,bfr:bfr.total[key],stocks:inventory.filter(a=>!a.code.startsWith('37')).reduce((s,a)=>s+(a.values[key]??0),0),workInProgress:inventory.filter(a=>a.code.startsWith('37')).reduce((s,a)=>s+(a.values[key]??0),0),components:bfr.lines});
  }
  const year=Number(through.slice(0,4)),pnl=await connector.getProfitLoss([year],pnlSections,[],false,through);
  const ebitda=pnl.lines.find(line=>line.label==='EBITDA')?.values[String(year)]??null;
  return {through,months,ebitda,ebitdaPeriod:`${year}-01-01 / ${through}`,generatedAt:new Date().toISOString(),cashScope:'Comptes de classe 5 : trésorerie et placements, écritures validées, débit − crédit. Même périmètre que le bilan ; ce solde ne prouve pas un rapprochement bancaire.'};
}
