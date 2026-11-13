import { expect,test } from 'bun:test';
import { analysisRows,accountMovements } from '../src/services/gimi-analysis';
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
