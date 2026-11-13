import { expect,test } from 'bun:test';
import { analysisRows,accountMovements,managementFees } from '../src/services/gimi-analysis';
import { payrollSummary,payrollDepartments } from '../src/services/gimi-payroll';
import { gimiAnalyticBudget2026,gimiRevenueBudget2026 } from '../src/services/gimi-budget';
import type { AnalyticProfitLossReport } from '@equinoxe/shared';
test('charges signées et budget YTD, sans transformer une absence en zéro',()=>{
 const rows=analysisRows([{key:'sbd',label:'Services et biens divers',values:{'2025':-661000,'2026':-926000},accounts:[]}],'2026','2025',2026,10,'ytd');
 const sbd=rows[4];expect(sbd.delta).toBe(-265000);expect(sbd.budget).toBe(-860000);expect(sbd.budgetDelta).toBe(-66000);expect(rows[0].actual).toBeNull();
});
test('LTM reprend le budget annuel et ne réutilise pas 2026 pour une autre année',()=>{
 expect(analysisRows([],'new','old',2026,2,'ltm')[0].budget).toBe(8012000);
 expect(analysisRows([],'2027','2026',2027,2,'ytd')[0].budget).toBeNull();
});
test('une reprise positive et une charge donnent un impact signé exact',()=>{
 const moves=accountMovements({key:'x',label:'SBD',values:{},accounts:[{id:'a',code:'619999',label:'FAR',values:{old:10000,new:-71000}},{id:'b',code:'618',label:'Dirigeants',values:{old:-131000,new:0}}]},'new','old');
 expect(moves[0].delta).toBe(131000);expect(moves[1].delta).toBe(-81000);
});
test('Bajoma et dirigeants sont comparés ensemble sans doubler les mouvements SBD',()=>{
 const line={key:'sbd',label:'Services et biens divers',values:{},accounts:[{id:'b',code:'613208',label:'Bajoma',values:{old:-33000,new:-175000}},{id:'d',code:'618000',label:'Dirigeants',values:{old:-131000,new:0}},{id:'f',code:'619999',label:'FAR',values:{old:10000,new:-71000}}]};
 const fees=managementFees(line,'new','old');expect(fees?.actual).toBe(-175000);expect(fees?.prior).toBe(-164000);expect(fees?.delta).toBe(-11000);
 const moves=accountMovements(line,'new','old');expect(moves).toHaveLength(2);expect(moves.reduce((s,a)=>s+a.delta,0)).toBe(-92000);expect(moves.find(a=>a.members)?.members).toHaveLength(2);
});
test('le calendrier RH donne 14 entrées et 2 sorties, sans compter le CDI d’octobre deux fois',()=>{
 const rh=payrollSummary('2026-10');expect(rh.entrants).toBe(14);expect(rh.sortants).toBe(2);expect(rh.net).toBe(12);
 expect(rh.series.find(m=>m.month==='2026-07')?.entrants).toBe(1);expect(rh.series.find(m=>m.month==='2026-10')?.net).toBe(0);
 expect(payrollDepartments.reduce((s,d)=>s+d.entrants,0)).toBe(14);expect(payrollDepartments.reduce((s,d)=>s+d.sortants,0)).toBe(2);
});
test('les mouvements RH respectent le mois clôturé et signalent les mois non actualisés',()=>{
 expect(payrollSummary('2026-06').entrants).toBe(10);expect(payrollSummary('2026-06').net).toBe(9);
 expect(payrollSummary('2026-11').complete).toBe(false);expect(payrollSummary('2026-11').through).toBe('2026-10');expect(payrollSummary('2025-10').available).toBe(false);
});
test('la sélection multiple reprend son budget analytique, proratisé uniquement en YTD',()=>{
 const departments=['fireInstallation','fireMaintenance'] as const;
 const labels=['Chiffre d’affaires','Marchandises','Sous-traitance','Services et biens divers','Personnel','Charges d’exploitation','Produits d’exploitation'];
 const report:AnalyticProfitLossReport={mode:'annual',departments:[...departments],lastClosedMonth:'2026-10',periods:[],revenueKey:'0',unallocated:[],warnings:[],generatedAt:'',lines:labels.map((label,i)=>({key:String(i),label,kind:'accounts',values:{'2025':-100,'2026':-150},monthlyValues:{'2026-01':-25},originalValues:{},originalMonthlyValues:{'2026-01':-100},accounts:[],subsections:[]}))};
 const budget=gimiAnalyticBudget2026(report,[...departments]);
 const ytd=analysisRows(report.lines,'2026','2025',2026,10,'ytd',budget),ltm=analysisRows(report.lines,'2026','2025',2026,10,'ltm',budget);
 expect(ytd[0].budget).toBeCloseTo((gimiRevenueBudget2026.fireInstallation+gimiRevenueBudget2026.fireMaintenance)*10/12);
 expect(ytd[1].budget).toBeCloseTo(-2724000*.25*10/12);
 expect(ltm[1].budget).toBe(-2724000*.25);
 expect(ytd[6].budget).toBeCloseTo((budget['Marge brute']!+budget['Coûts hors achats']!)*10/12);
 expect(ytd[1].actual).toBe(-150);
});
test('une ventilation budgétaire manquante ne reprend jamais le budget société',()=>{
 const rows=analysisRows([{key:'p',label:'Personnel',values:{'2025':-50,'2026':-80}}],'2026','2025',2026,10,'ytd',{});
 expect(rows[5].actual).toBe(-80);expect(rows[5].budget).toBeNull();expect(rows[5].budgetDelta).toBeNull();
});
