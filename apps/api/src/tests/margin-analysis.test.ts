import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AccountAnalyticAllocation, AnalyticAllocationCode, EmployeeAnalyticAllocation, ProfitLossReport, ProfitLossSection } from '@equinoxe/shared';
import { buildMarginAnalysis } from '../services/margin-analysis';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';
import type { OdooConnector } from '../connectors/odoo';

const sections=[{id:'sales',kind:'accounts',prefixes:['70','71'],order:0},{id:'goods',kind:'accounts',prefixes:['60'],order:1}] as ProfitLossSection[];
const key={id:'split',label:'Mixte',fireInstallation:60,fireMaintenance:40,intrusion:0,led:0} as AnalyticAllocationCode;
const assignment=(id:string):AccountAnalyticAllocation=>({odooAccountId:id,accountCode:id,analyticAllocationCodeId:'split'} as AccountAnalyticAllocation);
const fixture=():ProfitLossReport=>({years:[2024,2025,2026],source:'odoo',generatedAt:'2026-09-08',lines:[
  {key:'sales',label:'CA',values:{2024:1100,2025:1100,2026:1100},accounts:[{id:'700001',code:'700001',label:'Ventes',values:{2024:1000,2025:1000,2026:1000}},{id:'700999',code:'700999',label:'Sans clé',values:{2024:100,2025:100,2026:100}}]},
  {key:'goods',label:'Marchandises',values:{2024:-400,2025:-400,2026:-400},accounts:[{id:'600100',code:'600100',label:'Achats',values:{2024:-400,2025:-400,2026:-400}},{id:'600000',code:'600000',label:'Zéro',values:{2024:0,2025:0,2026:0}}]},
]});
test('cinq départements ordonnés, clés mixtes, autres, charges signées et conservation des totaux',()=>{
  const source=fixture(),report=buildMarginAnalysis(source,sections,[assignment('700001'),assignment('600100')],[key],[],'2026-06');
  expect(report.blocks[0].rows.map(row=>row.label)).toEqual(['Incendie installation','Incendie maintenance','Intrusion','LED','Autres']);
  expect(report.blocks[0].rows[0].values[2024]).toBe(600);
  expect(report.blocks[0].rows[4].values[2026]).toBe(200);
  expect(report.blocks[1].rows[0].values[2026]).toBe(-480);
  expect(report.blocks[2].rows[0].values[2026]).toBe(720);
  expect(report.blocks[2].totals).toEqual({'2024':700,'2025':700,'2026':1400});
  expect(report.blocks[2].rows[0].accounts).toHaveLength(2);
  for(const block of report.blocks)for(const y of report.years)expect(block.rows.reduce((sum,row)=>sum+row.values[y],0)).toBeCloseTo(block.totals[y],8);
  expect(source.lines[0].accounts![0].values[2026]).toBe(1000);
  expect(report.blocks[1].rows[4].accounts).toHaveLength(0);
});
test('annualise uniquement la dernière année et valide le mois',()=>{
  const report=buildMarginAnalysis(fixture(),sections,[],[],[],'2026-07');
  expect(report.blocks[0].totals[2026]).toBeCloseTo(1100*12/7,8);
  expect(report.blocks[0].totals[2025]).toBe(1100);
  expect(buildMarginAnalysis(fixture(),sections,[],[],[],'2026-12').factor).toBe(1);
  expect(()=>buildMarginAnalysis(fixture(),sections,[],[],[],'2026-00')).toThrow();
});
test('refuse un détail de comptes incomplet au lieu de présenter un total faux',()=>{
  const report=fixture();report.lines[0].accounts=[];
  expect(()=>buildMarginAnalysis(report,sections,[],[],[],'2026-06')).toThrow('Le détail des comptes');
});
test('clé supprimée ou invalide en Autres, zéro CA sans division, effectifs dynamiques',()=>{
  expect(buildMarginAnalysis(fixture(),sections,[assignment('700001')],[],[],'2026-06').blocks[0].rows[4].values[2024]).toBe(1100);
  expect(buildMarginAnalysis(fixture(),sections,[assignment('700001')],[{...key,fireInstallation:90}],[],'2026-06').blocks[0].rows[4].values[2024]).toBe(1100);
  const dynamic={...key,id:'dynamic',label:'Au nombre d’employés'},employees=[{analyticAllocationCodeId:key.id}] as EmployeeAnalyticAllocation[];
  const report=buildMarginAnalysis(fixture(),sections,[{...assignment('700001'),analyticAllocationCodeId:'dynamic'}],[key,dynamic],employees,'2026-06');
  expect(report.blocks[0].rows[0].values[2024]).toBe(600);
});
test('API autorise les lecteurs attribués, bloque les autres avant Odoo et transmet le bon arrêt comptable',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'equinoxe-margin-'));
  try{
    const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();
    const gimi=(await store.companies.read()).find(c=>c.slug==='gimi')!;
    let calls=0,args:unknown[]=[];
    const connector={getProfitLoss:async(...input:unknown[])=>{calls++;args=input;return fixture();}} as unknown as OdooConnector;
    const app=createApp(store,auth,connector);
    const login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})}));
    const cookie=login.headers.get('set-cookie')!.split(';')[0],url=`http://api/v1/companies/${gimi.id}/margin-analysis`;
    await store.pnlSections.write(sections.map(section=>({...section,companyId:gimi.id,label:section.id,formula:[],createdAt:'',updatedAt:''})));
    await store.reportSettings.write([{companyId:gimi.id,lastClosedMonth:'2026-06',updatedAt:''}]);
    expect((await app(new Request(url))).status).toBe(401);
    const response=await app(new Request(url,{headers:{cookie}}));expect(response.status).toBe(200);
    expect(args[0]).toEqual([2024,2025,2026]);expect(args[3]).toBe(false);expect(args[4]).toBe('2026-06-30');
    expect((await response.json()).data.blocks[2].totals['2026']).toBe(1400);
    const admin=(await store.users.read())[0];await store.users.mutate(users=>({values:users.map(user=>({...user,role:'viewer' as const})),result:null}));
    expect((await app(new Request(url,{headers:{cookie}}))).status).toBe(403);expect(calls).toBe(1);
    await store.access.write([{userId:admin.id,companyId:gimi.id,createdAt:''}]);
    expect((await app(new Request(url,{headers:{cookie}}))).status).toBe(200);
    expect((await store.dashboards.read()).filter(board=>board.slug==='analyse-marge').map(board=>board.companyId)).toEqual([gimi.id]);
  }finally{await rm(dir,{recursive:true,force:true});}
});
