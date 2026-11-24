import { expect, test } from 'bun:test';
import { annualCarLeaseCost, salaryIncreaseAnnualCost, type GimiBudgetSalaryIncrease } from '@equinoxe/shared';

const increase:GimiBudgetSalaryIncrease={
  id:'raise-1',count:1,function:'Technicien',department:'intrusion',jointCommittee:'cp200',
  effectiveDate:'2027-07-01',annualSalary2026:50000,increaseRate:.05,hasCompanyCar:true,annualCarLeaseBudget:7200,
};

test('une augmentation ajoute uniquement le surcoût salarial proratisé',()=>{
  const expected=50000*1.04*.05*(184/365);
  expect(salaryIncreaseAnnualCost(increase,2027,{cp200:.04,cp14901:null})).toBeCloseTo(expected,6);
  expect(salaryIncreaseAnnualCost({...increase,increaseRate:null},2027,{cp200:.04,cp14901:null})).toBe(0);
});

test('le leasing voiture est annuel et proratisé séparément',()=>{
  expect(annualCarLeaseCost(increase,2027,increase.effectiveDate)).toBeCloseTo(7200*(184/365),6);
  expect(annualCarLeaseCost({...increase,hasCompanyCar:false},2027,increase.effectiveDate)).toBe(0);
  expect(annualCarLeaseCost({...increase,annualCarLeaseBudget:null},2027,increase.effectiveDate)).toBe(0);
});
