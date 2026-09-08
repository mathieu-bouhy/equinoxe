import { allocationFields, effectiveAllocationKeys, isMonthlyCostKey, monthlyEmployeeCost } from '@equinoxe/shared';
import type { AccountAnalyticAllocation, AccountMonthlyAmounts, AllocationDepartment, AnalyticAccount, AnalyticAllocationCode, AnalyticLine, AnalyticPeriod, AnalyticProfitLossReport, AnalyticReportMode, EmployeeAnalyticAllocation, ProfitLossLine, ProfitLossSection, ProfitLossSubsection } from '@equinoxe/shared';
import { accountSection } from './analytic-allocation';

export class AnalyticReportError extends Error {}
export function analyticPeriods(mode:AnalyticReportMode,closed:string):AnalyticPeriod[]{
  if(!/^20\d{2}-(0[1-9]|1[0-2])$/.test(closed)||closed<'2024-01')throw new AnalyticReportError('Mois clôturé invalide (à partir de 2024).');
  const [year,month]=closed.split('-').map(Number);
  return [2,1,0].map(offset=>{
    const end=new Date(Date.UTC(year-offset,mode==='ltm'||offset===0?month:12,0));
    const start=new Date(Date.UTC(year-offset,mode==='ltm'?month-12:0,1));
    const months:string[]=[];
    for(let cursor=new Date(start);cursor<=end;cursor.setUTCMonth(cursor.getUTCMonth()+1))months.push(cursor.toISOString().slice(0,7));
    return {key:mode==='ltm'?`ltm-${offset*12}`:String(year-offset),label:mode==='ltm'?`${months[0]} → ${months.at(-1)}`:String(year-offset),start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10),months,factor:mode==='extrapolated'&&offset===0?12/month:1};
  });
}
export interface AllocationContext { assignments:AccountAnalyticAllocation[]; keys:AnalyticAllocationCode[]; employees:EmployeeAnalyticAllocation[] }
/** No employee records or costs leave the server. Both reports and ledger detail use this resolver. */
export function accountShareResolver(context:AllocationContext,selected:AllocationDepartment[]){
  const keys=new Map(context.keys.map(key=>[key.id,key]));
  const byId=new Map(context.assignments.map(row=>[row.odooAccountId,row])),byCode=new Map(context.assignments.map(row=>[row.accountCode,row]));
  const monthly=new Map<string,ReturnType<typeof monthlyEmployeeCost>>();
  const fixed=new Map(effectiveAllocationKeys(context.keys,context.employees).map(key=>[key.id,key]));
  const warnings=new Set<string>();
  return {warnings,resolve(id:string,code:string,month:string){
    const assignment=byId.get(id)??byCode.get(code),key=keys.get(assignment?.analyticAllocationCodeId??'');
    if(!key)return {share:0,unallocated:1,label:'Non affecté'};
    if(isMonthlyCostKey(key)){
      const cacheKey=`${key.basis}:${month}`;
      if(!monthly.has(cacheKey))monthly.set(cacheKey,monthlyEmployeeCost(context.employees,context.keys,month,key.basis));
      const cost=monthly.get(cacheKey)!;
      if(cost.missingCostCount)warnings.add(`Clé ${key.label} : des coûts sont absents ; seule la base connue est utilisée.`);
      if(cost.missingEntryCount)warnings.add('Certaines dates d’entrée sont absentes : présence supposée avant la date de fin éventuelle.');
      if(cost.globalTotal<=0)warnings.add(`Clé ${key.label} : sans base utilisable pour certains mois, les montants restent non répartis.`);
      return {share:selected.reduce((sum,field)=>sum+cost.shares[field],0),unallocated:cost.unallocatedShare,label:key.label};
    }
    const resolved=fixed.get(key.id)!;
    if(allocationFields.some(({key:field})=>!Number.isFinite(resolved[field])||resolved[field]<0)||Math.abs(allocationFields.reduce((s,{key:field})=>s+resolved[field],0)-100)>.001){
      warnings.add(`Clé ${key.label} invalide : montants non répartis.`);return {share:0,unallocated:1,label:key.label};
    }
    return {share:selected.reduce((sum,field)=>sum+resolved[field]/100,0),unallocated:0,label:key.label};
  }};
}
const sum=(rows:AnalyticAccount[],keys:string[],field:'values'|'monthlyValues')=>Object.fromEntries(keys.map(key=>[key,rows.reduce((s,row)=>s+(row[field][key]??0),0)]));

