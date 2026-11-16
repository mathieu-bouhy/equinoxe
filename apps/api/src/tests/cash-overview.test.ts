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
