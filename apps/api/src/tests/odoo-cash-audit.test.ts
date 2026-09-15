import { expect, test } from 'bun:test';
import { loadCashAudit } from '../connectors/odoo-cash-audit';

test('audit trésorerie : modèles fixes, lectures seules, toutes les contreparties paginées',async()=>{
 const calls:any[]=[];
 const read=async(model:string,method:string,args:unknown[],kwargs?:Record<string,unknown>)=>{
  calls.push({model,method,args,kwargs});
  if(method==='read_group')return [{company_id:[1,'Eurodrill'],journal_id:[8,'Bank'],debit:100,credit:0,balance:100}];
  if(model==='account.move')return [{id:5,date:'2026-01-01'}];
  if(model==='account.journal')return [{id:8,name:'Bank'}];
  const after=(args[0] as any[]).find(x=>x[0]==='id')[2];
  return after?[]:[{id:1,debit:100,credit:0},{id:2,debit:0,credit:100}];
 };
 const audit=await loadCashAudit(read,[434],[5],'2026-07-31');
 expect(audit.lines).toHaveLength(2);expect(audit.journals).toHaveLength(1);
 expect(calls.every(c=>['read','search_read','read_group'].includes(c.method))).toBe(true);
 for(const c of calls.filter(c=>c.model==='account.move.line'))expect(c.args[0]).toContainEqual(['parent_state','=','posted']);
 expect(calls.filter(c=>c.model==='account.move.line'&&c.method==='search_read')[0].args[0]).toContainEqual(['move_id','in',[5]]);
});
test('audit trésorerie : périmètre vide ou non borné refusé avant lecture',async()=>{
 let calls=0;const read=async()=>{calls++;return []};
 await expect(loadCashAudit(read,[],[1],'2026-07-31')).rejects.toThrow();
 await expect(loadCashAudit(read,[1],Array.from({length:101},(_,i)=>i+1),'2026-07-31')).rejects.toThrow();
 expect(calls).toBe(0);
});
