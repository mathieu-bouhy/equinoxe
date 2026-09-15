import { afterEach, expect, test, spyOn } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { BalanceAccount, HistoricalAccountBalance } from '@equinoxe/shared';
import { buildBalance, historicalBalance, loadBalanceSheet } from '../services/balance-sheet';
import { OdooConnector } from '../connectors/odoo';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';

const row=(code:string,values:Record<string,number>):BalanceAccount=>({id:code,code,label:`Compte ${code}`,values});
const history=(code:string,amount:number,year=2025):HistoricalAccountBalance=>({companyId:'lonneux',accountCode:code,label:`Compte ${code}`,amount,year,importedAt:'2026-01-01T00:00:00Z',sourceFile:'fixture.xlsx'});
test('classification exclusive, passifs positifs, amortissements négatifs, sources immuables',()=>{
  const rows=[row('170000',{'2025':-100}),row('420000',{'2025':-30}),row('110000',{'2025':-50}),row('160000',{'2025':-10}),row('241000',{'2025':250}),row('241900',{'2025':-60})];
  const original=JSON.stringify(rows),report=buildBalance([2025],rows),lines=[...report.assets,...report.liabilities];
  expect(JSON.stringify(rows)).toBe(original);
  expect(lines.flatMap(line=>line.accounts)).toHaveLength(rows.length);
  expect(lines.find(line=>line.key==='financial-debt')?.values['2025']).toBe(130);
  expect(lines.find(line=>line.key==='equity')?.values['2025']).toBe(50);
  expect(lines.find(line=>line.key==='provisions')?.values['2025']).toBe(10);
  expect(lines.find(line=>line.key==='receivables')?.values['2025']).toBe(0);
  expect(lines.find(line=>line.key==='fixed-assets')?.values['2025']).toBe(190);
  for(const line of lines)expect(line.accounts.reduce((sum,account)=>sum+account.values['2025'],0)).toBe(line.values['2025']);
});
test('historique : respect des signes Excel, vrais comptes seuls et aucun écrasement',()=>{
  const rows=[history('110000',150),history('440000',70),history('241000',300),history('241900',-80),history('700000',10),history('false',20),{...history('550000',999),companyId:'gimi'}],before=JSON.stringify(rows);
  const report=historicalBalance([2024,2025],rows,'lonneux');
  expect(report.liabilities.find(line=>line.key==='equity')?.values['2025']).toBe(150);
  expect(report.liabilities.find(line=>line.key==='suppliers')?.values['2025']).toBe(70);
  expect(report.assets.find(line=>line.key==='fixed-assets')?.values['2025']).toBe(220);
  expect(report.assets.concat(report.liabilities).flatMap(line=>line.accounts)).toHaveLength(4);
  expect(report.periods?.[0].status).toBe('unavailable');
  expect(JSON.stringify(rows)).toBe(before);
  expect(()=>historicalBalance([2025],[rows[0],rows[0]],'lonneux')).toThrow('dupliqué');
});
test('sources réservées : seul 2026 est demandé à Odoo, au mois configuré',async()=>{
  const calls:unknown[]=[];
  const result=await loadBalanceSheet({companyId:'lonneux',companySlug:'lonneux',years:[2024,2025,2026],asOf:'2026-08-31',readHistory:async()=>[history('550000',100,2024),history('110000',100,2024),history('550000',120),history('110000',120)],readOdoo:async(years,asOf)=>{calls.push({years,asOf});return buildBalance(years,[row('550000',{'2026':140}),row('110000',{'2026':-140})],asOf);}});
  expect(calls).toEqual([{years:[2026],asOf:'2026-08-31'}]);
  expect(result.assets.find(line=>line.key==='cash')?.values).toEqual({'2024':100,'2025':120,'2026':140});
  expect(result.source).toBe('mixed');expect(result.periods?.every(period=>period.status==='available')).toBe(true);
});
test('erreur Odoo : conserve historique, ne transforme pas 2026 en zéro et ne divulgue pas erreur',async()=>{
  const report=await loadBalanceSheet({companyId:'lonneux',companySlug:'lonneux',years:[2024,2025,2026],readHistory:async()=>[history('550000',42)],readOdoo:async()=>{throw new Error('secret-credential');}});
  expect(report.assets.find(line=>line.key==='cash')?.values['2025']).toBe(42);
  expect(report.assets.find(line=>line.key==='cash')?.values['2026']).toBeUndefined();
  expect(report.periods?.find(period=>period.year===2026)?.status).toBe('unavailable');
  expect(JSON.stringify(report)).not.toContain('secret-credential');
});
test('erreur PostgreSQL : aucun repli Odoo sur les années historiques',async()=>{
  const report=await loadBalanceSheet({companyId:'lonneux',companySlug:'lonneux',years:[2024,2025,2026],readHistory:async()=>{throw new Error('db-secret');},readOdoo:async years=>buildBalance(years,[row('400000',{'2026':12})])});
  expect(report.periods?.slice(0,2).map(period=>period.status)).toEqual(['unavailable','unavailable']);
  expect(report.periods?.[2].status).toBe('incomplete');
  expect(report.assets.find(line=>line.key==='receivables')?.values['2024']).toBeUndefined();
});
test('Gimi reste intégralement Odoo sans consulter l’import Lonneux',async()=>{
  let historyRead=false;
  const report=await loadBalanceSheet({companyId:'gimi',companySlug:'gimi',years:[2024,2025,2026],readHistory:async()=>{historyRead=true;return [];},readOdoo:async years=>buildBalance(years,[row('550000',{'2024':10,'2025':20,'2026':30})])});
  expect(historyRead).toBe(false);expect(report.source).toBe('odoo');
  expect(report.assets.find(line=>line.key==='cash')?.values['2024']).toBe(10);
});
test('Odoo : les dates configurées et posted sont transmis uniquement aux lectures',async()=>{
  const calls:any[]=[];
  const network=(async(_url:unknown,init:RequestInit)=>{const body=JSON.parse(init.body as string);calls.push(body.params);const args=body.params.args;return Response.json({result:body.params.service==='common'?1:args[4]==='read'?[{id:1,code:'420000',name:'Dette',account_type:'liability_current'}]:[{account_id:[1,'Dette'],balance:-100}]});}) as typeof fetch;
  const connector=new OdooConnector({baseUrl:'https://odoo.invalid',database:'fixture',username:'fixture',apiKey:'fixture',timeoutMs:15000,retries:0},network);
  const report=await connector.getBalance([2024,2025,2026],'2026-06-30');
  const groups=calls.filter(call=>call.service==='object'&&call.args[4]==='read_group');
  expect(groups.map(call=>call.args[5][0])).toEqual(['2024-12-31','2025-12-31','2026-06-30'].map(end=>[['parent_state','=','posted'],['date','<=',end]]));
  expect(calls.filter(call=>call.service==='object').every(call=>['read_group','read'].includes(call.args[4]))).toBe(true);
  expect(report.liabilities.find(line=>line.key==='financial-debt')?.values['2026']).toBe(100);
  expect(report.assets.find(line=>line.key==='receivables')?.values['2026']).toBe(0);
});

