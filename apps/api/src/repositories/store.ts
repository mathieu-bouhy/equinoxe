import { z } from 'zod';
import type { BfrSection, Company, CompanyAccess, DashboardDefinition, HistoricalAccountBalance, IntegrationMetadata, ProfitLossSection, ProfitLossSubsection, ReportSettings, User } from '@equinoxe/shared';
import { JsonFile } from './json-file';

const status=z.enum(['active','inactive']);
const user=z.object({id:z.string(),name:z.string(),email:z.string().email(),role:z.enum(['admin','viewer']),status,analysisAccess:z.array(z.string()).default([]),passwordHash:z.string(),passwordSalt:z.string(),createdAt:z.string(),updatedAt:z.string(),lastLoginAt:z.string().nullable()});
const company=z.object({id:z.string(),slug:z.string(),name:z.string(),status,connectorType:z.enum(['odoo','rest','none']),createdAt:z.string(),updatedAt:z.string()});
const access=z.object({userId:z.string(),companyId:z.string(),createdAt:z.string()});
const dashboard=z.object({id:z.string(),companyId:z.string(),slug:z.string(),label:z.string(),order:z.number(),status});
const integration=z.object({id:z.string(),companyId:z.string(),provider:z.enum(['odoo','rest']),status:z.enum(['connected','disconnected','not_configured']),baseUrl:z.string().nullable(),database:z.string().nullable(),lastTestAt:z.string().nullable(),lastError:z.string().nullable(),managedByEnvironment:z.boolean()});
const pnlSection=z.object({id:z.string(),companyId:z.string(),label:z.string(),kind:z.enum(['accounts','calculation']).default('accounts'),prefixes:z.array(z.string()).default([]),formula:z.array(z.object({sectionId:z.string(),operator:z.enum(['add','subtract'])})).default([]),order:z.number(),createdAt:z.string(),updatedAt:z.string()});
const pnlSubsection=z.object({id:z.string(),companyId:z.string(),parentSectionId:z.string(),label:z.string(),prefixes:z.array(z.string()),order:z.number(),createdAt:z.string(),updatedAt:z.string()});
const historicalBalance=z.object({companyId:z.string(),accountCode:z.string(),label:z.string(),year:z.number().int(),amount:z.number(),importedAt:z.string(),sourceFile:z.string()});
const reportSettings=z.object({companyId:z.string(),lastClosedMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),updatedAt:z.string()});
const bfrSection=z.object({id:z.string(),companyId:z.string(),label:z.string(),sign:z.enum(['add','subtract']),prefixes:z.array(z.string().regex(/^\d{1,12}$/)),order:z.number(),createdAt:z.string(),updatedAt:z.string()});

type CalculationSpec={label:string;terms:Array<[string,'add'|'subtract']>};
const calculationSpecs:CalculationSpec[]=[
  {label:'Marge brute',terms:[['Chiffre d’affaires','add'],['Marchandises','add']]},
  {label:'Coûts hors achats',terms:[['Sous-traitance','add'],['Services et biens divers','add'],['Personnel','add'],['Charges d’exploitation','add'],['Produits d’exploitation','add']]},
  {label:'EBITDA',terms:[['Marge brute','add'],['Coûts hors achats','add']]},
  {label:'Résultat d’exploitation',terms:[['EBITDA','add'],['Amortissements','add']]},
  {label:'Résultat avant impôts',terms:[['Résultat d’exploitation','add'],['Financier','add']]},
  {label:'Résultat après impôts',terms:[['Résultat avant impôts','add'],['Impôts','add']]}
];
const displayOrder=['Chiffre d’affaires','Marchandises','Marge brute','Sous-traitance','Services et biens divers','Personnel','Charges d’exploitation','Produits d’exploitation','Coûts hors achats','EBITDA','Amortissements','Résultat d’exploitation','Financier','Résultat avant impôts','Impôts','Résultat après impôts'];

