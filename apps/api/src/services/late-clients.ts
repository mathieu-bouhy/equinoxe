import type { AgedInvoice } from '@equinoxe/shared';
export interface LateClient {partnerId:number|null;partner:string;over90:number;days61to90:number;over60:number;oldestDueDate:string|null;invoiceCount:number}
/** Signed trade invoice/credit balances only. Never offset unallocated bank payments. */
export function lateClientFollowup(rows:AgedInvoice[]):LateClient[]{
 const partners=new Map<string,LateClient>();
 for(const row of rows){
  if(!['invoice','credit'].includes(row.kind)||(row.daysLate??0)<=60)continue;
  const key=String(row.partnerId??'unknown'),p=partners.get(key)??{partnerId:row.partnerId,partner:row.partner,over90:0,days61to90:0,over60:0,oldestDueDate:null,invoiceCount:0};
  if(row.daysLate!>90)p.over90+=row.residual;else p.days61to90+=row.residual;
  p.over60+=row.residual;
  if(row.residual>0&&row.kind==='invoice'){p.invoiceCount++;if(row.dueDate&&(!p.oldestDueDate||row.dueDate<p.oldestDueDate))p.oldestDueDate=row.dueDate;}
  partners.set(key,p);
 }
 return [...partners.values()].filter(p=>p.over60>.005||p.over90>.005).sort((a,b)=>b.over90-a.over90||b.over60-a.over60);
}
