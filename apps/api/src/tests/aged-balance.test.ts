import { describe,expect,test } from 'bun:test';
import { agingBucket,buildAgedBalance,treasuryMonthEnds,validTreasuryDate,type TreasuryLedger } from '../services/aged-balance';
import { treasuryResponse } from '../http/treasury';
import type { Company,ReportSettings } from '@equinoxe/shared';
import type { OdooConnector } from '../connectors/odoo';
const dates=treasuryMonthEnds('2026-10-31');
function fixture():TreasuryLedger{return {through:'2026-11-16',readAt:'2026-11-16T12:00:00Z',baseUrl:'https://odoo.example',accounts:[{id:1,code:'400000',name:'Clients',side:'clients'},{id:2,code:'440000',name:'Fournisseurs',side:'fournisseurs'}],
 lines:[{id:1,date:'2026-09-01',dueDate:'2026-09-30',balance:100,residual:40,accountId:1,partnerId:5,partner:'Client',moveId:1},{id:2,date:'2026-11-10',dueDate:null,balance:-30,residual:0,accountId:1,partnerId:5,partner:'Client',moveId:2},{id:3,date:'2026-10-01',dueDate:'2026-10-31',balance:-120,residual:-50,accountId:2,partnerId:6,partner:'Fournisseur',moveId:3},{id:4,date:'2026-11-10',dueDate:null,balance:70,residual:0,accountId:2,partnerId:6,partner:'Fournisseur',moveId:4}],
 moves:[{id:1,name:'INV/1',ref:'ref',invoiceDate:'2026-09-01',type:'out_invoice'},{id:2,name:'BNK/1',ref:'',invoiceDate:null,type:'entry'},{id:3,name:'BILL/1',ref:'',invoiceDate:'2026-10-01',type:'in_invoice'},{id:4,name:'BNK/2',ref:'',invoiceDate:null,type:'entry'}],
 matches:[{id:1,date:'2026-11-10',debitId:1,creditId:2,amount:30},{id:2,date:'2026-11-10',debitId:4,creditId:3,amount:70}],
 controls:[...dates,'2026-11-16'].flatMap(date=>[{date,accountId:1,balance:date<'2026-09-01'?0:date<'2026-11-10'?70:40},{date,accountId:2,balance:date<'2026-10-01'?0:date<'2026-11-10'?-120:-50}])};}

describe('Balances âgées historiques',()=>{
 test('reconstitue un règlement partiel postérieur à la clôture sans réutiliser le solde actuel',()=>{const ledger=fixture(),closed=buildAgedBalance(ledger,'clients','2026-10-31','2026-10-31'),today=buildAgedBalance(ledger,'clients','2026-11-16','2026-10-31');expect(closed.rows).toHaveLength(1);expect(closed.rows[0]).toMatchObject({original:100,settled:30,residual:70,bucket:'days60',daysLate:31});expect(today.rows[0].residual).toBe(40);expect(closed.difference).toBe(0);expect(ledger.lines[0].residual).toBe(40);expect(closed.history.at(-1)?.invoices).toBe(70);});
 test('inverse uniquement la convention fournisseurs',()=>{const report=buildAgedBalance(fixture(),'fournisseurs','2026-10-31','2026-10-31');expect(report.rows[0]).toMatchObject({original:120,settled:0,residual:120,bucket:'notDue'});expect(report.totals.ledger).toBe(120);expect(report.difference).toBe(0);});
 test('isole paiements non lettrés, avoirs et douteux et conserve les montants signés',()=>{const ledger=fixture();ledger.accounts.push({id:3,code:'407000',name:'Douteux',side:'clients'});ledger.moves.push({id:5,name:'AV/1',ref:'',invoiceDate:'2026-10-01',type:'out_refund'},{id:6,name:'BNK/3',ref:'',invoiceDate:null,type:'entry'});ledger.lines.push({id:5,date:'2026-10-01',dueDate:null,balance:-20,residual:-20,accountId:1,partnerId:5,partner:'Client',moveId:5},{id:6,date:'2026-10-02',dueDate:null,balance:-10,residual:-10,accountId:1,partnerId:5,partner:'Client',moveId:6},{id:7,date:'2026-10-02',dueDate:null,balance:50,residual:50,accountId:3,partnerId:5,partner:'Client',moveId:1});for(const date of [...dates,'2026-11-16'])ledger.controls.push({date,accountId:3,balance:date<'2026-10-02'?0:50});ledger.controls.filter(c=>c.accountId===1&&c.date>='2026-10-02').forEach(c=>c.balance-=30);const report=buildAgedBalance(ledger,'clients','2026-10-31','2026-10-31');expect(report.totals).toMatchObject({invoices:50,noDueDate:-20,other:-10,doubtful:50,ledger:90});expect(report.rows.find(r=>r.id===5)?.kind).toBe('credit');expect(report.difference).toBe(0);expect(report.warnings.length).toBeGreaterThan(0);});
 test('ne masque pas un écart de contrôle ou un contrôle manquant',()=>{const ledger=fixture();ledger.controls.find(c=>c.date==='2026-10-31'&&c.accountId===1)!.balance+=1;expect(buildAgedBalance(ledger,'clients','2026-10-31','2026-10-31').difference).toBe(-1);ledger.controls=ledger.controls.filter(c=>c.date!=='2026-10-31');expect(()=>buildAgedBalance(ledger,'clients','2026-10-31','2026-10-31')).toThrow('incomplet');});
 test('tranches exactes, année bissextile et dates invalides',()=>{for(const [days,bucket] of [[0,'notDue'],[1,'days30'],[30,'days30'],[31,'days60'],[60,'days60'],[61,'days90'],[90,'days90'],[91,'over90']] as const){const due=new Date(Date.parse('2026-10-31')-days*86400000).toISOString().slice(0,10);expect(agingBucket('2026-10-31',due).bucket).toBe(bucket);}expect(agingBucket('2026-10-31',null).bucket).toBe('noDueDate');expect(treasuryMonthEnds('2024-02-29',1)).toEqual(['2024-02-29']);expect(validTreasuryDate('2026-02-30')).toBe(false);});
});
test('route refuse mutation, société différente et paramètres libres avant toute lecture Odoo',async()=>{
 const company={id:'g',slug:'gimi',connectorType:'odoo'} as Company,setting={companyId:'g',lastClosedMonth:'2026-10'} as ReportSettings;
 const connector={getTreasuryLedger:()=>{throw new Error('should not call');}} as unknown as OdooConnector;
 for(const [method,view,status] of [['POST','clients',405],['GET','arbitrary-model',422]] as const){expect((await treasuryResponse(new Request(`https://test/treasury?view=${view}`,{method}),company,connector,setting)).status).toBe(status);}
 expect((await treasuryResponse(new Request('https://test/treasury'),{...company,slug:'eurodrill'},connector,setting)).status).toBe(409);
});
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';
import { sign } from '../auth/session';
import { config } from '../config';

