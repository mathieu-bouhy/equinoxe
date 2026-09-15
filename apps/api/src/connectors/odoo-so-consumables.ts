import type { SoConsumableAccount, SoConsumableLine, SoConsumableOrder, SoConsumablesSnapshot, SoInvoiceEvidence } from '@equinoxe/shared';
import { classifyConsumableOrder, SoConsumablesError, soOrderDate, validateSoConsumables } from '../services/so-consumables';

type Row={id:number;[key:string]:unknown};
type ReadCall=(model:string,method:string,args:unknown[],kwargs?:Record<string,unknown>)=>Promise<unknown>;
const rel=(v:unknown):number|null=>Array.isArray(v)&&typeof v[0]==='number'?v[0]:null;
const ids=(v:unknown):number[]=>Array.isArray(v)?v.filter((id):id is number=>typeof id==='number'):[];
const text=(v:unknown)=>typeof v==='string'?v:'';
const unique=(v:Array<number|null>)=>[...new Set(v.filter((id):id is number=>id!==null))];

/** Uses only the existing Odoo read-only gateway. Product type, not Gimi Type. */
export async function loadSoConsumables(call:ReadCall,companyId:string,through:string,accounts:SoConsumableAccount[]):Promise<SoConsumablesSnapshot>{
  if(!/^202[3-6]-(0[1-9]|1[0-2])-\d{2}$/.test(through))throw new SoConsumablesError('Période invalide : 2023 à 2026.');
  const startedAt=new Date().toISOString(),from='2023-01-01' as const;
  if(!accounts.some(a=>a.hasFire))throw new SoConsumablesError('Aucun compte de chiffre d’affaires affecté aux départements incendie.');
  async function read(model:string,identifiers:number[],fields:string[]){
    const result=new Map<number,Row>(),values=unique(identifiers);
    for(let i=0;i<values.length;i+=300){
      const batch=values.slice(i,i+300),rows=await call(model,'read',[batch],{fields,context:{active_test:false}}) as Row[];
      if(rows.length!==batch.length||new Set(rows.map(r=>r.id)).size!==rows.length||rows.some(r=>!batch.includes(r.id)))throw new SoConsumablesError(`Lecture incomplète : ${model}.`);
      for(const row of rows)result.set(row.id,row);
    }
    return result;
  }
  const ledger:Row[]=[];let after=0;
  const domain=[['parent_state','=','posted'],['move_id.move_type','=','out_invoice'],['account_id','in',accounts.map(a=>Number(a.id))],['date','>=',from],['date','<=',through]];
  const expected=await call('account.move.line','search_count',[domain]) as number;
  while(true){
    const rows=await call('account.move.line','search_read',[[...domain,['id','>',after]]],{fields:['date','move_id','account_id','sale_line_ids'],limit:1000,order:'id asc'}) as Row[];
    if(!rows.length)break;
    for(const row of rows){if(row.id<=after)throw new SoConsumablesError('Pagination incohérente.');after=row.id;ledger.push(row);}
  }
  if(ledger.length!==expected)throw new SoConsumablesError('Les factures ont changé pendant la lecture. Relancez le calcul.');
  const byAccount=new Map(accounts.map(a=>[a.id,a]));
  const linkedLines=await read('sale.order.line',unique(ledger.flatMap(row=>ids(row.sale_line_ids))),['order_id']);
  const evidence=new Map<number,Map<number,SoInvoiceEvidence>>();let unlinkedInvoiceLines=0;
  for(const row of ledger){
    const account=byAccount.get(String(rel(row.account_id)));if(!account)throw new SoConsumablesError('Compte source inconnu.');
    const linked=unique(ids(row.sale_line_ids).map(id=>rel(linkedLines.get(id)?.order_id)));
    if(!linked.length&&account.hasFire)unlinkedInvoiceLines++;
    const invoiceId=rel(row.move_id);if(!invoiceId)throw new SoConsumablesError('Facture source absente.');
    for(const id of linked){const rows=evidence.get(id)??new Map<number,SoInvoiceEvidence>();rows.set(row.id,{lineId:row.id,invoiceId,reference:Array.isArray(row.move_id)?text(row.move_id[1]):'',date:text(row.date),accountId:account.id,accountCode:account.code,department:account.department});evidence.set(id,rows);}
  }
  const candidates=[...evidence].filter(([,rows])=>[...rows.values()].some(row=>byAccount.get(row.accountId)?.hasFire)).map(([id])=>id);
  const allOrders=await read('sale.order',candidates,['name','date_order','state','order_line','currency_id']);
  const orders=[...allOrders.values()].filter(row=>row.state==='sale'&&soOrderDate(text(row.date_order))>=from&&soOrderDate(text(row.date_order))<=through);
  const lines=await read('sale.order.line',unique(orders.flatMap(row=>ids(row.order_line))),['order_id','product_id','name','product_uom_qty','price_unit','discount','price_subtotal','is_downpayment','display_type','tax_id']);
  const products=await read('product.product',unique([...lines.values()].map(row=>rel(row.product_id))),['type','is_storable']);
  const currencies=await read('res.currency',unique(orders.map(row=>rel(row.currency_id))),['name']);
  const taxes=new Map<number,Row>();let taxIds=unique([...lines.values()].flatMap(row=>ids(row.tax_id)));
  for(let depth=0;taxIds.length;depth++){
    if(depth>20)throw new SoConsumablesError('Structure de taxes trop complexe.');
    const batch=await read('account.tax',taxIds,['price_include','children_tax_ids']);
    for(const [id,tax] of batch)taxes.set(id,tax);
    taxIds=unique([...batch.values()].flatMap(row=>ids(row.children_tax_ids))).filter(id=>!taxes.has(id));
  }
  const taxIncluded=(identifiers:number[],seen=new Set<number>()):boolean=>identifiers.some(id=>{
    if(seen.has(id))return false;seen.add(id);const tax=taxes.get(id);
    if(!tax||typeof tax.price_include!=='boolean')throw new SoConsumablesError('Règle de taxe absente.');
    return tax.price_include||taxIncluded(ids(tax.children_tax_ids),seen);
  });
  const result:SoConsumableOrder[]=orders.map(order=>{
    const retained:SoConsumableLine[]=[];
    for(const id of ids(order.order_line)){
      const line=lines.get(id)!;
      if(rel(line.order_id)!==order.id)throw new SoConsumablesError('Ligne rattachée à un autre SO.');
      if(line.display_type||line.is_downpayment)continue;
      const productId=rel(line.product_id);if(!productId)continue;
      const product=products.get(productId)!;
      if(!['consu','service','combo'].includes(text(product.type)))throw new SoConsumablesError('Type de produit inconnu.');
      if(product.type!=='consu')continue;
      const number=(key:string)=>{const value=line[key];if(typeof value!=='number'||!Number.isFinite(value))throw new SoConsumablesError(`Montant ou quantité manquant : ${key}.`);return value;};
      const quantity=number('product_uom_qty'),unitPrice=number('price_unit'),discount=number('discount'),sourceAmount=number('price_subtotal');
      // price_reduce_taxexcl is a monetary field rounded to cents in this Odoo.
      // Use the unrounded discounted price; for tax-inclusive pricing Odoo's
      // authoritative tax-exclusive subtotal supplies the net unit value.
      const includesTax=taxIncluded(ids(line.tax_id));
      const unitPriceHt=includesTax?(quantity?sourceAmount/quantity:0):unitPrice*(1-discount/100);
      const rawAmount=quantity*unitPriceHt;
      const amount=Math.sign(rawAmount)*Math.round((Math.abs(rawAmount)+Number.EPSILON)*100)/100;
      retained.push({id,productId,label:text(line.name),quantity,unitPrice,discount,unitPriceHt,amount,sourceAmount,tracked:product.is_storable===true});
    }
    const invoices=[...evidence.get(order.id)!.values()].sort((a,b)=>a.lineId-b.lineId),currency=text(currencies.get(rel(order.currency_id)??0)?.name);
    if(!currency)throw new SoConsumablesError('Devise du SO absente.');
    const date=soOrderDate(text(order.date_order));
    return {id:order.id,reference:text(order.name),date,year:Number(date.slice(0,4)),currency,...classifyConsumableOrder(invoices,currency),amount:retained.reduce((s,line)=>s+line.amount,0),lines:retained,invoices};
  });
  const snapshot:SoConsumablesSnapshot={version:1,companyId,from,through,startedAt,importedAt:new Date().toISOString(),accounts,orders:result.sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id),unlinkedInvoiceLines};
  validateSoConsumables(snapshot);return snapshot;
}
