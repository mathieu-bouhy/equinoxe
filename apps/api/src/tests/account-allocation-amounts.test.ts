import { afterEach, expect, test } from 'bun:test';
import type { AccountMonthlyAmounts } from '@equinoxe/shared';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildAccountAllocationAmounts, loadAccountAllocationAmounts } from '../services/account-allocation-amounts';
import type { OdooConnector } from '../connectors/odoo';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';

test('2025 réalisé inchangé, 2026 annualisé une fois, signes et mois clôturé respectés', () => {
  const rows: AccountMonthlyAmounts[] = [{ accountId:'60', values:{'2025-01':-100,'2025-12':-200,'2026-01':-350,'2026-07':-350,'2026-08':-10000} },
    { accountId:'70', values:{'2025-12':500,'2026-07':700} }];
  const before=JSON.stringify(rows), report=buildAccountAllocationAmounts(rows,'2026-07');
  expect(report.through).toBe('2026-07-31');
  expect(report.accounts).toEqual([{accountId:'60',amount2025:-300,amount2026:-1200},{accountId:'70',amount2025:500,amount2026:1200}]);
  expect(JSON.stringify(rows)).toBe(before);
  expect(buildAccountAllocationAmounts(rows,'2026-01').accounts[0].amount2026).toBe(-4200);
});
test('2026 close : aucun multiplicateur supplémentaire ; années futures ignorées', () => {
  const rows=[{accountId:'1',values:{'2026-12':123.45,'2027-01':999}}];
  expect(buildAccountAllocationAmounts(rows,'2026-12').accounts[0].amount2026).toBe(123.45);
  expect(buildAccountAllocationAmounts(rows,'2027-05')).toMatchObject({through:'2026-12-31',accounts:[{amount2026:123.45}]});
});
test('distingue absence de période et comptes réellement sans mouvement', () => {
  expect(buildAccountAllocationAmounts([{accountId:'1',values:{}}],'2026-07').accounts[0]).toEqual({accountId:'1',amount2025:0,amount2026:0});
  expect(buildAccountAllocationAmounts([{accountId:'1',values:{}}],'2025-11').accounts[0]).toEqual({accountId:'1',amount2025:null,amount2026:null});
  expect(()=>buildAccountAllocationAmounts([],'2026-13')).toThrow();
});
test('tous les comptes Odoo sont demandés, même non classés ou non affectés ; erreur propagée', async () => {
  const calls:unknown[]=[];
  const connector={getProfitLossAccounts:async()=>[{id:'60'},{id:'99'}],getProfitLossAccountMonths:async(...args:unknown[])=>{calls.push(args);return [{accountId:'60',values:{}},{accountId:'99',values:{'2026-07':7}}];}} as unknown as OdooConnector;
  const report=await loadAccountAllocationAmounts(connector,'2026-07');
  expect(calls).toEqual([[['60','99'],[2025,2026],'2026-07-31']]);
  expect(report.accounts[1].amount2026).toBe(12);
  connector.getProfitLossAccountMonths=async()=>{throw new Error('Odoo indisponible');};
  await expect(loadAccountAllocationAmounts(connector,'2026-07')).rejects.toThrow('Odoo indisponible');
});

const dirs:string[]=[];
afterEach(async()=>{for(const dir of dirs.splice(0))await rm(dir,{recursive:true,force:true});});
test('route en lecture seule : admin, lecteur interdit, autre société, mois actualisé et affectations préservées',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'equinoxe-account-amounts-'));dirs.push(dir);
  const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();
  const company=(await store.companies.read()).find(row=>row.slug==='gimi')!;
  const calls:unknown[]=[];
  const connector={getProfitLossAccounts:async()=>[{id:'60',code:'600000',label:'Achats'}],getProfitLossAccountMonths:async(...args:unknown[])=>{calls.push(args);return [{accountId:'60',values:{'2025-12':-250,'2026-01':-700}}];}} as unknown as OdooConnector;
  const app=createApp(store,auth,connector),url=`http://api/v1/companies/${company.id}/account-analytic-amounts`;
  const login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})}));
  const cookie=login.headers.get('set-cookie')!.split(';')[0];
  await store.reportSettings.mutate(rows=>({values:rows.map(row=>row.companyId===company.id?{...row,lastClosedMonth:'2026-07'}:row),result:null}));
  const before=JSON.stringify(await store.accountAnalyticAllocations.read());
  expect((await app(new Request(url))).status).toBe(401);
  const response=await app(new Request(url,{headers:{cookie}}));expect(response.status).toBe(200);
  expect((await response.json()).data.accounts[0]).toEqual({accountId:'60',amount2025:-250,amount2026:-1200});
  expect(JSON.stringify(await store.accountAnalyticAllocations.read())).toBe(before);
  await store.reportSettings.mutate(rows=>({values:rows.map(row=>row.companyId===company.id?{...row,lastClosedMonth:'2026-08'}:row),result:null}));
  expect((await (await app(new Request(url,{headers:{cookie}}))).json()).data.accounts[0].amount2026).toBe(-1050);
  expect(calls.at(-1)).toEqual([['60'],[2025,2026],'2026-08-31']);
  const lonneux=(await store.companies.read()).find(row=>row.slug==='lonneux')!;
  expect((await app(new Request(url.replace(company.id,lonneux.id),{headers:{cookie}}))).status).toBe(409);
  const admin=(await store.users.read())[0];await store.users.write([{...admin,role:'viewer'}]);
  await store.access.write([{userId:admin.id,companyId:company.id,createdAt:new Date().toISOString()}]);
  expect((await app(new Request(url,{headers:{cookie}}))).status).toBe(403);
  await store.access.write([]);expect((await app(new Request(url,{headers:{cookie}}))).status).toBe(403);
});
