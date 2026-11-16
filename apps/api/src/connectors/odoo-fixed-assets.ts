type Read=(model:string,method:string,args:unknown[],kwargs?:Record<string,unknown>)=>Promise<unknown>;
export type AssetRelation=[number,string]|false;
export interface FixedAssetAccount{id:number;code:string;name:string}
export interface FixedAssetRecord{id:number;name:string;state:string;account_asset_id:AssetRelation;account_depreciation_id:AssetRelation;original_value:number;acquisition_date:string|false;disposal_date:string|false;original_move_line_ids:number[];already_depreciated_amount_import:number;salvage_value:number}
export interface FixedAssetEntry{id:number;date:string;name:string|false;account_id:AssetRelation;move_id:AssetRelation;debit:number;credit:number}
export interface FixedAssetMove{id:number;date:string;name:string;ref:string|false;move_type:string;asset_id:AssetRelation;asset_move_type:string|false;depreciation_value:number}
export interface FixedAssetLedger{from:string;through:string;accounts:FixedAssetAccount[];assets:FixedAssetRecord[];entries:FixedAssetEntry[];moves:FixedAssetMove[];baseUrl:string}
/** Fixed models and read methods only. Posted ledger is the accounting source;
 * the asset register supplies names/statuses, not today's book value as a historic value. */
export async function loadFixedAssetLedger(read:Read,from:string,through:string,baseUrl:string,companyId:number):Promise<FixedAssetLedger>{
 if(!/^20\d{2}-01-01$/.test(from)||!/^20\d{2}-\d{2}-\d{2}$/.test(through)||from>through)throw Error('Période des immobilisations invalide.');
 const context={active_test:false,allowed_company_ids:[companyId]};
 const accounts=(await read('account.account','search_read',[['|',['code','=like','2%'],['code','=like','630%']]],{fields:['code','name'],context,order:'code'}) as FixedAssetAccount[]).filter(account=>/^(2[1-7]|630)\d+$/.test(account.code));
 const assets:FixedAssetRecord[]=[],entries:FixedAssetEntry[]=[],moves:FixedAssetMove[]=[];
 for(const kind of ['assets','entries'] as const){let after=0;while(true){
  const model=kind==='assets'?'account.asset':'account.move.line',domain:unknown[]=kind==='assets'?[['company_id','=',companyId],['state','!=','model'],'|',['acquisition_date','<=',through],['acquisition_date','=',false]]:[['company_id','=',companyId],['parent_state','=','posted'],['account_id','in',accounts.map(a=>a.id)],['date','>=',from],['date','<=',through]];
  const fields=kind==='assets'?['name','state','account_asset_id','account_depreciation_id','original_value','acquisition_date','disposal_date','original_move_line_ids','already_depreciated_amount_import','salvage_value']:['date','name','account_id','move_id','debit','credit'];
  const page=await read(model,'search_read',[[...domain,['id','>',after]]],{fields,context,limit:500,order:'id asc'}) as Array<{id:number}>;
  if(!page.length)break;if(page.some(row=>!Number.isSafeInteger(row.id)||row.id<=after))throw Error('Pagination des immobilisations incohérente.');after=page.at(-1)!.id;
  if(kind==='assets')assets.push(...page as FixedAssetRecord[]);else entries.push(...page as FixedAssetEntry[]);
 }}
 const moveIds=[...new Set(entries.flatMap(entry=>entry.move_id?[(entry.move_id as [number,string])[0]]:[]))];
 for(let index=0;index<moveIds.length;index+=300){moves.push(...await read('account.move','search_read',[[['id','in',moveIds.slice(index,index+300)],['state','=','posted'],['date','<=',through],['company_id','=',companyId]]],{fields:['date','name','ref','move_type','asset_id','asset_move_type','depreciation_value'],context,limit:300,order:'id asc'}) as FixedAssetMove[]);}
 if(entries.some(entry=>!Number.isFinite(entry.debit)||!Number.isFinite(entry.credit)||!entry.move_id||!moves.some(move=>move.id===(entry.move_id as [number,string])[0])))throw Error('Écritures des immobilisations incomplètes.');
 return {from,through,accounts,assets,entries,moves,baseUrl};
}