test('accès société contrôlé sur chaque lecture, y compris après retrait pendant la session',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'treasury-access-'));
 try{
  const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();
  const company=(await store.companies.read()).find(c=>c.slug==='gimi')!;
  await store.reportSettings.write([{companyId:company.id,lastClosedMonth:'2026-10',updatedAt:''}]);
  const admin=(await store.users.read())[0],viewer={...admin,id:'treasury-viewer',email:'viewer@example.test',role:'user' as const,companyIds:[company.id]};
  await store.users.write([admin,viewer]);
  let calls=0;const connector={getTreasuryLedger:async()=>{calls++;return fixture();}} as unknown as OdooConnector;
  const app=createApp(store,auth,connector),url=`http://api/v1/companies/${company.id}/treasury?view=clients`;
  const cookie=async(id:string)=>`equinoxe_session=${await sign({sub:id,role:'user',exp:Date.now()+60000},config.authSecret)}`;
  expect((await app(new Request(url))).status).toBe(401);
  const viewerCookie=await cookie(viewer.id);
  expect((await app(new Request(url,{headers:{cookie:viewerCookie}}))).status).toBe(200);
  expect((await app(new Request(url,{headers:{cookie:await cookie(admin.id)}}))).status).toBe(200);
  await store.users.write([admin,{...viewer,companyIds:[]}]);
  expect((await app(new Request(url,{headers:{cookie:viewerCookie}}))).status).toBe(403);
  expect((await app(new Request(url.replace(company.id,'unknown'),{headers:{cookie:viewerCookie}}))).status).toBe(403);
  expect(calls).toBe(2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('échéancier contractuel : bornes hebdomadaires, avoir signé et exclusion des retards/paiements',()=>{
 const ledger=fixture();ledger.lines[0].dueDate='2026-11-07';
 const report=buildAgedBalance(ledger,'clients','2026-10-31','2026-10-31');
 expect(report.upcoming.map(w=>w.amount)).toEqual([70,0,0,0]);
 ledger.lines[0].dueDate='2026-11-08';expect(buildAgedBalance(ledger,'clients','2026-10-31','2026-10-31').upcoming.map(w=>w.amount)).toEqual([0,70,0,0]);
 ledger.lines[0].dueDate='2026-10-31';expect(buildAgedBalance(ledger,'clients','2026-10-31','2026-10-31').upcoming.every(w=>w.amount===0)).toBe(true);
});
test('Lonneux : neuf mois réels, aucun faux historique 2025, instance attendue transmise au connecteur',async()=>{
 const company={id:'l',slug:'lonneux',connectorType:'odoo'} as Company,setting={companyId:'l',lastClosedMonth:'2026-09'} as ReportSettings;
 let receivedSlug:string|undefined;
 const connector={getTreasuryLedger:async(_through:string,_closed:string,slug:string)=>{receivedSlug=slug;return fixture();}} as unknown as OdooConnector;
 const response=await treasuryResponse(new Request('https://test/treasury?view=clients'),company,connector,setting);
 expect(response.status).toBe(200);const report=(await response.json()).data;
 expect(receivedSlug).toBe('lonneux');expect(report.history).toHaveLength(9);expect(report.history[0].date).toBe('2026-01-31');expect(report.history[8].date).toBe('2026-09-30');expect(report.warnings.join(' ')).toContain('reprise des soldes');
});
