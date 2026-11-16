import type { BfrSection, CashOverviewReport, ProfitLossSection } from '@equinoxe/shared';
import type { OdooConnector } from '../connectors/odoo';
import { treasuryMonthEnds } from './aged-balance';

/** Same configurable BFR and class-5 cash as existing Gimi reports. */
export async function loadCashOverview(connector:OdooConnector,through:string,sections:BfrSection[],pnlSections:ProfitLossSection[],companySlug:'gimi'|'lonneux'='gimi'):Promise<CashOverviewReport>{
  if(!sections.length)throw new Error('Les rubriques BFR doivent être configurées.');
  const months:CashOverviewReport['months']=[];
  const warnings:string[]=companySlug==='lonneux'?['Historique disponible à partir de janvier 2026 : les soldes mensuels 2025 ne sont pas reconstituables depuis l’historique Excel annuel.','Soldes comptables Odoo : reprise des soldes d’ouverture et exhaustivité des règlements à vérifier. Aucun solde Excel 2025 n’est reporté automatiquement.']:[];
  for(const date of treasuryMonthEnds(through).filter(date=>companySlug!=='lonneux'||date>='2026-01-01')){
    const year=Number(date.slice(0,4)),key=String(year);
    const [balance,bfr]=await Promise.all([connector.getBalance([year],date),connector.getBfr([year],sections,date)]);
    const cash=balance.assets.find(line=>line.key==='cash')?.values[key];
    if(cash===undefined||bfr.total[key]===undefined)throw new Error('Une période de trésorerie ou BFR est indisponible.');
    if(date===through&&companySlug==='lonneux'){
      if(balance.assets.concat(balance.liabilities).some(line=>line.accounts.some(a=>a.code.startsWith('499')&&Math.abs(a.values[key]??0)>.01)))warnings.push('Un compte d’attente 499 présente un solde non nul : la reprise comptable et le classement des soldes restent à rapprocher.');
      if(!balance.liabilities.find(line=>line.key==='equity')?.accounts.length)warnings.push('Les capitaux propres ne figurent pas dans les écritures Odoo disponibles ; l’exhaustivité du bilan n’est pas confirmée.');
    }
    const inventory=balance.assets.find(line=>line.key==='inventory')?.accounts??[];
    months.push({date,cash,bfr:bfr.total[key],stocks:inventory.filter(a=>!a.code.startsWith('37')).reduce((s,a)=>s+(a.values[key]??0),0),workInProgress:companySlug==='lonneux'&&!inventory.some(a=>a.code.startsWith('37'))?null:inventory.filter(a=>a.code.startsWith('37')).reduce((s,a)=>s+(a.values[key]??0),0),components:bfr.lines});
  }
  const year=Number(through.slice(0,4)),pnl=await connector.getProfitLoss([year],pnlSections,[],companySlug==='lonneux',through);
  const ebitda=pnl.lines.find(line=>line.label==='EBITDA')?.values[String(year)]??null;
  if(!months.length)throw new Error('Aucun mois Odoo exploitable dans la période demandée.');
  return {through,months,ebitda,warnings,ebitdaNote:companySlug==='lonneux'?'EBITDA du compte de résultat Lonneux, factures non validées incluses conformément à cette vue. Encours et soldes de trésorerie : écritures validées uniquement.':undefined,ebitdaPeriod:`${year}-01-01 / ${through}`,generatedAt:new Date().toISOString(),cashScope:'Comptes de classe 5 : trésorerie et placements, écritures validées, débit − crédit. Même périmètre que le bilan ; ce solde ne prouve pas un rapprochement bancaire.'};
}
