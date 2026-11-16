import type { Company, ReportSettings, BfrSection, ProfitLossSection } from '@equinoxe/shared';
import type { OdooConnector } from '../connectors/odoo';
import { ConnectorError } from '../connectors/odoo';
import { buildAgedBalance } from '../services/aged-balance';
import { loadCashOverview } from '../services/cash-overview';
import { cashCutoff } from '../services/cash-history';
import { ReportCache } from '../services/report-cache';
const cache=new ReportCache(300000,12);
export async function treasuryResponse(request:Request,company:Company,connector:OdooConnector,setting:ReportSettings|undefined,sections:BfrSection[]=[],pnlSections:ProfitLossSection[]=[]):Promise<Response>{
  const fail=(message:string,status:number)=>Response.json({error:{code:'TREASURY',message}},{status,headers:{'cache-control':'no-store'}});
  if(request.method!=='GET')return fail('Méthode non autorisée.',405);
  if(!['gimi','lonneux'].includes(company.slug)||company.connectorType!=='odoo')return fail('Ce reporting est disponible pour GIMI et Lonneux.',409);
  if(!setting)return fail('Configurez le dernier mois clôturé.',422);
  const url=new URL(request.url),view=url.searchParams.get('view')??'clients',mode=url.searchParams.get('mode')??'closed';
  if(!['clients','fournisseurs','synthese'].includes(view)||!['closed','today'].includes(mode))return fail('Vue ou période invalide.',422);
  try{
    const closedThrough=cashCutoff(setting.lastClosedMonth);
    const today=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Brussels',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    if(closedThrough>today)return fail('Le mois clôturé ne peut pas être dans le futur.',422);
    let report;
    if(view==='synthese')report=await cache.get(JSON.stringify([company.id,closedThrough,sections,pnlSections]),()=>loadCashOverview(connector,closedThrough,sections,pnlSections,company.slug as 'gimi'|'lonneux'));
    else {
      const ledger=await connector.getTreasuryLedger(today,closedThrough,company.slug as 'gimi'|'lonneux');
      report=buildAgedBalance(ledger,view as 'clients'|'fournisseurs',mode==='today'?today:closedThrough,closedThrough,company.slug==='lonneux'?'2026-01-01':undefined);
      if(company.slug==='lonneux')report.warnings.unshift('Historique disponible à partir de janvier 2026 : le détail 2025 est incomplet dans Odoo. Les encours reflètent les seules écritures et lettrages disponibles ; reprise des soldes et exhaustivité des règlements à vérifier.');
    }
    return Response.json({data:report},{headers:{'cache-control':'no-store'}});
  }catch(error){return fail(error instanceof ConnectorError?error.message:'Lecture de trésorerie incomplète ou indisponible. Aucun montant partiel n’est présenté.',503);}
}
