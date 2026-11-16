type Read=(model:string,method:string,args:unknown[],kwargs?:Record<string,unknown>)=>Promise<unknown>;
type Rel=[number,string]|false;
export interface PartnerGroup {partner_id:Rel;balance?:number;amount_untaxed_signed?:number;__count?:number}
export interface RankingPartner {id:number;name:string;commercial_partner_id:Rel}
export interface PartnerRankingSource {from:string;through:string;baseUrl:string;clients:PartnerGroup[];suppliers:PartnerGroup[];clientControl:number;supplierControl:number;partners:RankingPartner[]}
export async function loadPartnerRankingSource(read:Read,from:string,through:string,accountIds:number[],companyId:number,baseUrl:string):Promise<PartnerRankingSource>{
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(from)||!/^20\d{2}-\d{2}-\d{2}$/.test(through)||from>through||!accountIds.length||accountIds.length>1000||accountIds.some(id=>!Number.isSafeInteger(id)||id<=0))throw Error('Périmètre des classements invalide.');
 const context={allowed_company_ids:[companyId],active_test:false};
 const clientDomain=[['company_id','=',companyId],['parent_state','=','posted'],['date','>=',from],['date','<=',through],['account_id','in',accountIds]];
 const supplierDomain=[['company_id','=',companyId],['state','=','posted'],['date','>=',from],['date','<=',through],['move_type','in',['in_invoice','in_refund']]];
 const grouped=async(model:string,domain:unknown[],field:string)=>{const rows:PartnerGroup[]=[];let offset=0;for(;;){const page=await read(model,'read_group',[domain,[field],['partner_id']],{lazy:false,offset,limit:1000,orderby:'partner_id',context}) as PartnerGroup[];if(!page.length)break;rows.push(...page);offset+=page.length;if(rows.length>100000)throw Error('Volume de tiers trop important, aucun classement partiel affiché.');if(page.length<1000)break;}return rows;};
 const [clients,suppliers,clientTotal,supplierTotal]=await Promise.all([
  grouped('account.move.line',clientDomain,'balance'),grouped('account.move',supplierDomain,'amount_untaxed_signed'),
  read('account.move.line','read_group',[clientDomain,['balance'],[]],{lazy:false,context}) as Promise<PartnerGroup[]>,
  read('account.move','read_group',[supplierDomain,['amount_untaxed_signed'],[]],{lazy:false,context}) as Promise<PartnerGroup[]>,
 ]);
 const control=(rows:PartnerGroup[],field:'balance'|'amount_untaxed_signed')=>{if(rows.some(row=>!Number.isFinite(row[field])))throw Error('Montants de classement incomplets.');return rows.reduce((s,row)=>s+(row[field]??0),0);};
 const clientControl=control(clientTotal,'balance'),supplierControl=control(supplierTotal,'amount_untaxed_signed');
 if(Math.abs(control(clients,'balance')-clientControl)>.011||Math.abs(control(suppliers,'amount_untaxed_signed')-supplierControl)>.011)throw Error('Les tiers ne rejoignent pas les contrôles comptables.');
 const ids=[...new Set([...clients,...suppliers].flatMap(g=>g.partner_id?[g.partner_id[0]]:[]))],partners:RankingPartner[]=[];
 for(let index=0;index<ids.length;index+=500){partners.push(...await read('res.partner','read',[ids.slice(index,index+500)],{fields:['name','commercial_partner_id'],context}) as RankingPartner[]);}
 if(ids.some(id=>!partners.some(p=>p.id===id)))throw Error('Un tiers du classement est indisponible.');
 return {from,through,baseUrl,clients,suppliers,clientControl,supplierControl,partners};
}
