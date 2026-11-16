import { afterEach,expect,spyOn,test } from 'bun:test';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BfrSection, HistoricalAccountBalance, ProfitLossSection } from '@equinoxe/shared';
import { buildLonneuxHistoricalCashFlow } from '../services/lonneux-cash-flow';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';
import { OdooConnector } from '../connectors/odoo';

const companyId='lonneux';
const section=(id:string,label:string,kind:'accounts'|'calculation',prefixes:string[]=[],formula:any[]=[],order=0):ProfitLossSection=>({id,companyId,label,kind,prefixes,formula,order,createdAt:'',updatedAt:''});
const sections:ProfitLossSection[]=[
  section('products','Produits','accounts',['7'],[],0),section('expenses','Charges','accounts',['6'],[],1),section('depreciation','Amortissements','accounts',['630'],[],2),
  section('result','Résultat après impôts','calculation',[],[{sectionId:'products',operator:'add'},{sectionId:'expenses',operator:'add'},{sectionId:'depreciation',operator:'add'}],3),
];
const bfrSections:BfrSection[]=[
  {id:'receivables',companyId,label:'Créances',sign:'add',prefixes:['40'],order:0,createdAt:'',updatedAt:''},
  {id:'suppliers',companyId,label:'Fournisseurs',sign:'subtract',prefixes:['44'],order:1,createdAt:'',updatedAt:''},
];
const row=(year:number,accountCode:string,amount:number,label=accountCode):HistoricalAccountBalance=>({companyId,year,accountCode,amount,label:`${accountCode} ${label}`,sourceFile:'fixture.xlsx',importedAt:''});
function fixture(){return [
  row(2024,'550000',1000,'Banque'),row(2025,'550000',1130,'Banque'),
  row(2024,'240000',100,'Immobilisations'),row(2025,'240000',95,'Immobilisations'),
  row(2024,'400000',200,'Clients'),row(2025,'400000',100,'Clients'),row(2024,'440000',50,'Fournisseurs'),row(2025,'440000',80,'Fournisseurs'),
  row(2024,'150000',10,'Subside en capital'),row(2025,'150000',5,'Subside en capital'),row(2025,'753000',5,'Subside en capital'),
  row(2025,'700000',195,'Produits'),row(2025,'600000',70,'Charges'),row(2025,'630000',10,'Amortissements'),
  row(2024,'471100',120,'Dividende'),row(2025,'471100',0,'Dividende'),row(2024,'694100',120,'Dividende'),
];}
const gap=(report:ReturnType<typeof buildLonneuxHistoricalCashFlow>,year:number)=>(report.closingCash?.[year]??0)-(report.openingCash?.[year]??0)-(report.lines.find(line=>line.key==='free-cash-flow')?.values[year]??0)-(report.accountDetails?.distributions.reduce((sum,row)=>sum+(row.values[year]??0),0)??0);

test('2025 : rapprochement historique documenté sans montant de bouclage',()=>{
  const report=buildLonneuxHistoricalCashFlow({companyId,history:fixture(),sections,bfrSections});
  expect(report.source).toBe('history');expect(report.years).toEqual([2024,2025]);
  expect(report.periods?.find(period=>period.year===2024)?.status).toBe('unavailable');
  expect(report.lines.find(line=>line.key==='free-cash-flow')?.values['2025']).toBe(250);
  expect(report.accountDetails?.distributions[0].values['2025']).toBe(-120);
  expect(gap(report,2025)).toBe(0);
});

test('chaque détail 2025 rejoint sa rubrique',()=>{
  const report=buildLonneuxHistoricalCashFlow({companyId,history:fixture(),sections,bfrSections});
  for(const key of ['depreciation','nwc','capex','capital-subsidies','debt-repayment']){
    const detail=report.accountDetails?.[key].reduce((sum,row)=>sum+(row.values['2025']??0),0)??0;
    expect(detail).toBeCloseTo(report.lines.find(line=>line.key===key)!.values['2025'],8);
  }
});

test('aucune preuve suffisante du dividende : le résiduel reste visible',()=>{
  const history=fixture().filter(item=>item.accountCode!=='694100');
  const report=buildLonneuxHistoricalCashFlow({companyId,history,sections,bfrSections});
  expect(report.accountDetails?.distributions[0].values['2025']).toBe(0);
  expect(gap(report,2025)).toBe(-120);
});

test('historique 2024 manquant : 2025 reste indisponible',()=>{
  const report=buildLonneuxHistoricalCashFlow({companyId,history:fixture().filter(item=>item.year===2025),sections,bfrSections});
  expect(report.periods?.find(period=>period.year===2025)?.status).toBe('unavailable');
});

const dirs:string[]=[];
afterEach(async()=>{await Promise.all(dirs.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
test('route Lonneux : lit PostgreSQL sans appeler le pont Odoo',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'equinoxe-lonneux-cash-'));dirs.push(dir);
  const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();
  const company=(await store.companies.read()).find(item=>item.slug==='lonneux')!;
  await store.historicalBalances.write(fixture().map(item=>({...item,companyId:company.id})));
  let odooCalls=0;const mock=spyOn(OdooConnector.prototype,'getCashFlow').mockImplementation(async()=>{odooCalls++;throw new Error('Odoo ne doit pas être appelé');});
  try{
    const app=createApp(store,auth),login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})})),cookie=login.headers.get('set-cookie')!.split(';')[0];
    const response=await app(new Request(`http://api/v1/companies/${company.id}/cash-flow`,{headers:{cookie}})),body=await response.json();
    expect(response.status).toBe(200);expect(body.data.source).toBe('history');expect(body.data.years).toEqual([2024,2025]);expect(odooCalls).toBe(0);
  }finally{mock.mockRestore();}
});