const dirs:string[]=[];
afterEach(async()=>{await Promise.all(dirs.splice(0).map(dir=>rm(dir,{recursive:true,force:true})));});
test('route bilan : droits, retrait d’accès, années uniques et actualisation du mois',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'equinoxe-balance-test-'));dirs.push(dir);
  const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();
  const company=(await store.companies.read()).find(company=>company.slug==='lonneux')!;
  await store.historicalBalances.write([{...history('550000',123),companyId:company.id}]);
  const app=createApp(store,auth),calls:any[]=[],mock=spyOn(OdooConnector.prototype,'getBalance').mockImplementation(async(years,asOf)=>{calls.push({years,asOf});return buildBalance(years,[row('550000',{'2026':456})],asOf);});
  try{
    const response=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})}));
    const cookie=response.headers.get('set-cookie')!.split(';')[0],url=`http://api/v1/companies/${company.id}/balance-sheet`;
    expect((await app(new Request(url))).status).toBe(401);
    const settings=await store.reportSettings.read();await store.reportSettings.write(settings.map(item=>item.companyId===company.id?{...item,lastClosedMonth:'2026-06'}:item));
    const result=await app(new Request(url,{headers:{cookie}}));expect(result.status).toBe(200);
    expect((await result.json()).data.assets.find((line:any)=>line.key==='cash').values['2025']).toBe(123);
    expect(calls.at(-1)).toEqual({years:[2026],asOf:'2026-06-30'});
    await store.reportSettings.write(settings.map(item=>item.companyId===company.id?{...item,lastClosedMonth:'2026-08'}:item));
    await app(new Request(url,{headers:{cookie}}));expect(calls.at(-1).asOf).toBe('2026-08-31');
    expect((await app(new Request(`${url}?years=2024,2024,2026`,{headers:{cookie}}))).status).toBe(422);
    const admin=(await store.users.read())[0];await store.users.write([{...admin,role:'viewer'}]);
    expect((await app(new Request(url,{headers:{cookie}}))).status).toBe(403);
    await store.access.write([{userId:admin.id,companyId:company.id,createdAt:new Date().toISOString()}]);
    expect((await app(new Request(url,{headers:{cookie}}))).status).toBe(200);
    await store.access.write([]);expect((await app(new Request(url,{headers:{cookie}}))).status).toBe(403);
  }finally{mock.mockRestore();}
});
