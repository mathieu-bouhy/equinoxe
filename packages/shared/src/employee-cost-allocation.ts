import type { AnalyticAllocationCode, EmployeeAnalyticAllocation } from './index';

export const allocationFields = [
  {key:'fireInstallation',label:'Incendie — installation'},
  {key:'fireMaintenance',label:'Incendie — maintenance'},
  {key:'intrusion',label:'Intrusion'},
  {key:'led',label:'LED'},
] as const;
export type AllocationDepartment=typeof allocationFields[number]['key'];
export type AllocationAmounts=Record<AllocationDepartment,number>;
const empty=():AllocationAmounts=>({fireInstallation:0,fireMaintenance:0,intrusion:0,led:0});
const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('fr-BE').trim();
export const isSalaryKey=(key:AnalyticAllocationCode)=>key.basis==='salary';
export const salaryKeyId=(companyId:string)=>`system:salary:${companyId}`;
export const vehicleKeyId=(companyId:string)=>`system:vehicle:${companyId}`;
export const isMonthlyCostKey=(key:AnalyticAllocationCode):key is AnalyticAllocationCode&{basis:'salary'|'vehicle'}=>key.basis==='salary'||key.basis==='vehicle';
/** Built-in computed key; no repeated seeding or rewriting of saved configurations. */
export function withCostAllocationKeys(keys:AnalyticAllocationCode[],companyId:string):AnalyticAllocationCode[]{
  return [...keys.filter(key=>key.companyId===companyId&&key.id!==salaryKeyId(companyId)&&key.id!==vehicleKeyId(companyId)),{
    id:salaryKeyId(companyId),companyId,label:'Salaire',basis:'salary',...empty(),order:keys.length,createdAt:'',updatedAt:'',
  },{
    id:vehicleKeyId(companyId),companyId,label:'Voiture',basis:'vehicle',...empty(),order:keys.length+1,createdAt:'',updatedAt:'',
  }];
}
export const isHeadcountKey=(key:AnalyticAllocationCode)=>{const label=normalized(key.label);return !isMonthlyCostKey(key)&&label.includes('nombre')&&label.includes('employe');};
export const employeePresent=(employee:EmployeeAnalyticAllocation,month:string)=>(!employee.entryDate||employee.entryDate.slice(0,7)<=month)&&(!employee.endDate||employee.endDate.slice(0,7)>=month);
const collator=new Intl.Collator('fr-BE',{sensitivity:'base',numeric:true});
export function sortEmployees(employees:EmployeeAnalyticAllocation[]){
  return [...employees].sort((a,b)=>Number(!a.function?.trim())-Number(!b.function?.trim())||collator.compare(a.function??'',b.function??'')||collator.compare(a.lastName,b.lastName)||collator.compare(a.firstName,b.firstName)||a.id.localeCompare(b.id));
}
export function effectiveAllocationKeys(keys:AnalyticAllocationCode[],employees:EmployeeAnalyticAllocation[]){
  const byId=new Map(keys.map(key=>[key.id,key])),counts=empty();let count=0;
  for(const employee of employees){const key=byId.get(employee.analyticAllocationCodeId??'');if(!key||isHeadcountKey(key)||isMonthlyCostKey(key))continue;count++;for(const field of allocationFields)counts[field.key]+=key[field.key]/100;}
  // Retain the existing headcount convention. Monthly cost keys never seed headcount.
  return keys.map(key=>isHeadcountKey(key)?{...key,...Object.fromEntries(allocationFields.map(field=>[field.key,count?counts[field.key]/count*100:25]))}:key);
}
export interface MonthlyEmployeeCost {month:string;activeCount:number;globalTotal:number;departmentTotals:AllocationAmounts;unallocated:number;shares:AllocationAmounts;unallocatedShare:number;missingCostCount:number;missingEntryCount:number}
export function monthlyEmployeeCost(employees:EmployeeAnalyticAllocation[],keys:AnalyticAllocationCode[],month:string,kind:'salary'|'vehicle'):MonthlyEmployeeCost{
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('Mois invalide.');
  const active=employees.filter(employee=>employeePresent(employee,month)),byId=new Map(effectiveAllocationKeys(keys,active).map(key=>[key.id,key]));
  const result:MonthlyEmployeeCost={month,activeCount:active.length,globalTotal:0,departmentTotals:empty(),unallocated:0,shares:empty(),unallocatedShare:1,missingCostCount:0,missingEntryCount:active.filter(employee=>!employee.entryDate).length};
  for(const employee of active){
    const annual=kind==='salary'?employee.annualSalaryCost:employee.annualCarCost;
    if(annual===null||!Number.isFinite(annual)){result.missingCostCount++;continue;}
    const cost=annual/12,key=byId.get(employee.analyticAllocationCodeId??'');result.globalTotal+=cost;
    const valid=key&&!isMonthlyCostKey(key)&&allocationFields.every(field=>Number.isFinite(key[field.key])&&key[field.key]>=0)&&Math.abs(allocationFields.reduce((sum,field)=>sum+key[field.key],0)-100)<.001;
    if(!valid){result.unallocated+=cost;continue;}
    for(const field of allocationFields)result.departmentTotals[field.key]+=cost*key[field.key]/100;
  }
  if(result.globalTotal>0&&allocationFields.every(field=>result.departmentTotals[field.key]>=0)&&result.unallocated>=0){
    for(const field of allocationFields)result.shares[field.key]=result.departmentTotals[field.key]/result.globalTotal;
    result.unallocatedShare=result.unallocated/result.globalTotal;
  }
  return result;
}
/** Reusable for any P&L account: first allocate actual monthly amounts, then sum. */
export function allocateAccountByMonthlyCost(amounts:Record<string,number>,employees:EmployeeAnalyticAllocation[],keys:AnalyticAllocationCode[],kind:'salary'|'vehicle'){
  const result:Record<string,AllocationAmounts&{other:number}>={};
  for(const [month,amount] of Object.entries(amounts)){
    if(!Number.isFinite(amount))throw new Error('Montant comptable invalide.');
    const cost=monthlyEmployeeCost(employees,keys,month,kind);
    // Use exactly the same known-cost denominator as the monthly table. Missing
    // costs are flagged there, never invented; no usable base leaves everything unallocated.
    const shares=cost.shares;
    const values=Object.fromEntries(allocationFields.map(field=>[field.key,amount*shares[field.key]])) as AllocationAmounts;
    result[month]={...values,other:amount-allocationFields.reduce((sum,field)=>sum+values[field.key],0)};
  }
  return result;
}
export const allocateAccountBySalary=(amounts:Record<string,number>,employees:EmployeeAnalyticAllocation[],keys:AnalyticAllocationCode[])=>allocateAccountByMonthlyCost(amounts,employees,keys,'salary');
