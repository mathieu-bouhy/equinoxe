import { expect,test } from 'bun:test';
import { loadTreasuryLedger } from '../connectors/odoo-treasury';
test('lecture bornée et paginée, société explicite, archives et lettrages postérieurs inclus',async()=>{
 const calls:Array<{model:string;method:string;args:unknown[];kwargs?:Record<string,unknown>}>=[];
 const read=async(model:string,method:string,args:unknown[],kwargs?:Record<string,unknown>)=>{
  calls.push({model,method,args,kwargs});
  if(method==='fields_get')return {company_ids:{type:'many2many'}};
  if(model==='account.account')return [{id:1,code:'400000',name:'Clients',account_type:'asset_receivable'},{id:2,code:'411800',name:'Impôts',account_type:'asset_receivable'}];
  if(model==='account.move.line'&&method==='search_read'){
   const domain=args[0] as any[];return domain.some(c=>Array.isArray(c)&&c[0]==='id'&&c[2]>0)?[]:[{id:1,date:'2026-10-01',date_maturity:false,balance:100,amount_residual:0,account_id:[1,'Clients'],partner_id:false,move_id:[1,'INV/1'],company_id:[5,'GIMI']}];
  }
  if(model==='account.move.line'&&method==='read_group')return [{account_id:[1,'Clients'],balance:0}];
  if(model==='res.company')return [{currency_id:[1,'EUR']}];
  if(model==='res.currency')return [{name:'EUR'}];
  if(model==='account.move')return [{id:1,name:'INV/1',ref:false,invoice_date:'2026-10-01',move_type:'out_invoice'}];
  if(model==='account.partial.reconcile'){const domain=args[0] as any[];return domain.some(c=>Array.isArray(c)&&c[0]==='id'&&c[2]>0)?[]:[{id:1,max_date:'2026-12-01',debit_move_id:[1,'INV/1'],credit_move_id:[2,'PAY/1'],amount:100}];}
  throw new Error('Unexpected read');
 };
 const ledger=await loadTreasuryLedger(read,'2026-11-16','2026-10-31','https://odoo.example',5);
 expect(ledger.accounts.map(a=>a.code)).toEqual(['400000']);expect(ledger.matches[0].date).toBe('2026-12-01');
 expect(calls.every(c=>['read','search_read','read_group','fields_get'].includes(c.method))).toBe(true);
 const lines=calls.find(c=>c.model==='account.move.line'&&c.method==='search_read')!;
 expect(JSON.stringify(lines.args)).toContain('["company_id","=",5]');expect(JSON.stringify(lines.args)).toContain('matched_debit_ids.max_date');expect(JSON.stringify(lines.args)).toContain('posted');
 expect((calls.find(c=>c.model==='account.account'&&c.method==='search_read')!.kwargs?.context as any).active_test).toBe(false);
 expect(calls.filter(c=>c.model==='account.move.line'&&c.method==='read_group')).toHaveLength(14);
});
