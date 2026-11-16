import { expect,test } from 'bun:test';
import { reportingDashboards } from '../services/dashboard-definitions';
import type { Company,DashboardDefinition } from '@equinoxe/shared';
const company={id:'g',slug:'gimi'} as Company;
const rows:DashboardDefinition[]=[{id:'1',companyId:'g',slug:'balance',label:'Balance',order:10,status:'active'},{id:'2',companyId:'g',slug:'autre',label:'Autre',order:11,status:'active'}];
test('analyse après Balance, sans mutation de la configuration ni doublon',()=>{const copy=JSON.stringify(rows);const result=reportingDashboards(company,rows);expect(result.map(x=>x.slug)).toEqual(['balance','analyse','autre','tresorerie-clients','tresorerie-fournisseurs','synthese-cash']);expect(JSON.stringify(rows)).toBe(copy);expect(reportingDashboards(company,result).filter(x=>x.slug==='analyse')).toHaveLength(1);});
test('ajoute le reporting Lonneux après Balance, même quand Bilan est aussi présent',()=>{
 const lonneuxRows:DashboardDefinition[]=[
  {id:'1',companyId:'l',slug:'bilan',label:'Bilan',order:10,status:'active'},
  {id:'2',companyId:'l',slug:'balance',label:'Balance',order:11,status:'active'},
  {id:'3',companyId:'l',slug:'autre',label:'Autre',order:12,status:'active'},
 ];
 const result=reportingDashboards({id:'l',slug:'lonneux'} as Company,lonneuxRows);
 expect(result.map(row=>row.slug)).toEqual(['bilan','balance','analyse','autre','tresorerie-clients','tresorerie-fournisseurs','synthese-cash']);
 expect(result.find(row=>row.slug==='analyse')?.label).toBe('Reporting mensuel');
});
test('utilise Bilan comme repli quand Balance est absent',()=>{
 const lonneuxRows:DashboardDefinition[]=[{id:'1',companyId:'l',slug:'bilan',label:'Bilan',order:10,status:'active'}];
 expect(reportingDashboards({id:'l',slug:'lonneux'} as Company,lonneuxRows).map(row=>row.slug)).toEqual(['bilan','analyse','tresorerie-clients','tresorerie-fournisseurs','synthese-cash']);
});
test('aucun ajout aux sociétés non concernées',()=>{expect(reportingDashboards({...company,slug:'eurodrill'},rows)).toHaveLength(2);});
