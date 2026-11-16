import {afterEach,expect,spyOn,test} from 'bun:test';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import type {HistoricalAccountBalance} from '@equinoxe/shared';
import {buildLonneuxHistoricalCapex} from '../services/lonneux-capex';
import {Store} from '../repositories/store';
import {AuthService} from '../auth/service';
import {createApp} from '../http/app';
import {OdooConnector} from '../connectors/odoo';

const companyId='lonneux';
const row=(year:number,accountCode:string,amount:number,label:string):HistoricalAccountBalance=>({companyId,year,accountCode,amount,label:`${accountCode} ${label}`,sourceFile:'LONNEUXM - Analyses financières.xlsx',importedAt:''});
const fixture=()=>[
 row(2024,'221000',1000,'Bâtiment : acquisition'),row(2024,'221900',-400,'Frais aménagement sans mention amortissement'),row(2024,'630200',100,'Dotations corporelles'),row(2024,'288300',50,'Caution'),
 row(2025,'221000',1100,'Bâtiment : acquisition'),row(2025,'221900',-450,'Frais aménagement sans mention amortissement'),row(2025,'630200',80,'Dotations corporelles'),row(2025,'288300',50,'Caution'),
];

test('Lonneux 2025 : la VNC se rapproche sans appeler une variation brute acquisition',()=>{
 const report=buildLonneuxHistoricalCapex(fixture(),companyId),p=report.periods[1];
 expect(report.years).toEqual([2024,2025]);expect(p).toMatchObject({gross:1100,accumulated:450,net:650,depreciation:80,grossChange:100,accumulatedChange:50,netChange:50,otherAccumulatedImpact:30,bridgeDifference:0});
 expect(report.scope).toContain('ne prouvent ni acquisitions brutes');
});

test('Lonneux 2024 : clôture disponible mais pont indisponible faute de 2023',()=>{
 const p=buildLonneuxHistoricalCapex(fixture(),companyId).periods[0];
 expect(p).toMatchObject({status:'available',gross:1000,accumulated:400,net:600,grossChange:null,netChange:null,bridgeDifference:null});
});

test('Lonneux CAPEX : comptes 28 exclus et comptes historiques conservés au centime',()=>{
 const report=buildLonneuxHistoricalCapex(fixture(),companyId);
 expect(report.accounts.map(account=>account.code)).toEqual(['221000','221900']);
 expect(report.accounts[0].values[2025]).toBe(1100);expect(report.accounts[1]).toMatchObject({kind:'accumulated'});
});

const dirs:string[]=[];
afterEach(async()=>{await Promise.all(dirs.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
test('route CAPEX Lonneux : lit PostgreSQL sans appeler Odoo',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'equinoxe-lonneux-capex-'));dirs.push(dir);
 const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();
 const company=(await store.companies.read()).find(item=>item.slug==='lonneux')!;
 await store.historicalBalances.write(fixture().map(item=>({...item,companyId:company.id})));
 let odooCalls=0;const mock=spyOn(OdooConnector.prototype,'getFixedAssetLedger').mockImplementation(async()=>{odooCalls++;throw new Error('Odoo ne doit pas être appelé');});
 try{
  const app=createApp(store,auth),login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})})),cookie=login.headers.get('set-cookie')!.split(';')[0];
  const response=await app(new Request(`http://api/v1/companies/${company.id}/fixed-assets`,{headers:{cookie}})),body=await response.json();
  expect(response.status).toBe(200);expect(body.data.periods.map((period:{year:number})=>period.year)).toEqual([2024,2025]);expect(odooCalls).toBe(0);
 }finally{mock.mockRestore();}
});
