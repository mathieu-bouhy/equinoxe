import { z } from 'zod';
import { withCostAllocationKeys } from '@equinoxe/shared';
import type { AnalyticEntriesReport, Company } from '@equinoxe/shared';
import type { Store } from '../repositories/store';
import { ConnectorError, type OdooConnector } from '../connectors/odoo';
import { accountShareResolver, analyticPeriods, AnalyticReportError, buildAnalyticProfitLoss } from '../services/analytic-profit-loss';
import { accountSection } from '../services/analytic-allocation';

const querySchema=z.object({mode:z.enum(['annual','ltm','extrapolated']),departments:z.array(z.enum(['fireInstallation','fireMaintenance','intrusion','led'])).min(1).max(4).refine(v=>new Set(v).size===v.length)});
export async function analyticProfitLossResponse(request:Request,company:Company,store:Store,connector:OdooConnector,entries:boolean):Promise<Response>{
  const fail=(message:string,status=422)=>Response.json({error:{code:'ANALYTIC_REPORT',message}},{status});
  if(request.method!=='GET')return fail('Méthode non autorisée.',405);
  if(company.slug!=='gimi'||company.connectorType!=='odoo')return fail('Ce rapport analytique est réservé à Gimi.',409);
  const url=new URL(request.url),parsed=querySchema.safeParse({mode:url.searchParams.get('mode'),departments:url.searchParams.get('departments')?.split(',')});
  if(!parsed.success||['mode','departments','account','period','month'].some(key=>url.searchParams.getAll(key).length>1))return fail('Sélection de départements ou de rapport invalide.');
  try{
    const [allSections,allSubs,allAssignments,allKeys,allEmployees,settings]=await Promise.all([store.pnlSections.read(),store.pnlSubsections.read(),store.accountAnalyticAllocations.read(),store.analyticAllocationCodes.read(),store.employeeAnalyticAllocations.read(),store.reportSettings.read()]);
    const closed=settings.find(s=>s.companyId===company.id)?.lastClosedMonth;if(!closed)return fail('Configurez le dernier mois clôturé.');
    const {mode,departments:selected}=parsed.data,periods=analyticPeriods(mode,closed),sections=allSections.filter(s=>s.companyId===company.id),subsections=allSubs.filter(s=>s.companyId===company.id);
    const context={keys:withCostAllocationKeys(allKeys,company.id),assignments:allAssignments.filter(s=>s.companyId===company.id),employees:allEmployees.filter(s=>s.companyId===company.id)};
    if(!accountSection('700000',sections))return fail('Configurez la rubrique Chiffre d’affaires.');
    if(entries){
      const accountId=url.searchParams.get('account')??'',period=periods.find(p=>p.key===url.searchParams.get('period')),month=url.searchParams.get('month');
      const assignment=context.assignments.find(a=>a.odooAccountId===accountId);
      if(!/^\d+$/.test(accountId)||!period||!assignment||!accountSection(assignment.accountCode,sections)||month&&!period.months.includes(month))return fail('Compte ou période de détail invalide.');
      const start=month?`${month}-01`:period.start,end=month?new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10):period.end;
      const original=await connector.getAnalyticAccountEntries(accountId,start,end),resolver=accountShareResolver(context,selected),factor=month?1:period.factor;
      const rows=original.map(row=>{const share=resolver.resolve(accountId,assignment.accountCode,row.date.slice(0,7)).share,originalAmount=row.credit-row.debit,allocatedAmount=originalAmount*share;return {...row,originalAmount,share,allocatedAmount,projectedAmount:allocatedAmount*factor};}).filter(row=>row.share>0);
      const data:AnalyticEntriesReport={rows,factor,originalTotal:rows.reduce((s,r)=>s+r.originalAmount,0),allocatedTotal:rows.reduce((s,r)=>s+r.allocatedAmount,0),projectedTotal:rows.reduce((s,r)=>s+r.projectedAmount,0)};
      return Response.json({data},{headers:{'cache-control':'no-store'}});
    }
    const years=[...new Set(periods.flatMap(p=>p.months.map(m=>Number(m.slice(0,4)))))],asOf=periods.at(-1)!.end;
    const source=mode==='ltm'?await connector.getProfitLossLtm(periods,sections):await connector.getProfitLoss(years,sections,subsections,false,asOf);
    const ids=[...new Set(source.lines.flatMap(line=>line.accounts??[]).map(a=>a.id))];
    const monthly=await connector.getProfitLossAccountMonths(ids,years,asOf);
    return Response.json({data:buildAnalyticProfitLoss({...context,mode,closed,selected,sections,subsections,sourceLines:source.lines,monthly})},{headers:{'cache-control':'no-store'}});
  }catch(error){return fail(error instanceof AnalyticReportError||error instanceof ConnectorError?error.message:'Impossible de calculer le rapport analytique. Aucune donnée n’a été modifiée.',503);}
}
