import type { Company, DashboardDefinition } from '@equinoxe/shared';

/** Derived navigation entry: no rewrite of the shared dashboard collection. */
export function reportingDashboards(company: Company, definitions: DashboardDefinition[]) {
  const rows = definitions.filter(d => d.companyId === company.id && d.status === 'active')
    .sort((a,b) => a.order-b.order)
    .map(d => company.slug !== 'gimi' ? d : d.slug === 'compte-resultat' ? {...d,label:'Compte de résultat YTD'} : d.slug === 'analyse' ? {...d,label:'Reporting mensuel'} : d);
  if (company.slug === 'gimi' && !rows.some(d => d.slug === 'analyse')) {
    const balance = rows.findIndex(d => d.slug === 'balance');
    rows.splice(balance < 0 ? rows.length : balance+1,0,{id:`${company.id}-analyse`,companyId:company.id,slug:'analyse',label:'Reporting mensuel',order:rows.length+1,status:'active'});
  }
  return rows;
}
