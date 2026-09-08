import type { BalanceAccount, BalanceLine, BalancePeriod, BalanceReport, HistoricalAccountBalance } from '@equinoxe/shared';

type Definition = { key:string; label:string; side:'assets'|'liabilities'; prefixes:string[] };
// Exclusive PCMN groups. In particular 17 is not equity and 42 is not a receivable.
const definitions:Definition[] = [
  {key:'fixed-assets',label:'Immobilisations',side:'assets',prefixes:['2']},
  {key:'inventory',label:'Stocks et encours',side:'assets',prefixes:['3']},
  {key:'receivables',label:'Créances clients et autres créances',side:'assets',prefixes:['40','41']},
  {key:'cash',label:'Trésorerie et placements',side:'assets',prefixes:['5']},
  {key:'prepayments',label:'Comptes de régularisation actifs',side:'assets',prefixes:['490','491']},
  {key:'equity',label:'Capitaux propres',side:'liabilities',prefixes:['10','11','12','13','14','15','19']},
  {key:'provisions',label:'Provisions et impôts différés',side:'liabilities',prefixes:['16']},
  {key:'financial-debt',label:'Dettes à plus d’un an et dettes financières',side:'liabilities',prefixes:['17','42','43']},
  {key:'suppliers',label:'Dettes fournisseurs',side:'liabilities',prefixes:['44']},
  {key:'tax-social',label:'Dettes fiscales, sociales et autres',side:'liabilities',prefixes:['45','46','47','48']},
  {key:'accruals',label:'Comptes de régularisation passifs',side:'liabilities',prefixes:['492','493']},
];
export const isBalanceCode = (code:string) => /^[1-5]\d{1,11}$/.test(code);
const owner = (code:string) => definitions.find(item=>item.prefixes.some(prefix=>code.startsWith(prefix)));
export const balanceDate = (year:number, asOf?:string) => asOf && year===Number(asOf.slice(0,4)) ? asOf : `${year}-12-31`;

/** Input values are debit-positive. Never mutate source rows or share mutable account objects. */
export function buildBalance(years:number[], rows:BalanceAccount[], asOf?:string):BalanceReport {
  const result:BalanceReport={years:[...years],assets:[],liabilities:[],generatedAt:new Date().toISOString(),source:'odoo'};
  const groups=new Map<string,BalanceLine>();
  for(const definition of definitions){const line={key:definition.key,label:definition.label,values:{},accounts:[]} as BalanceLine;groups.set(line.key,line);result[definition.side].push(line);}
  for(const row of rows.filter(row=>isBalanceCode(row.code))){
    const definition=owner(row.code), side=definition?.side ?? (row.code.startsWith('1')?'liabilities':'assets');
    const key=definition?.key ?? `unclassified-${side}`;
    if(!groups.has(key)){const line={key,label:'Autres comptes à classer',values:{},accounts:[]} as BalanceLine;groups.set(key,line);result[side].push(line);}
    const sign=side==='liabilities'?-1:1;
    groups.get(key)!.accounts.push({...row,values:Object.fromEntries(years.map(year=>[year,sign*(row.values[year]??0)]))});
  }
  for(const line of groups.values()){
    line.accounts.sort((a,b)=>a.code.localeCompare(b.code));
    line.values=Object.fromEntries(years.map(year=>[year,line.accounts.reduce((sum,row)=>sum+row.values[year],0)]));
  }
  result.periods=years.map(year=>({year,source:'odoo',asOf:balanceDate(year,asOf),status:rows.some(row=>Object.hasOwn(row.values,year))?'available':'unavailable',warnings:[]}));
  return result;
}

/** Lonneux's imported Excel contains presentation signs, not raw debit/credit balances. */
export function historicalBalance(years:number[], history:HistoricalAccountBalance[], companyId:string):BalanceReport {
  const byCode=new Map<string,BalanceAccount>(),seen=new Set<string>();
  for(const item of history){
    if(item.companyId!==companyId||!years.includes(item.year)||!isBalanceCode(item.accountCode))continue;
    const key=`${item.year}:${item.accountCode}`;
    if(seen.has(key))throw new Error('Compte historique dupliqué dans le bilan.');
    seen.add(key);
    const row=byCode.get(item.accountCode)??{id:`history:${item.accountCode}`,code:item.accountCode,label:item.label,values:{}};
    const liability=owner(item.accountCode)?.side==='liabilities'||item.accountCode.startsWith('1');
    row.values[item.year]=liability?-item.amount:item.amount;
    byCode.set(item.accountCode,row);
  }
  const result=buildBalance(years,[...byCode.values()]);result.source='history';
  result.periods=result.periods!.map(period=>({...period,source:'history'}));
  return result;
}

