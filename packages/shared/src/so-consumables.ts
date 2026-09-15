export type FireDepartment='fireInstallation'|'fireMaintenance';
export interface SoConsumableAccount {id:string;code:string;keyId:string|null;department:FireDepartment|'other'|null;hasFire:boolean}
export interface SoInvoiceEvidence {lineId:number;invoiceId:number;reference:string;date:string;accountId:string;accountCode:string;department:FireDepartment|'other'|null}
export interface SoConsumableLine {id:number;productId:number;label:string;quantity:number;unitPrice:number;discount:number;unitPriceHt:number;amount:number;sourceAmount?:number;tracked:boolean}
export interface SoConsumableOrder {
  id:number;reference:string;date:string;year:number;currency:string;
  department:FireDepartment|null;status:'allocated'|'ambiguous'|'currency';
  amount:number;lines:SoConsumableLine[];invoices:SoInvoiceEvidence[];
}
export interface SoConsumablesSnapshot {
  version:1;companyId:string;from:'2023-01-01';through:string;startedAt:string;importedAt:string;
  accounts:SoConsumableAccount[];orders:SoConsumableOrder[];unlinkedInvoiceLines:number;
}
export function soConsumablesYears(snapshot:SoConsumablesSnapshot){
  return [2023,2024,2025,2026].map(year=>{
    const known=`${year}-01-01`<=snapshot.through,orders=snapshot.orders.filter(row=>row.year===year);
    const installation=orders.filter(row=>row.department==='fireInstallation').reduce((s,r)=>s+r.amount,0);
    const maintenance=orders.filter(row=>row.department==='fireMaintenance').reduce((s,r)=>s+r.amount,0);
    const total=installation+maintenance;
    return {year,installation:known?installation:null,maintenance:known?maintenance:null,
      installationShare:known&&total!==0?installation/total:null,maintenanceShare:known&&total!==0?maintenance/total:null,
      excluded:orders.filter(row=>!row.department).length};
  });
}
