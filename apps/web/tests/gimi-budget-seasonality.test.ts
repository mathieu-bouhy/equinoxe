import { expect,test } from 'bun:test';
import type { GimiBudgetProjection, ProfitLossMonthlyReport } from '@equinoxe/shared';
import { gimiBudgetSeasonality } from '../src/services/gimi-budget-seasonality';

const report=(year:number,revenue:number[],gross:number[]):ProfitLossMonthlyReport=>({year,months:Array.from({length:12},(_,index)=>`${year}-${String(index+1).padStart(2,'0')}`),generatedAt:'',source:'odoo',lines:[{key:'revenue',label:"Chiffre d’affaires",values:Object.fromEntries(revenue.map((value,index)=>[`${year}-${String(index+1).padStart(2,'0')}`,value]))},{key:'gross',label:'Marge brute',values:Object.fromEntries(gross.map((value,index)=>[`${year}-${String(index+1).padStart(2,'0')}`,value]))}]});

test('applique 2025 sur douze mois et affine les mois clôturés avec 2026',()=>{
  const projection={lines:[{key:'revenue',values:{2027:1200}},{key:'grossMargin',values:{2027:600}}]} as GimiBudgetProjection;
  const rows=gimiBudgetSeasonality(report(2025,[5,5,10,10,10,10,10,10,10,10,5,5],[5,5,10,10,10,10,10,10,10,10,5,5]),report(2026,[8,8,10,10,10,10,10,10,8,8,0,0],[8,8,10,10,10,10,10,10,8,8,0,0]),projection)!;
  expect(rows).toHaveLength(12);expect(rows.reduce((sum,row)=>sum+row.revenue,0)).toBeCloseTo(1200,6);expect(rows.reduce((sum,row)=>sum+row.grossMargin,0)).toBeCloseTo(600,6);expect(rows[10].revenue).toBeGreaterThan(0);
});

