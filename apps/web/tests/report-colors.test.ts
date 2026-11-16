import { expect,test } from 'bun:test';
import { monthlyPerformanceRows,reportColors } from '../src/services/report-colors';
test('monthly comparison : CA and gross margin, same months N−1, budget per twelfth without fake missing values',()=>{
 const rows=monthlyPerformanceRows(2026,10,'ytd',(key,label)=>key==='2026-01'?(label==='Marge brute'?600:1000):key==='2025-01'?200:undefined,{'Chiffre d’affaires':12000,'Marge brute':6000},m=>m);
 expect(rows).toHaveLength(10);expect(rows[0]).toMatchObject({caActual:1,caPrior:.2,caBudget:1,grossActual:.6,grossPrior:.2,grossBudget:.5});expect(rows[1].caActual).toBeNull();expect(rows.reduce((s,r)=>s+(r.caBudget??0),0)).toBe(10);
 const ltm=monthlyPerformanceRows(2026,10,'ltm',()=>undefined,{'Chiffre d’affaires':12000},m=>m);expect(ltm[0].name).toBe('2025-11');expect(ltm[0].caBudget).toBeNull();expect(ltm[2].caBudget).toBe(1);
 expect(reportColors).toMatchObject({actual:'#111111',budget:'#2563eb',prior:'#7030a0'});
});
