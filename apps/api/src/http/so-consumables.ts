import type { Company } from '@equinoxe/shared';
import type { Store } from '../repositories/store';
import type { SoConsumablesStorage } from '../repositories/so-consumables';
import type { OdooConnector } from '../connectors/odoo';
import { ConnectorError } from '../connectors/odoo';
import { accountSection } from '../services/analytic-allocation';
import { consumableAccountMap, SoConsumablesError } from '../services/so-consumables';

export async function soConsumablesResponse(request:Request,company:Company,isAdmin:boolean,store:Store,repository:SoConsumablesStorage,connector:OdooConnector){
  const fail=(message:string,status:number)=>Response.json({error:{code:'SO_CONSUMABLES',message}},{status});
  if(!isAdmin)return fail('Cette configuration est réservée aux administrateurs.',403);
  if(company.slug!=='gimi'||company.connectorType!=='odoo')return fail('Cette analyse est réservée à Gimi.',409);
  if(!['GET','POST'].includes(request.method))return fail('Méthode non autorisée.',405);
  try{
    if(request.method==='POST'){
      const settings=await store.reportSettings.read(),closed=settings.find(s=>s.companyId===company.id)?.lastClosedMonth;
      if(!closed||!/^20\d{2}-(0[1-9]|1[0-2])$/.test(closed)||closed<'2023-01')return fail('Configurez le mois clôturé.',422);
      const capped=closed>'2026-12'?'2026-12':closed,[year,month]=capped.split('-').map(Number),through=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
      const sections=(await store.pnlSections.read()).filter(s=>s.companyId===company.id),revenue=accountSection('700000',sections);
      if(!revenue)return fail('Configurez la rubrique Chiffre d’affaires.',422);
      const [allAccounts,assignments,keys,employees]=await Promise.all([connector.getProfitLossAccounts(),store.accountAnalyticAllocations.read(),store.analyticAllocationCodes.read(),store.employeeAnalyticAllocations.read()]);
      const relevant=allAccounts.filter(a=>accountSection(a.code,sections)?.id===revenue.id);
      const accounts=consumableAccountMap(relevant,assignments.filter(a=>a.companyId===company.id),keys.filter(a=>a.companyId===company.id),employees.filter(a=>a.companyId===company.id));
      const snapshot=await connector.getSoConsumables(company.id,through,accounts);
      await repository.save(snapshot);
    }
    return Response.json({data:await repository.read(company.id)},{headers:{'cache-control':'no-store'}});
  }catch(error){return fail(error instanceof ConnectorError||error instanceof SoConsumablesError?error.message:'Impossible de lire ou recalculer l’analyse. Les résultats précédents sont conservés.',503);}
}
