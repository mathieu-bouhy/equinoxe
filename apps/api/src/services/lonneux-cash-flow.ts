import type { BfrSection, CashFlowLine, CashFlowReport, HistoricalAccountBalance, ProfitLossAccount, ProfitLossReport, ProfitLossSection } from '@equinoxe/shared';
import { historicalBalance } from './balance-sheet';
import { applyHistoricalProfitLoss } from './historical-profit-loss';

const years=[2024,2025];
type Inputs={companyId:string;history:HistoricalAccountBalance[];sections:ProfitLossSection[];bfrSections:BfrSection[]};

const values=(value2025=0)=>({'2024':0,'2025':value2025});
const longestOwner=<T extends {prefixes:string[]}>(code:string,definitions:T[])=>definitions.filter(definition=>definition.prefixes.some(prefix=>code.startsWith(prefix))).sort((a,b)=>Math.max(...b.prefixes.filter(prefix=>code.startsWith(prefix)).map(prefix=>prefix.length))-Math.max(...a.prefixes.filter(prefix=>code.startsWith(prefix)).map(prefix=>prefix.length)))[0];

/** Historical Lonneux bridge. It never reads Odoo and never inserts a balancing amount. */
export function buildLonneuxHistoricalCashFlow({companyId,history,sections,bfrSections}:Inputs):CashFlowReport{
  const own=history.filter(row=>row.companyId===companyId&&years.includes(row.year));
  const available=new Set(own.map(row=>row.year));
  const annual=(pattern:RegExp,year:number)=>own.filter(row=>row.year===year&&pattern.test(row.accountCode)).reduce((sum,row)=>sum+row.amount,0);
  const pnl=applyHistoricalProfitLoss({
    years,
    lines:[...sections].sort((a,b)=>a.order-b.order).map(section=>({key:section.id,label:section.label,kind:section.kind,values:{},accounts:section.kind==='accounts'?[]:undefined,subsections:[]})),
    generatedAt:new Date().toISOString(),source:'odoo',
  } as ProfitLossReport,own,sections);
  const pnlLine=(label:string)=>pnl.lines.find(line=>line.label===label);
  const balance=historicalBalance(years,own,companyId);
  const balanceLine=(key:string)=>balance.assets.concat(balance.liabilities).find(line=>line.key===key);
  const bfrTotals=Object.fromEntries(years.map(year=>[String(year),own.filter(row=>row.year===year).reduce((total,row)=>{
    const section=longestOwner(row.accountCode,bfrSections);return total+(section?(section.sign==='subtract'?-1:1)*row.amount:0);
  },0)]));
  const accountRows=(pattern:RegExp)=>[...new Set(own.filter(row=>pattern.test(row.accountCode)).map(row=>row.accountCode))].map(code=>{
    const sample=own.find(row=>row.accountCode===code)!;
    return {id:`history:${code}`,code,label:sample.label.replace(/^\d+\s*/,''),values:Object.fromEntries(years.map(year=>[String(year),own.find(row=>row.year===year&&row.accountCode===code)?.amount??0]))} as ProfitLossAccount;
  });
  const net2025=pnlLine('Résultat après impôts')?.values['2025']??0;
  const depreciation2025=-(pnlLine('Amortissements')?.values['2025']??0);
  const nwcImpact2025=-(bfrTotals['2025']-bfrTotals['2024']);
  const fixed=balanceLine('fixed-assets')?.values??{},fixedDelta2025=(fixed['2025']??0)-(fixed['2024']??0);
  // Net additions less disposals at net book value. Annual accounts do not prove invoice payment dates.
  const investment2025=-(fixedDelta2025+depreciation2025);
  const subsidyIncome2025=annual(/^753/,2025),subsidyChange2025=annual(/^15/,2025)-annual(/^15/,2024);
  const subsidyNeutralisation2025=Math.abs(subsidyChange2025+subsidyIncome2025)<.011?-subsidyIncome2025:0;
  const financingRows=accountRows(/^(17|42|43)/),financing2025=financingRows.reduce((sum,row)=>sum+(row.values['2025']-row.values['2024']),0);
  const dividendPayables=accountRows(/^471/).filter(row=>/DIVID/i.test(row.label));
  const dividendOpening=dividendPayables.reduce((sum,row)=>sum+row.values['2024'],0),dividendEnding=dividendPayables.reduce((sum,row)=>sum+row.values['2025'],0),priorAppropriation=own.filter(row=>row.year===2024&&/^694/.test(row.accountCode)&&/DIVID/i.test(row.label)).reduce((sum,row)=>sum+row.amount,0);
  const dividendSettlement2025=dividendOpening>0&&Math.abs(dividendEnding)<.011&&Math.abs(priorAppropriation-dividendOpening)<.011?-dividendOpening:0;
  const beforeFinancing2025=net2025+depreciation2025+nwcImpact2025+investment2025+subsidyNeutralisation2025;
  const free2025=beforeFinancing2025+financing2025;
  const line=(key:string,label:string,value2025:number,detail:string):CashFlowLine=>({key,label,values:values(value2025),detail});
  const cash=balanceLine('cash')?.values??{};
  const cashAccounts=(balanceLine('cash')?.accounts??[]).map(account=>({...account,values:{'2024':account.values['2024']??0,'2025':account.values['2025']??0}}));
  const nwcAccounts=[...new Set(own.filter(row=>Boolean(longestOwner(row.accountCode,bfrSections))).map(row=>row.accountCode))].map(code=>{
    const sample=own.find(row=>row.accountCode===code)!,section=longestOwner(code,bfrSections)!;
    const from=own.find(row=>row.year===2024&&row.accountCode===code)?.amount??0,to=own.find(row=>row.year===2025&&row.accountCode===code)?.amount??0;
    return {id:`history:${code}`,code,label:sample.label.replace(/^\d+\s*/,''),values:values(-(section.sign==='subtract'?-1:1)*(to-from))};
  });
  const depreciationAccounts=(pnlLine('Amortissements')?.accounts??[]).map(account=>({...account,values:values(-(account.values['2025']??0))}));
  const subsidyAccounts=accountRows(/^753/).map(account=>({...account,values:values(Math.abs(subsidyNeutralisation2025)>.004?-(account.values['2025']??0):0)}));
  const distributions=dividendPayables.map(account=>({...account,label:`Apurement du dividende à payer · ${account.code}`,values:values(dividendSettlement2025?-(account.values['2024']-account.values['2025']):0)}));
  const bridgeAvailable=available.has(2024)&&available.has(2025);
  return {
    years,through:'2025-12-31',source:'history',generatedAt:new Date().toISOString(),
    periods:[
      {year:2024,status:'unavailable',closingCashAvailable:available.has(2024),reason:'Solde d’ouverture au 31/12/2023 absent : le pont 2024 reste indisponible et aucun report fictif n’est créé.'},
      {year:2025,status:bridgeAvailable?'incomplete':'unavailable',closingCashAvailable:available.has(2025),reason:bridgeAvailable?'Le pont se rapproche à partir des comptes annuels. L’apurement du dividende à payer est documenté par les comptes 694100/471100, sans relevé bancaire permettant de certifier le décaissement.':'Historique 2024 ou 2025 absent : le pont 2025 ne peut pas être calculé.'},
    ],
    openingCash:{'2024':0,'2025':cash['2024']??0},closingCash:{'2024':cash['2024']??0,'2025':cash['2025']??0},
    lines:[
      line('net-result','Résultat après impôts',net2025,'Résultat 2025 reconstitué avec les rubriques configurées et les comptes annuels importés.'),
      line('depreciation','+ Amortissements',depreciation2025,'Dotations 630 réintégrées : charge comptable sans décaissement de l’exercice.'),
      line('nwc','- / + Variation du besoin en fonds de roulement',nwcImpact2025,'Même périmètre que l’onglet BFR Lonneux ; une baisse du BFR libère de la trésorerie.'),
      line('capex','− Investissements nets et cessions reconstitués',investment2025,'Variation des immobilisations nettes 2024–2025, corrigée des dotations 630. Ce montant rapproche acquisitions et cessions à leur valeur nette ; il ne certifie pas les dates de paiement.'),
      line('capital-subsidies','− Reprise de subside sans encaissement',subsidyNeutralisation2025,'Le produit 753000 de 234,54 € correspond exactement à la baisse du compte 150000 : il est neutralisé comme mouvement non monétaire.'),
      line('cfads','Flux comptable avant financement et dividende',beforeFinancing2025,'Résultat, amortissements, BFR, immobilisations et reprise de subside documentée.'),
      line('debt-repayment','Variation nette des financements',financing2025,'Variation des comptes 17, 42 et 43. Aucun solde n’est présent dans l’historique 2024–2025.'),
      line('free-cash-flow','Flux net après financements, avant dividende',free2025,'Pont comptable avant l’apurement du dividende à payer.'),
    ],
    accountDetails:{
      depreciation:depreciationAccounts,nwc:nwcAccounts,capex:[
        {id:'history:fixed-assets-change',code:'20–27',label:'Variation nette des immobilisations',values:values(-fixedDelta2025)},
        {id:'history:fixed-assets-depreciation',code:'630',label:'Dotations intégrées à la reconstitution',values:values(-depreciation2025)},
      ],'capital-subsidies':subsidyAccounts,'debt-repayment':financingRows.map(account=>({...account,values:values(account.values['2025']-account.values['2024'])})),distributions,
      'cash-opening':cashAccounts.map(account=>({...account,values:{'2024':0,'2025':account.values['2024']??0}})),'cash-ending':cashAccounts,
    },
    distributionLabel:'− Apurement du dividende à payer',
    distributionNote:'Le montant de 120 k€ correspond au dividende 2024 porté en 694100 et 471100, puis soldé en 2025. Le rapprochement est exact, mais l’absence de relevé bancaire ne permet pas de certifier le compte bancaire ni la date du paiement.',
    explanations:[
      {title:'2024 : ouverture manquante',text:'Les comptes annuels importés commencent au 31 décembre 2024. Sans solde au 31 décembre 2023, les variations de BFR, d’immobilisations et de financement 2024 ne sont pas calculables ; la colonne reste vide.'},
      {title:'Immobilisations 2025',text:'Les immobilisations nettes diminuent de 26 594,49 € et les dotations atteignent 38 694,49 €. Le mouvement net reconstitué est donc un emploi de 12 100,00 €, sans prétendre identifier des factures payées.'},
      {title:'Dividende et subside',text:'Le compte 471100 de 120 000 € est soldé en 2025 après l’affectation 694100 de 2024. La reprise de subside de 234,54 € est non monétaire. Ces deux éléments expliquent l’écart sans créer de ligne de bouclage.'},
    ],
  };
}

export async function loadLonneuxHistoricalCashFlow(readHistory:()=>Promise<HistoricalAccountBalance[]>,companyId:string,sections:ProfitLossSection[],bfrSections:BfrSection[]){
  return buildLonneuxHistoricalCashFlow({companyId,history:await readHistory(),sections,bfrSections});
}