export function buildAnalyticProfitLoss(input:AllocationContext&{
  mode:AnalyticReportMode;closed:string;selected:AllocationDepartment[];
  sourceLines:ProfitLossLine[];monthly:AccountMonthlyAmounts[];sections:ProfitLossSection[];subsections:ProfitLossSubsection[];
}):AnalyticProfitLossReport{
  const periods=analyticPeriods(input.mode,input.closed),periodKeys=periods.map(p=>p.key),months=[...new Set(periods.flatMap(p=>p.months))];
  const resolver=accountShareResolver(input,input.selected),monthly=new Map(input.monthly.map(row=>[row.accountId,row.values]));
  const sourceAccounts=new Map(input.sourceLines.flatMap(line=>line.accounts??[]).map(a=>[a.id,a]));
  const accounts:AnalyticAccount[]=[],unallocated:AnalyticAccount[]=[];
  for(const source of sourceAccounts.values()){
    const originalMonths=Object.fromEntries(months.map(month=>[month,monthly.get(source.id)?.[month]??0]));
    if(!monthly.has(source.id))throw new AnalyticReportError(`Détail mensuel absent pour le compte ${source.code}.`);
    for(const p of periods){const actual=p.months.reduce((s,m)=>s+originalMonths[m],0);if(!Number.isFinite(actual)||Math.abs(actual-(source.values[p.key]??0))>.01)throw new AnalyticReportError(`Le détail mensuel du compte ${source.code} ne correspond pas au total Odoo. Réessayez après actualisation.`);}
    const selectedMonths:Record<string,number>={},otherMonths:Record<string,number>={};let keyLabel='Non affecté';
    for(const month of months){const resolved=resolver.resolve(source.id,source.code,month);keyLabel=resolved.label;selectedMonths[month]=originalMonths[month]*resolved.share;otherMonths[month]=originalMonths[month]*resolved.unallocated;}
    const make=(values:Record<string,number>):AnalyticAccount=>({id:source.id,code:source.code,label:source.label,keyLabel,originalMonths:{...originalMonths},monthlyValues:values,
      originalValues:Object.fromEntries(periods.map(p=>[p.key,p.months.reduce((s,m)=>s+originalMonths[m],0)])),
      values:Object.fromEntries(periods.map(p=>[p.key,p.months.reduce((s,m)=>s+values[m],0)*p.factor]))});
    accounts.push(make(selectedMonths));if(Object.values(otherMonths).some(value=>Math.abs(value)>.004))unallocated.push(make(otherMonths));
  }
  // Unique ownership by most specific account prefix, identical to the configured P&L.
  const owners=new Map(accounts.map(a=>[a.id,accountSection(a.code,input.sections)?.id]));
  const lines=new Map<string,AnalyticLine>(),building=new Set<string>();
  const make=(section:ProfitLossSection):AnalyticLine=>{
    if(building.has(section.id))throw new AnalyticReportError('Une formule de rubrique contient une référence circulaire.');
    const existing=lines.get(section.id);if(existing)return existing;
    building.add(section.id);
    const source=accounts.filter(a=>owners.get(a.id)===section.id);
    const line:AnalyticLine={key:section.id,label:section.label,kind:section.kind,values:{},monthlyValues:{},accounts:source,subsections:[]};
    if(section.kind==='accounts'){
      line.values=sum(source,periodKeys,'values');line.monthlyValues=sum(source,months,'monthlyValues');
      const subs=input.subsections.filter(s=>s.parentSectionId===section.id).sort((a,b)=>a.order-b.order);
      const subOwner=(a:AnalyticAccount)=>subs.flatMap(s=>s.prefixes.filter(p=>a.code.startsWith(p)).map(p=>({s,length:p.length}))).sort((a,b)=>b.length-a.length||a.s.order-b.s.order)[0]?.s.id;
      line.subsections=subs.map(sub=>{const rows=source.filter(a=>subOwner(a)===sub.id);return {id:sub.id,label:sub.label,accounts:rows,values:sum(rows,periodKeys,'values'),monthlyValues:sum(rows,months,'monthlyValues')};}).filter(sub=>sub.accounts.length);
    }else{
      const terms=section.formula.map(term=>{const ref=input.sections.find(s=>s.id===term.sectionId);if(!ref)throw new AnalyticReportError('Une formule référence une rubrique absente.');return {line:make(ref),sign:term.operator==='subtract'?-1:1};});
      for(const [field,keys] of [['values',periodKeys],['monthlyValues',months]] as const)line[field]=Object.fromEntries(keys.map(k=>[k,terms.reduce((s,t)=>s+t.sign*(t.line[field][k]??0),0)]));
    }
    building.delete(section.id);lines.set(section.id,line);return line;
  };
  const ordered=[...input.sections].sort((a,b)=>a.order-b.order).map(make);
  // Display only allocated nonzero details; do not hide offsetting monthly activity.
  const nonzero=(a:AnalyticAccount)=>Object.values(a.monthlyValues).some(n=>Math.abs(n)>.004);
  for(const line of ordered){line.accounts=line.accounts.filter(nonzero);line.subsections=line.subsections.map(s=>({...s,accounts:s.accounts.filter(nonzero)})).filter(s=>s.accounts.length);}
  return {mode:input.mode,departments:input.selected,lastClosedMonth:input.closed,periods,lines:ordered,revenueKey:accountSection('700000',input.sections)?.id??'',unallocated,warnings:[...resolver.warnings],generatedAt:new Date().toISOString()};
}
