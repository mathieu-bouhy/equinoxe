import {expect,test} from 'bun:test';import {loadFixedAssetLedger} from '../connectors/odoo-fixed-assets';
test('immobilisations : modèles fixes, société bornée et écritures validées paginées',async()=>{
 const calls:any[]=[];const read=async(model:string,method:string,args:any[],kwargs:any)=>{calls.push({model,method,args,kwargs});if(model==='account.account')return [{id:7,code:'241000',name:'Véhicules'}];if(model==='account.asset')return [];if(model==='account.move')return [{id:3,date:'2026-01-01',move_type:'in_invoice'}];const after=args[0].find((x:any)=>Array.isArray(x)&&x[0]==='id')[2];return after?[]:[{id:5,date:'2026-01-01',account_id:[7,'Véhicules'],move_id:[3,'Achat'],debit:100,credit:0}];};
 const r=await loadFixedAssetLedger(read,'2024-01-01','2026-10-31','https://odoo.example.test',1);expect(r.entries).toHaveLength(1);expect(calls.every(c=>c.method==='search_read')).toBe(true);
 for(const c of calls.filter(c=>c.model==='account.move.line')){expect(c.args[0]).toContainEqual(['parent_state','=','posted']);expect(c.args[0]).toContainEqual(['company_id','=',1]);expect(c.args[0]).toContainEqual(['date','<=','2026-10-31']);expect(c.kwargs.context.allowed_company_ids).toEqual([1]);}
 expect(calls.filter(c=>c.model==='account.move.line')).toHaveLength(2);
});