/** Historical years replace Odoo, they are never added to its opening balances. No writes. */
export async function loadBalanceSheet(options:{companyId:string;companySlug:string;years:number[];asOf?:string;
  readHistory:()=>Promise<HistoricalAccountBalance[]>;readOdoo:(years:number[],asOf?:string)=>Promise<BalanceReport>}):Promise<BalanceReport>{
  const {companyId,companySlug,years,asOf}=options;
  const historicalYears:number[]=companySlug==='lonneux'?years.filter(year=>year===2024||year===2025):[];
  const odooYears=years.filter(year=>!historicalYears.includes(year));
  const [historical,odoo]=await Promise.allSettled([
    historicalYears.length?options.readHistory().then(rows=>historicalBalance(historicalYears,rows,companyId)):Promise.resolve(null),
    odooYears.length?options.readOdoo(odooYears,asOf):Promise.resolve(null),
  ]);
  const result=buildBalance([],[]);result.years=[...years];result.periods=[];
  result.source=historicalYears.length?(odooYears.length?'mixed':'history'):'odoo';
  for(const year of years){
    const isHistory=historicalYears.includes(year),response=isHistory?historical:odoo;
    const report=response.status==='fulfilled'?response.value:null;
    const period:BalancePeriod={year,source:isHistory?'history':'odoo',asOf:balanceDate(year,isHistory?undefined:asOf),status:report?.periods?.find(p=>p.year===year)?.status??(report?'available':'unavailable'),warnings:[]};
    if(period.status==='unavailable')period.warnings.push(isHistory?'Historique indisponible : aucune valeur Odoo ne le remplace.':'Bilan Odoo indisponible ; les autres années restent consultables.');
    for(const side of ['assets','liabilities'] as const){
      for(const sourceLine of report?.[side]??[]){
        let line=result[side].find(line=>line.key===sourceLine.key);
        if(!line){line={key:sourceLine.key,label:sourceLine.label,values:{},accounts:[]};result[side].push(line);}
        if(period.status==='unavailable')continue;
        line.values[year]=sourceLine.values[year]??0;
        for(const sourceAccount of sourceLine.accounts){
          let account=line.accounts.find(account=>account.code===sourceAccount.code);
          if(!account){account={id:sourceAccount.code,code:sourceAccount.code,label:sourceAccount.label,values:{}};line.accounts.push(account);}
          account.values[year]=sourceAccount.values[year]??0;
        }
      }
    }
    result.periods.push(period);
  }
  for(const side of ['assets','liabilities'] as const)for(const line of result[side]){
    for(const period of result.periods.filter(p=>p.status!=='unavailable')){
      line.values[period.year]??=0;
      for(const account of line.accounts)account.values[period.year]??=0;
    }
    line.accounts.sort((a,b)=>a.code.localeCompare(b.code));
  }
  for(const period of result.periods.filter(p=>p.status!=='unavailable')){
    const total=(side:'assets'|'liabilities')=>result[side].reduce((sum,line)=>sum+(line.values[period.year]??0),0);
    if(Math.abs(total('assets')-total('liabilities'))>.01)period.warnings.push('Les soldes disponibles ne s’équilibrent pas ; aucun montant de compensation n’a été ajouté.');
    if(result.assets.concat(result.liabilities).some(line=>line.key.startsWith('unclassified')&&line.accounts.some(a=>Math.abs(a.values[period.year]??0)>.004)))period.warnings.push('Certains comptes restent à classer.');
    if(companySlug==='lonneux'&&period.source==='odoo'&&['cash','equity'].some(key=>!result.assets.concat(result.liabilities).find(line=>line.key===key)?.accounts.some(account=>Math.abs(account.values[period.year]??0)>.004)))period.warnings.push('Soldes de trésorerie ou de capitaux propres absents des données Odoo. Vérifier la reprise des soldes d’ouverture ; aucun report automatique de 2025.');
    if(period.warnings.length)period.status='incomplete';
  }
  return result;
}
