import type { TreasuryLedger } from '../services/aged-balance';
import { treasuryMonthEnds, validTreasuryDate } from '../services/aged-balance';
type Reader=(model:string,method:string,args:unknown[],kwargs?:Record<string,unknown>)=>Promise<unknown>;
type Rel=[number,string]|false;

/** Fixed models/methods only; invoked through OdooConnector's read-only gateway. */
export async function loadTreasuryLedger(read:Reader,through:string,closedThrough:string,baseUrl:string,companyId:number):Promise<TreasuryLedger>{
  if(!validTreasuryDate(through)||!validTreasuryDate(closedThrough)||closedThrough>through)throw new Error('Période de trésorerie invalide.');
  const metadata=await read('account.account','fields_get',[['company_ids','company_id']],{attributes:['type']}) as Record<string,unknown>;
  const companyField=metadata.company_ids?'company_ids':metadata.company_id?'company_id':null;
  if(!companyField)throw new Error('Périmètre société des comptes indisponible.');
  const raw=await read('account.account','search_read',[[[companyField,'in',[companyId]],['account_type','in',['asset_receivable','liability_payable']]]],{fields:['code','name','account_type'],order:'id asc',context:{active_test:false}}) as Array<{id:number;code:string;name:string;account_type:string}>;
  if(!raw.length||raw.length>1000)throw new Error('Comptes clients/fournisseurs absents ou incohérents.');
  const invalid=raw.filter(a=>typeof a.code!=='string'||!/^\d+$/.test(a.code));
  if(invalid.length){const count=await read('account.move.line','search_count',[[['account_id','in',invalid.map(a=>a.id)],['parent_state','=','posted'],['date','<=',through]]]);if(count!==0)throw new Error('Des écritures GIMI utilisent un compte sans numéro valide.');}
  const accounts:TreasuryLedger['accounts']=raw.filter(a=>!invalid.includes(a)&&(a.account_type==='asset_receivable'?a.code.startsWith('40'):a.code.startsWith('44'))).map(a=>({id:a.id,code:a.code,name:a.name,side:a.account_type==='asset_receivable'?'clients':'fournisseurs'}));
  const ids=accounts.map(a=>a.id),earliest=treasuryMonthEnds(closedThrough)[0];
  if(!ids.length)throw new Error('Comptes commerciaux clients/fournisseurs absents.');
  const paginate=async <T extends {id:number}>(model:string,domain:unknown[],fields:string[],max=250000):Promise<T[]>=>{
    const result:T[]=[];let after=0;
    for(;;){
      const page=await read(model,'search_read',[[...domain,['id','>',after]]],{fields,order:'id asc',limit:5000}) as T[];
      if(!page.length)break;
      for(const row of page){if(!Number.isSafeInteger(row.id)||row.id<=after)throw new Error('Pagination Odoo incohérente.');after=row.id;result.push(row);}
      if(result.length>max)throw new Error('Volume Odoo trop important : aucune donnée partielle n’est affichée.');
    }
    return result;
  };
  type Line={id:number;date:string;date_maturity:string|false;balance:number;amount_residual:number;account_id:Rel;partner_id:Rel;move_id:Rel;company_id:Rel};
  const lines=await paginate<Line>('account.move.line',[['company_id','=',companyId],['parent_state','=','posted'],['account_id','in',ids],['date','<=',through],'|','|',['amount_residual','!=',0],['matched_debit_ids.max_date','>=',earliest],['matched_credit_ids.max_date','>=',earliest]],['date','date_maturity','balance','amount_residual','account_id','partner_id','move_id','company_id']);
  if(lines.some(l=>!l.account_id||!l.move_id||!l.company_id||!validTreasuryDate(l.date)||!Number.isFinite(l.balance)||!Number.isFinite(l.amount_residual)||l.date_maturity&&!validTreasuryDate(l.date_maturity)))throw new Error('Écritures clients/fournisseurs incomplètes.');
  const companyIds=[...new Set(lines.map(l=>(l.company_id as [number,string])[0]))];
  if(companyIds.some(id=>id!==companyId))throw new Error('Plusieurs sociétés Odoo détectées : un périmètre société explicite est nécessaire.');
  if(companyIds.length){
    const companies=await read('res.company','read',[companyIds],{fields:['currency_id']}) as Array<{currency_id:Rel}>;
    const currencyIds=companies.flatMap(c=>c.currency_id?[c.currency_id[0]]:[]);
    const currencies=await read('res.currency','read',[currencyIds],{fields:['name']}) as Array<{name:string}>;
    if(currencies.length!==1||currencies[0].name!=='EUR')throw new Error('La devise comptable doit être EUR.');
  }
  type Move={id:number;name:string;ref:string|false;invoice_date:string|false;move_type:string};
  const moveIds=[...new Set(lines.map(l=>(l.move_id as [number,string])[0]))],moves:Move[]=[];
  for(let i=0;i<moveIds.length;i+=5000)moves.push(...await read('account.move','read',[moveIds.slice(i,i+5000)],{fields:['name','ref','invoice_date','move_type']}) as Move[]);
  if(moves.length!==moveIds.length)throw new Error('Détail des pièces comptables incomplet.');
  type Match={id:number;max_date:string;debit_move_id:Rel;credit_move_id:Rel;amount:number};
  const matches=await paginate<Match>('account.partial.reconcile',[['max_date','>=',earliest],'|',['debit_move_id.account_id','in',ids],['credit_move_id.account_id','in',ids]],['max_date','debit_move_id','credit_move_id','amount']);
  if(matches.some(m=>!validTreasuryDate(m.max_date)||!m.debit_move_id||!m.credit_move_id||!Number.isFinite(m.amount)||m.amount<0))throw new Error('Lettrages incomplets.');
  const controls:TreasuryLedger['controls']=[];
  for(const date of [...new Set([...treasuryMonthEnds(closedThrough),through,closedThrough])]){
    const groups=await read('account.move.line','read_group',[[['company_id','=',companyId],['parent_state','=','posted'],['account_id','in',ids],['date','<=',date]],['balance'],['account_id']],{lazy:false}) as Array<{account_id:Rel;balance:number}>;
    if(groups.some(g=>!g.account_id||!Number.isFinite(g.balance)))throw new Error('Contrôle de balance indisponible.');
    for(const accountId of ids)controls.push({date,accountId,balance:groups.find(g=>g.account_id&&g.account_id[0]===accountId)?.balance??0});
  }
  return {through,readAt:new Date().toISOString(),baseUrl,accounts,
    lines:lines.map(l=>({id:l.id,date:l.date,dueDate:l.date_maturity||null,balance:l.balance,residual:l.amount_residual,accountId:(l.account_id as [number,string])[0],partnerId:l.partner_id?l.partner_id[0]:null,partner:l.partner_id?l.partner_id[1]:'Tiers non renseigné',moveId:(l.move_id as [number,string])[0]})),
    moves:moves.map(m=>({id:m.id,name:m.name,ref:m.ref||'',invoiceDate:m.invoice_date||null,type:m.move_type})),
    matches:matches.map(m=>({id:m.id,date:m.max_date,debitId:(m.debit_move_id as [number,string])[0],creditId:(m.credit_move_id as [number,string])[0],amount:m.amount})),controls};
}
