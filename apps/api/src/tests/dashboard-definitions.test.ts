import { expect,test } from 'bun:test';
import { reportingDashboards } from '../services/dashboard-definitions';
import type { Company,DashboardDefinition } from '@equinoxe/shared';
const company={id:'g',slug:'gimi'} as Company;
const rows:DashboardDefinition[]=[{id:'1',companyId:'g',slug:'balance',label:'Balance',order:10,status:'active'},{id:'2',companyId:'g',slug:'autre',label:'Autre',order:11,status:'active'}];
test('analyse après Balance, sans mutation de la configuration ni doublon',()=>{const copy=JSON.stringify(rows);const result=reportingDashboards(company,rows);expect(result.map(x=>x.slug)).toEqual(['balance','analyse','autre']);expect(JSON.stringify(rows)).toBe(copy);expect(reportingDashboards(company,result).filter(x=>x.slug==='analyse')).toHaveLength(1);});
test('aucun ajout aux autres sociétés',()=>{expect(reportingDashboards({...company,slug:'lonneux'},rows)).toHaveLength(2);});
