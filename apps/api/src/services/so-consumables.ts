import { allocationFields, effectiveAllocationKeys, isMonthlyCostKey } from '@equinoxe/shared';
import type { AccountAnalyticAllocation, AnalyticAllocationCode, EmployeeAnalyticAllocation, SoConsumableAccount, SoConsumableOrder, SoConsumablesSnapshot } from '@equinoxe/shared';

export class SoConsumablesError extends Error {}
/** Odoo datetimes are UTC; the order's calendar year is displayed in Brussels. */
export function soOrderDate(value:string){
  if(!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value))throw new SoConsumablesError('Date de commande absente ou invalide.');
  const date=new Date(value.replace(' ','T')+'Z');
  if(!Number.isFinite(date.getTime()))throw new SoConsumablesError('Date de commande invalide.');
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
  return ['year','month','day'].map(type=>parts.find(p=>p.type===type)!.value).join('-');
}
export function consumableAccountMap(accounts:Array<{id:string;code:string}>,assignments:AccountAnalyticAllocation[],keys:AnalyticAllocationCode[],employees:EmployeeAnalyticAllocation[]):SoConsumableAccount[]{
  const resolved=new Map(effectiveAllocationKeys(keys,employees).map(row=>[row.id,row]));
  return accounts.map(account=>{
    const assignment=assignments.find(row=>row.odooAccountId===account.id)??assignments.find(row=>row.accountCode===account.code),key=resolved.get(assignment?.analyticAllocationCodeId??'');
    const valid=key&&!isMonthlyCostKey(key)&&allocationFields.every(f=>Number.isFinite(key[f.key])&&key[f.key]>=0)&&Math.abs(allocationFields.reduce((s,f)=>s+key[f.key],0)-100)<.001;
    const hasFire=Boolean(key&&(key.fireInstallation>0||key.fireMaintenance>0));
    const department=valid?(key.fireInstallation===100?'fireInstallation':key.fireMaintenance===100?'fireMaintenance':!hasFire?'other':null):null;
    return {...account,keyId:key?.id??null,department,hasFire};
  });
}
export function classifyConsumableOrder(invoices:SoConsumableOrder['invoices'],currency:string):Pick<SoConsumableOrder,'department'|'status'>{
  if(currency!=='EUR')return {department:null,status:'currency'};
  const departments=new Set(invoices.map(row=>row.department));
  const first=invoices[0]?.department;
  return departments.size===1&&(first==='fireInstallation'||first==='fireMaintenance')?{department:first,status:'allocated'}:{department:null,status:'ambiguous'};
}
export function validateSoConsumables(snapshot:SoConsumablesSnapshot){
  const orderIds=new Set<number>(),lineIds=new Set<number>(),accounts=new Map(snapshot.accounts.map(row=>[row.id,row]));
  if(accounts.size!==snapshot.accounts.length)throw new SoConsumablesError('Comptes sources dupliqués.');
  for(const order of snapshot.orders){
    if(orderIds.has(order.id)||order.date<snapshot.from||order.date>snapshot.through||Number(order.date.slice(0,4))!==order.year||!order.invoices.length)throw new SoConsumablesError('SO dupliqué ou période incohérente.');
    orderIds.add(order.id);
    const evidence=new Set<number>();
    for(const invoice of order.invoices){
      const account=accounts.get(invoice.accountId);
      if(evidence.has(invoice.lineId)||!account||invoice.accountCode!==account.code||invoice.department!==account.department||invoice.date>snapshot.through||invoice.date<snapshot.from)throw new SoConsumablesError('Lien facture–compte incohérent.');
      evidence.add(invoice.lineId);
    }
    if(!order.invoices.some(row=>accounts.get(row.accountId)?.hasFire))throw new SoConsumablesError('SO hors périmètre incendie.');
    const expected=classifyConsumableOrder(order.invoices,order.currency);
    if(expected.department!==order.department||expected.status!==order.status)throw new SoConsumablesError('Département du SO incohérent.');
    let amount=0;
    for(const line of order.lines){
      if(lineIds.has(line.id))throw new SoConsumablesError(`Ligne SO dupliquée : ${line.id}.`);
      if(line.sourceAmount!==undefined&&!Number.isFinite(line.sourceAmount))throw new SoConsumablesError('Sous-total Odoo invalide.');
      if(![line.quantity,line.unitPrice,line.discount,line.unitPriceHt,line.amount].every(Number.isFinite)||Math.abs(line.quantity*line.unitPriceHt-line.amount)>.011)throw new SoConsumablesError(`Montant HT de ligne incohérent : ${line.id} (${line.quantity} × ${line.unitPriceHt} ≠ ${line.amount}).`);
      lineIds.add(line.id);amount+=line.amount;
    }
    if(!Number.isFinite(order.amount)||Math.abs(amount-order.amount)>.001)throw new SoConsumablesError('Le total du SO ne correspond pas aux produits consommables.');
  }
}
