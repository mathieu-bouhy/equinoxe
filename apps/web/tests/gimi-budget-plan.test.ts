import { describe, expect, test } from 'bun:test';
import { bajomaAnnualCharge, buildingAnnualRent, gimiBudgetCashForecast, gimiBudgetPlanDefaults, gimiBudgetYears, hiringAnnualCost, type GimiBudgetProjection } from '@equinoxe/shared';

describe('calculs du budget Gimi',()=>{
  const plan=gimiBudgetPlanDefaults('gimi');
  test('proratise le nouveau bâtiment et indexe à la date anniversaire',()=>{
    expect(buildingAnnualRent(plan.building,2027)).toBe(145000);
    expect(buildingAnnualRent(plan.building,2028)).toBeCloseTo(145000*4/12+340000*8/12,2);
    expect(buildingAnnualRent(plan.building,2029)).toBeCloseTo(340000*4/12+340000*1.015*8/12,2);
  });
  test('retient le montant Bajoma HTVA dans le budget',()=>{
    expect(bajomaAnnualCharge(plan.bajoma,2027)).toBeCloseTo(20804.03*12,2);
  });
  test('proratise le salaire annuel 2027 d’un recrutement à sa date exacte',()=>{
    const hiring={id:'h1',count:2,function:'Technicien',department:'intrusion' as const,jointCommittee:'cp200' as const,startDate:'2027-07-01',annualSalary2027:60000,hasCompanyCar:false,annualCarLeaseBudget:null};
    expect(hiringAnnualCost(hiring,2027,plan.salaryIndexation)).toBeCloseTo(2*60000*184/365,2);
    expect(hiringAnnualCost(hiring,2028,plan.salaryIndexation)).toBeCloseTo(2*60000*1.0417,2);
  });
  test('reprend CBC et la référence MBP sans double déduction des intérêts',()=>{
    const complete={
      ...plan,companyId:'gimi',updatedAt:'',updatedByUserId:null,
      debtForecast:{...plan.debtForecast,openingCash2027:1000000},
      scenarios:{...plan.scenarios,neutral:{...plan.scenarios.neutral,values:{...plan.scenarios.neutral.values,workingCapitalRate:Object.fromEntries(gimiBudgetYears.map(year=>[year,.1])) as typeof plan.scenarios.neutral.values.workingCapitalRate}}},
      capexBudget:Object.fromEntries(Object.keys(plan.capexBudget).map(key=>[key,Object.fromEntries(gimiBudgetYears.map(year=>[year,0]))])) as typeof plan.capexBudget,
    };
    const projection={lines:[{key:'revenue',values:{2027:1000}},{key:'netResult',values:{2027:500}},{key:'depreciation',values:{2027:-100}}]} as GimiBudgetProjection;
    const year=gimiBudgetCashForecast(complete,projection,100)[0];
    expect(year.operatingCashFlow).toBe(600);expect(year.totalDebtRepayment).toBe(479000);expect(year.cashAfterDebt).toBe(-478400);expect(year.freeCashFlow).toBe(-478400);expect(year.closingCash).toBe(521600);
  });
  test('utilise les deux crédits MBP détaillés seulement après désactivation de la référence groupe',()=>{
    const detailed={...plan,companyId:'gimi',updatedAt:'',updatedByUserId:null,debtForecast:{...plan.debtForecast,useMbpGroupReference:false,mbp1:{...plan.debtForecast.mbp1,2027:50000},mbp2:{...plan.debtForecast.mbp2,2027:25000}}};
    const projection={lines:[{key:'revenue',values:{2027:1000}},{key:'netResult',values:{2027:500}},{key:'depreciation',values:{2027:-100}}]} as GimiBudgetProjection;
    const year=gimiBudgetCashForecast(detailed,projection,null)[0];
    expect(year.mbpRepayment).toBe(75000);expect(year.totalDebtRepayment).toBe(405000);expect(year.cashAfterDebt).toBe(-404400);expect(year.freeCashFlow).toBeNull();
  });
});
