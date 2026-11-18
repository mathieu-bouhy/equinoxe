import { describe, expect, test } from 'bun:test';
import { bajomaAnnualCharge, buildingAnnualRent, gimiBudgetPlanDefaults, hiringAnnualCost } from '@equinoxe/shared';

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
  test('indexe et proratise un recrutement à sa date exacte',()=>{
    const hiring={id:'h1',count:2,function:'Technicien',department:'intrusion' as const,jointCommittee:'cp200' as const,startDate:'2027-07-01',annualSalary2026:60000};
    expect(hiringAnnualCost(hiring,2027,plan.salaryIndexation)).toBeCloseTo(2*60000*1.0417*184/365,2);
  });
});
