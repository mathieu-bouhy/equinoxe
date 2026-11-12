import { expect, test } from 'bun:test';
import type { ProfitLossReport, ProfitLossSection } from '@equinoxe/shared';
import { applyLonneuxPayrollCutoff, SEPTEMBER_PAYROLL_MOVES, type PayrollCutoffEntry } from '../services/lonneux-payroll-cutoff';
import { extrapolateProfitLoss } from '../services/extrapolated-profit-loss';
import { OdooConnector } from '../connectors/odoo';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';

const sections:ProfitLossSection[] = [
  {id:'personnel',companyId:'lonneux',kind:'accounts',label:'Personnel',prefixes:['62'],formula:[],order:0,createdAt:'',updatedAt:''},
  {id:'ebitda',companyId:'lonneux',kind:'calculation',label:'EBITDA',prefixes:[],formula:[{sectionId:'personnel',operator:'add'}],order:1,createdAt:'',updatedAt:''},
];
const entries=():PayrollCutoffEntry[]=>[100,200,300,400].map((amount,i)=>({id:i+1,date:'2026-10-05',move:SEPTEMBER_PAYROLL_MOVES[i],code:i===3?'623450':'620300',accountId:i===3?'2':'1',accountLabel:'Paie',label:'Septembre 2026 - Paie',debit:amount,credit:0}));
const report=():ProfitLossReport=>({source:'odoo',generatedAt:'',years:[2024,2025,2026],lines:[
  {key:'personnel',label:'Personnel',values:{2024:-4000,2025:-5000,2026:-1000},accounts:[{id:'1',code:'620300',label:'Paie',values:{2024:-4000,2025:-5000,2026:-1000}}]},
  {key:'ebitda',label:'EBITDA',values:{2024:-4000,2025:-5000,2026:-1000}},
]});

test('rattache les quatre OD une fois, ajoute les comptes absents et annualise une seule fois',()=>{
  const r=report(),before=structuredClone(r);
  const adjustment=applyLonneuxPayrollCutoff(r,sections,entries());
  expect(adjustment.amount).toBeCloseTo(-1000,2);
  expect(r.lines[0].values['2026']).toBeCloseTo(-2000,2);
  expect(r.lines[1].values['2026']).toBeCloseTo(-2000,2);
  expect(r.lines[0].accounts!.reduce((sum,a)=>sum+a.values['2026'],0)).toBeCloseTo(-2000,2);
  extrapolateProfitLoss(r,2026,9);
  expect(r.lines[0].values['2026']).toBeCloseTo(-2666.6666667,5);
  expect(r.lines[0].values['2024']).toBe(before.lines[0].values['2024']);
  expect(r.lines[0].values['2025']).toBe(before.lines[0].values['2025']);
});

test('les crédits diminuent la charge et les données suspectes ne modifient pas le rapport',()=>{
  const e=entries();e.push({...e[0],id:5,debit:0,credit:100});
  const r=report();applyLonneuxPayrollCutoff(r,sections,e);
  expect(r.lines[0].values['2026']).toBeCloseTo(-1900,2);
  for(const invalid of [
    entries().slice(1), [...entries(),entries()[0]],
    entries().map((e,i)=>i===0?{...e,move:'MISC/2026/10/0005'}:e),
    entries().map((e,i)=>i===0?{...e,move:'BILL/2026/10/0012'}:e),
    entries().map((e,i)=>i===0?{...e,label:'Octobre 2026 - Paie'}:e),
  ]){const r=report(),before=structuredClone(r);expect(()=>applyLonneuxPayrollCutoff(r,sections,invalid)).toThrow();expect(r).toEqual(before);}
});

test('le connecteur ne lit que les quatre OD validées et pagine via la passerelle en lecture seule',async()=>{
  const calls:any[]=[],moves=SEPTEMBER_PAYROLL_MOVES.map((name,i)=>({id:i+1,name}));
  const connector=new OdooConnector({baseUrl:'https://example.invalid',username:'fixture',database:'fixture',apiKey:'fixture',timeoutMs:1000,retries:0},(async(_url:unknown,init:RequestInit)=>{
    const p=JSON.parse(String(init.body)).params;calls.push(p);
    if(p.service==='common')return Response.json({result:1});
    const model=p.args[3],method=p.args[4];expect(['read','search_read']).toContain(method);
    if(model==='account.move')return Response.json({result:moves});
    if(model==='account.account')return Response.json({result:[{id:10,code:'620300',name:'Paie'},{id:20,code:'455000',name:'Dette'}]});
    const after=p.args[5][0].find((term:any[])=>term[0]==='id')[2];
    return Response.json({result:after?[]:moves.map(m=>({id:m.id,date:'2026-10-05',name:'Septembre 2026 - Paie',move_id:[m.id,m.name],account_id:[10,'Paie'],debit:100,credit:0}))});
  }) as typeof fetch);
  expect(await connector.getLonneuxSeptemberPayrollCutoff()).toHaveLength(4);
  const domain=calls.find(c=>c.args?.[3]==='account.move').args[5][0];
  expect(domain).toContainEqual(['state','=','posted']);expect(domain).toContainEqual(['move_type','=','entry']);
  expect(domain[0][2]).not.toContain('MISC/2026/10/0005');
});

test('la route ne rattache que septembre extrapolé Lonneux et conserve le réalisé ainsi que les autres mois',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'equinoxe-lonneux-cutoff-'));
  try {
    const store=new Store(directory),auth=new AuthService(store);await auth.bootstrap();
    const company=(await store.companies.read()).find(c=>c.slug==='lonneux')!;
    await store.pnlSections.write(sections.map(s=>({...s,companyId:company.id})));
    await store.historicalBalances.write([]);
    const close=async(month:string)=>store.reportSettings.mutate(rows=>({values:rows.map(row=>row.companyId===company.id?{...row,lastClosedMonth:month}:row),result:null}));
    await close('2026-09');
    let reads=0;
    const connector={getProfitLoss:async()=>report(),getLonneuxSeptemberPayrollCutoff:async()=>{reads++;return entries();}} as unknown as OdooConnector;
    const app=createApp(store,auth,connector,undefined,undefined,()=>connector);
    const login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})}));
    const headers={cookie:login.headers.get('set-cookie')!.split(';')[0]};
    const get=async(path:string)=>(await (await app(new Request(`http://api/v1/companies/${company.id}/${path}`,{headers}))).json()).data;
    const corrected=await get('profit-loss/extrapolated');
    expect(corrected.lines[0].values['2026']).toBeCloseTo(-2000*12/9,5);
    expect(corrected.payrollCutoff.entries).toHaveLength(4);
    expect((await get('profit-loss')).lines[0].values['2026']).toBe(-1000);
    expect(reads).toBe(1);
    await close('2026-10');
    expect((await get('profit-loss/extrapolated')).lines[0].values['2026']).toBe(-1200);
    expect(reads).toBe(1);
  } finally {await rm(directory,{recursive:true,force:true});}
});