export class Store {
  users;companies;access;dashboards;integrations;pnlSections;pnlSubsections;historicalBalances;reportSettings;bfrSections;
  constructor(dir:string){
    this.users=new JsonFile<User>(dir,'users.json',z.array(user) as unknown as z.ZodType<User[]>,()=>[]);
    this.companies=new JsonFile<Company>(dir,'companies.json',z.array(company),()=>[]);
    this.access=new JsonFile<CompanyAccess>(dir,'company-access.json',z.array(access),()=>[]);
    this.dashboards=new JsonFile<DashboardDefinition>(dir,'dashboards.json',z.array(dashboard),()=>[]);
    this.integrations=new JsonFile<IntegrationMetadata>(dir,'integrations.json',z.array(integration),()=>[]);
    this.pnlSections=new JsonFile<ProfitLossSection>(dir,'profit-loss-sections.json',z.array(pnlSection) as unknown as z.ZodType<ProfitLossSection[]>,()=>[]);
    this.pnlSubsections=new JsonFile<ProfitLossSubsection>(dir,'profit-loss-subsections.json',z.array(pnlSubsection),()=>[]);
    this.historicalBalances=new JsonFile<HistoricalAccountBalance>(dir,'lonneux-historical-balances.json',z.array(historicalBalance),()=>[]);
    this.reportSettings=new JsonFile<ReportSettings>(dir,'report-settings.json',z.array(reportSettings),()=>[]);
    this.bfrSections=new JsonFile<BfrSection>(dir,'bfr-sections.json',z.array(bfrSection),()=>[]);
  }
  async bootstrap(){
    const companies=await this.companies.read(),now=new Date().toISOString();
    const ensureCompany=async(slug:string,name:string)=>{let item=companies.find(c=>c.slug===slug);if(!item){item={id:crypto.randomUUID(),slug,name,status:'active' as const,connectorType:'odoo' as const,createdAt:now,updatedAt:now};companies.push(item);await this.companies.write(companies)}return item};
    const gimi=await ensureCompany('gimi','Gimi'),lonneux=await ensureCompany('lonneux','Lonneux');
    const boards=await this.dashboards.read(),ensureBoard=async(companyId:string,slug:string,label:string,order:number)=>{if(!boards.some(d=>d.companyId===companyId&&d.slug===slug)){boards.push({id:crypto.randomUUID(),companyId,slug,label,order,status:'active'});await this.dashboards.write(boards)}};
    await ensureBoard(gimi.id,'compte-resultat','Compte de résultat',0);await ensureBoard(gimi.id,'compte-resultat-ltm','Compte de résultat LTM',1);await ensureBoard(gimi.id,'compte-resultat-extrapole','Compte de résultat extrapolé',2);await ensureBoard(gimi.id,'bilan','Bilan',3);await ensureBoard(gimi.id,'bfr','BFR',4);await ensureBoard(lonneux.id,'compte-resultat','Compte de résultat',0);await ensureBoard(lonneux.id,'compte-resultat-extrapole','Compte de résultat',1);await ensureBoard(lonneux.id,'bilan','Bilan',2);
    const settings=await this.reportSettings.read(),previousMonth=new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth()-1,1)).toISOString().slice(0,7);
    for(const item of [gimi,lonneux])if(!settings.some(setting=>setting.companyId===item.id))settings.push({companyId:item.id,lastClosedMonth:previousMonth,updatedAt:now});
    await this.reportSettings.write(settings);
    const sections=await this.pnlSections.read();
    const defaults:Array<[string,string[]]>=[['Chiffre d’affaires',['70','71']],['Marchandises',['60']],['Sous-traitance',['603']],['Services et biens divers',['61']],['Personnel',['62']],['Charges d’exploitation',['64']],['Produits d’exploitation',['74']],['Amortissements',['630']],['Financier',['65','75']],['Impôts',['67','77']]];
    for(const item of [gimi,lonneux]){
      if(!sections.some(section=>section.companyId===item.id)) sections.push(...defaults.map(([label,prefixes],order)=>({id:crypto.randomUUID(),companyId:item.id,label,kind:'accounts' as const,prefixes,formula:[],order,createdAt:now,updatedAt:now})));
      const companySections=sections.filter(section=>section.companyId===item.id);
      if(!companySections.some(section=>section.kind==='calculation')){
        const byLabel=new Map(companySections.map(section=>[section.label,section]));
        for(const spec of calculationSpecs){
          const formula=spec.terms.flatMap(([label,operator])=>{const source=byLabel.get(label);return source?[{sectionId:source.id,operator}]:[]});
          const created={id:crypto.randomUUID(),companyId:item.id,label:spec.label,kind:'calculation' as const,prefixes:[],formula,order:0,createdAt:now,updatedAt:now};
          sections.push(created);byLabel.set(created.label,created);
        }
        for(const section of sections.filter(section=>section.companyId===item.id)) section.order=displayOrder.indexOf(section.label)>=0?displayOrder.indexOf(section.label):section.order;
      }
    }
    await this.pnlSections.write(sections);
    const bfr=await this.bfrSections.read();
    if(!bfr.some(section=>section.companyId===gimi.id)){
      const defaults:Array<[string,'add'|'subtract',string[]]>=[
        ['Stocks','add',['30','32','33','34','35','36','39']],
        ['En cours','add',['31','37']],
        ['Créances commerciales et avances fournisseurs','add',['40']],
        ['Autres créances d’exploitation','add',['41']],
        ['Régularisations actives','add',['490','491']],
        ['Dettes fournisseurs','subtract',['44']],
        ['Dettes fiscales et sociales d’exploitation','subtract',['45']],
        ['Avances clients, autres dettes et régularisations passives','subtract',['46','48','492','493']],
      ];
      bfr.push(...defaults.map(([label,sign,prefixes],order)=>({id:crypto.randomUUID(),companyId:gimi.id,label,sign,prefixes,order,createdAt:now,updatedAt:now})));
      await this.bfrSections.write(bfr);
    }
    const legacyStock=bfr.find(section=>section.companyId===gimi.id&&section.label==='Stocks et encours');
    if(legacyStock){
      legacyStock.label='Stocks';legacyStock.prefixes=['30','32','33','34','35','36','39'];legacyStock.updatedAt=now;
      for(const section of bfr.filter(section=>section.companyId===gimi.id&&section.id!==legacyStock.id&&section.order>legacyStock.order))section.order+=1;
      bfr.push({id:crypto.randomUUID(),companyId:gimi.id,label:'En cours',sign:'add',prefixes:['31','37'],order:legacyStock.order+1,createdAt:now,updatedAt:now});
    }
    const legacyPayables=bfr.filter(section=>section.companyId===gimi.id&&['Avances clients et charges à imputer','Autres dettes d’exploitation','Régularisations passives'].includes(section.label));
    if(legacyPayables.length){
      const first=legacyPayables.sort((a,b)=>a.order-b.order)[0];
      first.label='Avances clients, autres dettes et régularisations passives';first.prefixes=['46','48','492','493'];first.updatedAt=now;
      const removed=new Set(legacyPayables.slice(1).map(section=>section.id));
      const next=bfr.filter(section=>!removed.has(section.id));
      next.filter(section=>section.companyId===gimi.id).sort((a,b)=>a.order-b.order).forEach((section,order)=>section.order=order);
      await this.bfrSections.write(next);
    }else if(legacyStock){await this.bfrSections.write(bfr);}
    const revenue=sections.find(s=>s.companyId===gimi.id&&s.kind==='accounts'&&s.prefixes.includes('70'));
    const subs=await this.pnlSubsections.read();
    if(revenue&&!subs.some(s=>s.companyId===gimi.id)){
      const defaults:Array<[string,string[]]>=[['Contrats · Incendie',['700007','700008','700009','700016','700035','700036','700059','700099']],['Contrats · Alarme',['700031','700032','700033','700034','700080','700089']],['Contrats · Caméra',['700069']],['Contrats · Gaz',['700037']],['Contrats · Extincteurs et dévidoirs',['700023','700024','700025']],['Contrats · WIFI',['700021']],['Contrats · Appel personne',['700010','700011']],['Contrats · Autres',['700054','700057','700058']],['Autres · Incendie',['700001','700003','700005','700018','717000']],['Autres · Alarme',['700014','700028','700038','717010']],['Autres · LED',['700050','700052','700090','717050']],['Autres · Contrôle d’accès',['700013','700030','700042','700063','700073','717020']],['Autres · Caméra',['700029','700039','717090']],['Autres · Gaz',['700067','700077','700087','717040']],['Autres · Extincteurs et dévidoirs',['700026','700066','700083','717060']],['Autres · WIFI',['700056','700076','700086','717070']],['Autres · Appel personne',['700002','700004','700006','700040','700045','700046','700048']],['Autres · Electricité',['700015','700017','700019']],['Autres · Divers',['700000','700049','705000','717080']]];
      subs.push(...defaults.map(([label,prefixes],order)=>({id:crypto.randomUUID(),companyId:gimi.id,parentSectionId:revenue.id,label,prefixes,order,createdAt:now,updatedAt:now})));await this.pnlSubsections.write(subs);
    }
  }
}
