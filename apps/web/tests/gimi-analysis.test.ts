import { expect,test } from 'bun:test';
import { analysisRows,accountMovements,managementFees } from '../src/services/gimi-analysis';
import { payrollSummary,payrollDepartments } from '../src/services/gimi-payroll';
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
