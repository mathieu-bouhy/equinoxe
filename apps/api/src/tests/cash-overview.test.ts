import { expect,test } from 'bun:test';
import { loadCashOverview } from '../services/cash-overview';
import type { OdooConnector } from '../connectors/odoo';
import type { BfrSection } from '@equinoxe/shared';
test('synthèse : 13 dates, mêmes soldes/signatures que les rapports existants, stocks et travaux séparés',async()=>{
 const calls:string[]=[];
 const connector={
  getBalance:async(years:number[],asOf:string)=>{calls.push(asOf);return {assets:[{key:'cash',values:{[years[0]]:123.45}},{key:'inventory',accounts:[{code:'300000',values:{[years[0]]:50}},{code:'370000',values:{[years[0]]:70}}]}]};},
  getBfr:async(years:number[])=>({total:{[years[0]]:85},lines:[{label:'Fournisseurs',values:{[years[0]]:-25}}]}),
  getProfitLoss:async(years:number[])=>({lines:[{label:'EBITDA',values:{[years[0]]:-10}}]}),
 } as unknown as OdooConnector;
 const report=await loadCashOverview(connector,'2026-10-31',[{id:'bfr'}] as BfrSection[],[]);
 expect(calls[0]).toBe('2025-10-31');expect(calls[12]).toBe('2026-10-31');expect(report.months[12]).toMatchObject({cash:123.45,bfr:85,stocks:50,workInProgress:70});expect(report.ebitda).toBe(-10);
 await expect(loadCashOverview(connector,'2026-10-31',[],[])).rejects.toThrow('configurées');
});
test('Lonneux : historique 2026 seul, avertissements de reprise et EBITDA conforme au P&L avec brouillons',async()=>{
 let draft=false;
 const connector={getBalance:async(years:number[])=>({assets:[{key:'cash',values:{[years[0]]:10},accounts:[{code:'550001',values:{[years[0]]:10}}]},{key:'inventory',accounts:[]},{key:'unclassified-assets',accounts:[{code:'499000',values:{[years[0]]:-50}}]}],liabilities:[{key:'equity',accounts:[]}]}),getBfr:async(years:number[])=>({total:{[years[0]]:30},lines:[]}),getProfitLoss:async(years:number[],_sections:unknown,_subsections:unknown,includeDraft:boolean)=>{draft=includeDraft;return {lines:[{label:'EBITDA',values:{[years[0]]:17}}]};}} as unknown as OdooConnector;
 const report=await loadCashOverview(connector,'2026-09-30',[{id:'b'}] as BfrSection[],[],'lonneux');
 expect(report.months).toHaveLength(9);expect(report.months[0].date).toBe('2026-01-31');expect(report.ebitda).toBe(17);expect(draft).toBe(true);expect(report.warnings?.join(' ')).toContain('499');expect(report.warnings?.join(' ')).toContain('capitaux propres');expect(report.ebitdaNote).toContain('non validées incluses');
});
