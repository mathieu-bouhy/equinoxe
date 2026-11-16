import type {PartnerRanking,PartnerRankingsReport,ProfitLossSection} from '@equinoxe/shared';
import type {OdooConnector} from '../connectors/odoo';
import type {PartnerRankingSource,PartnerGroup} from '../connectors/odoo-partner-rankings';
import {accountSection} from './analytic-allocation';
export function rankingPeriod(closed:string,mode:'ytd'|'ltm'){
 if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(closed)||!['ytd','ltm'].includes(mode))throw Error('Période de classement invalide.');
 const [year,month]=closed.split('-').map(Number);return {from:new Date(Date.UTC(year,mode==='ltm'?month-12:0,1)).toISOString().slice(0,10),through:new Date(Date.UTC(year,month,0)).toISOString().slice(0,10)};
}
export async function loadPartnerRankings(connector:OdooConnector,sections:ProfitLossSection[],closed:string,mode:'ytd'|'ltm'):Promise<PartnerRankingsReport>{
 const period=rankingPeriod(closed,mode),section=accountSection('700000',sections);if(!section)throw Error('Rubrique de chiffre d’affaires non configurée.');
 const accounts=await connector.getProfitLossAccounts(),ids=accounts.filter(a=>accountSection(a.code,sections)?.id===section.id).map(a=>Number(a.id));
 const [source,pnl]=await Promise.all([connector.getPartnerRankingSource(period.from,period.through,ids),connector.getProfitLossLtm([{key:'ranking',label:'Contrôle classement',start:period.from,end:period.through}],sections)]);
 const expected=pnl.lines.find(line=>line.key===section.id)?.values.ranking;if(expected===undefined)throw Error('Contrôle de chiffre d’affaires indisponible.');
 return buildPartnerRankings(source,mode,expected);
}
export function isExcludedRankingCompany(name:string){const normalized=name.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');return /^(bajoma|mbp|mbpgroup)(sa|srl|sprl)?$/.test(normalized);}
export function buildPartnerRankings(source:PartnerRankingSource,mode:'ytd'|'ltm',expectedRevenue:number):PartnerRankingsReport{
 const partners=new Map(source.partners.map(p=>[p.id,p]));
 const make=(groups:PartnerGroup[],field:'balance'|'amount_untaxed_signed',control:number):PartnerRanking=>{
  const totals=new Map<number,{id:number;name:string;amount:number}>();let unassigned=0,excluded=0;
  for(const group of groups){if(!Number.isFinite(group[field]))throw Error('Montant de tiers manquant.');const amount=-(group[field]??0);if(!group.partner_id){unassigned+=amount;continue;}
   const partner=partners.get(group.partner_id[0]);if(!partner)throw Error('Tiers manquant.');const id=partner.commercial_partner_id?partner.commercial_partner_id[0]:partner.id,name=partner.commercial_partner_id?partner.commercial_partner_id[1]:partner.name;
   if(isExcludedRankingCompany(name)){excluded+=amount;continue;}
   const row=totals.get(id)??{id,name,amount:0};row.amount+=amount;totals.set(id,row);
  }
  const accountingTotal=-control,total=accountingTotal-excluded,values=[...totals.values()],all=values.reduce((s,row)=>s+row.amount,unassigned);if(Math.abs(total-all)>.011)throw Error('Regroupement commercial incohérent.');
  const share=(n:number)=>total>.005?n/total:null,rows=values.filter(row=>row.amount>.005).sort((a,b)=>b.amount-a.amount||a.id-b.id).slice(0,10).map(row=>({...row,share:share(row.amount),url:`${source.baseUrl.replace(/\/$/,'')}/web#id=${row.id}&model=res.partner&view_type=form`})),topTotal=rows.reduce((s,row)=>s+row.amount,0);
  return {accountingTotal,excluded,total,topTotal,share:share(topTotal),other:total-topTotal,unassigned,partnerCount:values.filter(row=>Math.abs(row.amount)>.005).length,rows};
 };
 const clients=make(source.clients,'balance',source.clientControl),suppliers=make(source.suppliers,'amount_untaxed_signed',source.supplierControl),revenueDifference=clients.accountingTotal-expectedRevenue;
 if(!Number.isFinite(expectedRevenue)||Math.abs(revenueDifference)>.011)throw Error('Le chiffre d’affaires clients ne rejoint pas le compte de résultat.');
 return {mode,from:source.from,through:source.through,clients,suppliers,revenueDifference,generatedAt:new Date().toISOString(),scope:'company'};
}
