import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthService } from '../auth/service';
import { OdooConnector } from '../connectors/odoo';
import { createApp } from '../http/app';
import { Store } from '../repositories/store';
import { analyticPeriods } from '../services/analytic-profit-loss';

const directories:string[]=[];
afterEach(async()=>{await Promise.all(directories.splice(0).map(directory=>rm(directory,{recursive:true,force:true})))});

test('les périodes annuelles Gimi utilisent le même mois clôturé pour chaque année',()=>{
  const annual=analyticPeriods('annual','2026-09');
  expect(annual.map(period=>[period.start,period.end,period.months.length])).toEqual([
    ['2024-01-01','2024-09-30',9],
    ['2025-01-01','2025-09-30',9],
    ['2026-01-01','2026-09-30',9],
  ]);
  expect(analyticPeriods('extrapolated','2026-09').map(period=>period.end)).toEqual(['2024-12-31','2025-12-31','2026-09-30']);
  expect(analyticPeriods('ltm','2026-09').every(period=>period.months.length===12)).toBe(true);
});

test('le connecteur Odoo borne chaque total annuel au même mois',async()=>{
  const calls:any[]=[],network=(async(_url:unknown,init:RequestInit)=>{
    const payload=JSON.parse(String(init.body));calls.push(payload.params);
    return Response.json({result:payload.params.service==='common'?1:[]});
  }) as typeof fetch;
  const connector=new OdooConnector({baseUrl:'https://example.invalid',username:'fixture',database:'fixture',apiKey:'fixture',timeoutMs:1000,retries:0},network);
  await connector.getProfitLoss([2024,2025,2026],[],[],false,'2026-09-30',9);
  const domains=calls.filter(call=>call.args?.[4]==='read_group').map(call=>call.args[5][0]);
  expect(domains.map(domain=>domain.find((term:unknown[])=>term[0]==='date'&&term[1]==='<=')?.[2])).toEqual(['2024-09-30','2025-09-30','2026-09-30']);
});

test('les routes Gimi transmettent le mode YTD aux totaux, mois et écritures',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'equinoxe-gimi-ytd-'));directories.push(directory);
  const store=new Store(directory),auth=new AuthService(store);await auth.bootstrap();
  const gimi=(await store.companies.read()).find(company=>company.slug==='gimi')!;
  await store.reportSettings.mutate(rows=>({values:rows.map(row=>row.companyId===gimi.id?{...row,lastClosedMonth:'2026-09'}:row),result:null}));
  const profitCalls:unknown[][]=[],monthCalls:unknown[][]=[],entryCalls:unknown[][]=[];
  const connector={
    getProfitLoss:async(...args:unknown[])=>{profitCalls.push(args);return {years:[2024,2025,2026],lines:[],generatedAt:'',source:'odoo' as const}},
    getProfitLossMonths:async(...args:unknown[])=>{monthCalls.push(args);return {year:Number(args[0]),months:[],lines:[],generatedAt:'',source:'odoo' as const}},
    getAccountEntries:async(...args:unknown[])=>{entryCalls.push(args);return []},
  } as unknown as OdooConnector;
  const app=createApp(store,auth,connector),login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})})),cookie=login.headers.get('set-cookie')!.split(';')[0];
  const headers={cookie};
  const dashboards=await app(new Request(`http://api/v1/companies/${gimi.id}/dashboards`,{headers}));
  expect((await dashboards.json()).data.find((row:{slug:string})=>row.slug==='compte-resultat').label).toBe('Compte de résultat YTD');
  expect((await app(new Request(`http://api/v1/companies/${gimi.id}/profit-loss?years=2024,2025,2026`,{headers}))).status).toBe(200);
  expect(profitCalls[0]?.[4]).toBe('2026-09-30');expect(profitCalls[0]?.[5]).toBe(9);
  expect((await app(new Request(`http://api/v1/companies/${gimi.id}/profit-loss/months?year=2024&ytd=true`,{headers}))).status).toBe(200);
  expect(monthCalls[0]?.[3]).toBe('2024-09-30');
  expect((await app(new Request(`http://api/v1/companies/${gimi.id}/profit-loss/accounts/42/entries?year=2025&ytd=true`,{headers}))).status).toBe(200);
  expect(entryCalls[0]).toEqual(['42',2025,false,'2025-09-30']);
});
