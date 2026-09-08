import { expect,test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmployeeAllocationTable } from '../src/components/EmployeeAllocationTable';
import { MonthlyEmployeeCosts } from '../src/components/MonthlyEmployeeCosts';
import { withCostAllocationKeys, type EmployeeAnalyticAllocation } from '@equinoxe/shared';
const employee={id:'test',companyId:'gimi',fullName:'Personne test',firstName:'Personne',lastName:'test',function:'Technicien',entryDate:'2025-01-01',endDate:'2026-02-15',annualSalaryCost:12000,annualCarCost:2400,analyticAllocationCodeId:null} as EmployeeAnalyticAllocation;
test('date de fin éditable et clé Salaire absente des choix employés',()=>{
  const html=renderToStaticMarkup(<EmployeeAllocationTable employees={[employee]} keys={withCostAllocationKeys([],'gimi')} onChange={()=>{}}/>);
  expect(html).toContain('type="date"');expect(html).toContain('value="2026-02-15"');expect(html).not.toContain('system:salary');expect(html).not.toContain('system:vehicle');
});
for(const kind of ['salary','vehicle'] as const)test(`24 mois du tableau ${kind} et départ pris en compte sans date affichée`,()=>{
  const html=renderToStaticMarkup(<MonthlyEmployeeCosts employees={[employee]} keys={[]} kind={kind}/>);
  expect(html).toContain('janvier 2025');expect(html).toContain('décembre 2026');
  expect(html.match(/employés présents/g)).toHaveLength(24);expect(html).not.toContain('2026-02-15');
  expect(html.match(/0 employés présents/g)).toHaveLength(10);
});
