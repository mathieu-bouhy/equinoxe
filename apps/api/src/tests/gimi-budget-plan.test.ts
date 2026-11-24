import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';
import { gimiBudgetProjectionIntegrity } from '@equinoxe/shared';

const dirs:string[]=[];
afterEach(async()=>{await Promise.all(dirs.splice(0).map(dir=>rm(dir,{recursive:true,force:true})))});

test('budget Gimi persistant, validé et protégé contre les écrasements concurrents',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'equinoxe-budget-'));dirs.push(dir);
  const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();const app=createApp(store,auth);
  const call=(path:string,method='GET',value?:unknown,cookie='')=>app(new Request(`http://api${path}`,{method,headers:{'content-type':'application/json',cookie},...(value?{body:JSON.stringify(value)}:{})}));
  const login=await call('/v1/auth/login','POST',{email:'admin@equinoxe.local',password:'change-me-now'}),cookie=login.headers.get('set-cookie')?.split(';')[0]??'';
  const gimi=(await store.companies.read()).find(company=>company.slug==='gimi')!;
  const initial=await call(`/v1/companies/${gimi.id}/budget-plan`,'GET',undefined,cookie),plan=(await initial.json()).data;
  expect(initial.status).toBe(200);expect(plan.baseDate).toBe('2026-10-31');expect(plan.scenarios.neutral.values.growth['2027']).toBe(.12);expect(plan.salaryIndexation.cp14901).toBeNull();
  expect(plan.salaryIncreases).toEqual([]);expect(plan.accountPlanning.categoryGrowthRates.rent).toBeNull();expect(plan.accountPlanning.categoryRates.itTelecom).toBeNull();
  expect(plan.decisions.seasonality).toBe(false);expect(plan.capexBudget.vehicles['2027']).toBeNull();
  expect(plan.debtForecast.cbc['2027']).toBe(330000);expect(plan.debtForecast.mbpGroupReference['2031']).toBe(149000);expect(plan.debtForecast.mbp1['2027']).toBeNull();
  expect(plan.directorCompensationSchedule).toBeUndefined();expect(plan.ebitdaReference).toBeUndefined();
  const projectionResponse=await call(`/v1/companies/${gimi.id}/budget-plan/projection`,'GET',undefined,cookie),projection=(await projectionResponse.json()).data;
  expect(projectionResponse.status).toBe(200);expect(projection.years).toEqual([2026,2027,2028,2029,2030,2031,2032,2033,2034,2035,2036]);
  expect(projection.source).toBe('budget2026Reference');expect(projection.sourceNote).toContain('provisoirement');
  expect(projection.lines.find((line:{key:string})=>line.key==='revenue').values['2027']).toBeCloseTo(8_012_000*1.12,2);
  expect(gimiBudgetProjectionIntegrity(projection).ok).toBe(true);
  const altered=structuredClone(projection),alteredGross=altered.lines.find((line:{key:string})=>line.key==='grossMargin');alteredGross.values['2027']+=1000;
  expect(gimiBudgetProjectionIntegrity(altered).ok).toBe(false);
  expect(JSON.stringify(projection)).not.toContain('dirigeant');expect(JSON.stringify(projection)).not.toContain('compensation');
  const {companyId:_,updatedAt:__,updatedByUserId:___,...input}=plan,inputChanged={...input,validation:{...input.validation,interimBase:true},decisions:{...input.decisions,seasonality:true},hires:[{id:'hire-1',count:1,function:'Technicien',department:'intrusion',jointCommittee:'cp200',startDate:'2027-07-01',annualSalary2027:60000,hasCompanyCar:false,annualCarLeaseBudget:null}],salaryIncreases:[{id:'raise-1',count:1,function:'Technicien',department:'intrusion',jointCommittee:'cp200',effectiveDate:'2027-07-01',annualSalary2026:50000,increaseRate:.05,hasCompanyCar:true,annualCarLeaseBudget:7200}],capexBudget:{...input.capexBudget,vehicles:{...input.capexBudget.vehicles,2027:100000}},debtForecast:{...input.debtForecast,openingCash2027:900000}};
  const saved=await call(`/v1/companies/${gimi.id}/budget-plan`,'PUT',inputChanged,cookie),savedPlan=(await saved.json()).data;
  expect(saved.status).toBe(200);expect(savedPlan.revision).toBe(1);expect(savedPlan.validation.interimBase).toBe(true);expect(savedPlan.decisions.seasonality).toBe(true);expect(savedPlan.hires[0].annualSalary2027).toBe(60000);expect(savedPlan.hires[0].annualSalary2026).toBeUndefined();expect(savedPlan.salaryIncreases[0].annualCarLeaseBudget).toBe(7200);expect(savedPlan.capexBudget.vehicles['2027']).toBe(100000);expect(savedPlan.debtForecast.openingCash2027).toBe(900000);
  expect((await call(`/v1/companies/${gimi.id}/budget-plan`,'PUT',inputChanged,cookie)).status).toBe(409);
  const reloaded=new Store(dir),persisted=await reloaded.getGimiBudgetPlan(gimi.id);expect(persisted.revision).toBe(1);expect(persisted.validation.interimBase).toBe(true);expect(persisted.decisions.seasonality).toBe(true);expect(persisted.capexBudget.vehicles[2027]).toBe(100000);expect(persisted.debtForecast.openingCash2027).toBe(900000);
});
