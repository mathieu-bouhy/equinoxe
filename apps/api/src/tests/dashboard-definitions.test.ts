import { expect,test } from 'bun:test';
import { reportingDashboards } from '../services/dashboard-definitions';
import type { Company,DashboardDefinition } from '@equinoxe/shared';
const company={id:'g',slug:'gimi'} as Company;
const rows:DashboardDefinition[]=[{id:'1',companyId:'g',slug:'balance',label:'Balance',order:10,status:'active'},{id:'2',companyId:'g',slug:'autre',label:'Autre',order:11,status:'active'}];
test('analyse après Balance, sans mutation de la configuration ni doublon',()=>{const copy=JSON.stringify(rows);const result=reportingDashboards(company,rows);expect(result.map(x=>x.slug)).toEqual(['balance','analyse','autre']);expect(JSON.stringify(rows)).toBe(copy);expect(reportingDashboards(company,result).filter(x=>x.slug==='analyse')).toHaveLength(1);});
test('ajoute le reporting Lonneux après le bilan sans reprendre les libellés Gimi',()=>{
 const lonneuxRows=rows.map(row=>({...row,companyId:'l',slug:row.slug==='balance'?'bilan':row.slug}));
 const result=reportingDashboards({id:'l',slug:'lonneux'} as Company,lonneuxRows);
 expect(result.map(row=>row.slug)).toEqual(['bilan','analyse','autre']);
 expect(result.find(row=>row.slug==='analyse')?.label).toBe('Reporting mensuel');
});
test('aucun ajout aux sociétés non concernées',()=>{expect(reportingDashboards({...company,slug:'eurodrill'},rows)).toHaveLength(2);});
