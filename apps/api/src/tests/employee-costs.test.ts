import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { monthlyEmployeeCost, allocateAccountBySalary, employeePresent, salaryKeyId, sortEmployees, withCostAllocationKeys, type AnalyticAllocationCode, type EmployeeAnalyticAllocation, type ProfitLossReport, type ProfitLossSection, type AccountAnalyticAllocation } from '@equinoxe/shared';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';
import { buildMarginAnalysis } from '../services/margin-analysis';
import { OdooConnector } from '../connectors/odoo';
import { allocateAccountByMonthlyCost, vehicleKeyId } from '@equinoxe/shared';
const key=(id:string,installation:number):AnalyticAllocationCode=>({id,companyId:'gimi',label:id,intrusion:0,led:0,fireInstallation:installation,fireMaintenance:100-installation,order:0,createdAt:'',updatedAt:''});
const keys=[key('maintenance',0),key('installation',100),{...key('headcount',50),label:'Au nombre d’employés'}];
const employee=(id:string,change:Partial<EmployeeAnalyticAllocation>={}):EmployeeAnalyticAllocation=>({id,companyId:'gimi',sourceDocumentId:'fixture',sourceSheet:'fixture',sourceRow:1,firstName:id,lastName:id,fullName:id,entryDate:'2025-01-01',function:'Technicien',annualSalaryCost:12000,annualCarCost:2400,analyticAllocationCodeId:'maintenance',createdAt:'',updatedAt:'initial',...change});
test('mois d’entrée et de départ inclus, sans limite si date de fin absente',()=>{
  const person=employee('A',{entryDate:'2026-02-02',endDate:'2026-05-01'});
  expect(['2026-01','2026-02','2026-05','2026-06'].map(month=>employeePresent(person,month))).toEqual([false,true,true,false]);
  expect(employeePresent(employee('B'),'2030-01')).toBe(true);
});
test('tri par fonction puis nom/prénom, fonctions absentes en dernier',()=>{
  const rows=[employee('Z',{lastName:'Zulu'}),employee('A',{lastName:'Albert'}),employee('E',{function:'Électricien'}),employee('X',{function:null})];
  expect(sortEmployees(rows).map(row=>row.id)).toEqual(['E','A','Z','X']);expect(rows[0].id).toBe('Z');
});
test('les salaires et véhicules suivent les présences ; recalcul de la clé au nombre d’employés',()=>{
  const people=[employee('A',{endDate:'2026-02-15'}),employee('B',{entryDate:'2026-02-02',analyticAllocationCodeId:'installation',annualCarCost:4800}),employee('C',{analyticAllocationCodeId:'headcount'})];
  const january=monthlyEmployeeCost(people,keys,'2026-01','salary'),february=monthlyEmployeeCost(people,keys,'2026-02','salary'),march=monthlyEmployeeCost(people,keys,'2026-03','salary');
  expect(january.shares.fireMaintenance).toBe(1);expect(february.shares.fireMaintenance).toBe(.5);expect(march.shares.fireInstallation).toBe(1);
  const cars=monthlyEmployeeCost(people,keys,'2026-02','vehicle');expect(cars.globalTotal).toBe(800);expect(cars.shares.fireMaintenance).toBe(.375);expect(cars.shares.fireInstallation).toBe(.625);
  for(const row of [january,february,march,cars])expect(Object.values(row.departmentTotals).reduce((sum,n)=>sum+n,0)+row.unallocated).toBeCloseTo(row.globalTotal,8);
});
test('clé Salaire : mois pondérés par les écritures, montants signés, base absente en non réparti',()=>{
  const people=[employee('A'),employee('B',{entryDate:'2026-02-02',analyticAllocationCodeId:'installation'})];
  const result=allocateAccountBySalary({'2026-01':-100,'2026-02':-300},people,keys);
  expect(result['2026-01'].fireMaintenance).toBe(-100);expect(result['2026-02'].fireInstallation).toBe(-150);
  expect(Object.values(allocateAccountBySalary({'2026-01':100},[],keys)['2026-01']).reduce((a,b)=>a+b,0)).toBe(100);
  expect(allocateAccountBySalary({'2026-01':100},[],keys)['2026-01'].other).toBe(100);
  expect(allocateAccountBySalary({'2026-01':100},[employee('A',{annualSalaryCost:null})],keys)['2026-01'].other).toBe(100);
  expect(allocateAccountBySalary({'2026-01':100},[employee('A'),employee('B',{annualSalaryCost:null})],keys)['2026-01'].fireMaintenance).toBe(100);
  const mixed=allocateAccountBySalary({'2026-01':100},[employee('A'),employee('B',{analyticAllocationCodeId:null})],keys)['2026-01'];expect(mixed.other).toBe(50);
});
test('clé Voiture : base véhicule distincte des salaires, présence, sommes et absence de coûts',()=>{
  const people=[employee('A',{endDate:'2026-02-15'}),employee('B',{entryDate:'2026-02-02',annualCarCost:7200,analyticAllocationCodeId:'installation'})];
  const amounts={'2026-01':-100,'2026-02':-400,'2026-03':-200};
  const result=allocateAccountByMonthlyCost(amounts,people,keys,'vehicle');
  expect(result['2026-01'].fireMaintenance).toBe(-100);
  expect(result['2026-02'].fireInstallation).toBe(-300);
  expect(result['2026-02'].fireMaintenance).toBe(-100);
  expect(result['2026-03'].fireInstallation).toBe(-200);
  expect(allocateAccountBySalary(amounts,people,keys)['2026-02'].fireInstallation).toBe(-200);
  for(const [month,amount] of Object.entries(amounts)){
    expect(Object.values(result[month]).reduce((a,b)=>a+b,0)).toBeCloseTo(amount,8);
    expect(result[month].fireInstallation/amount).toBe(monthlyEmployeeCost(people,keys,month,'vehicle').shares.fireInstallation);
  }
  for(const cost of [null,0])expect(allocateAccountByMonthlyCost({'2026-01':-100},[employee('A',{annualCarCost:cost})],keys,'vehicle')['2026-01'].other).toBe(-100);
  expect(allocateAccountByMonthlyCost({'2026-01':100},[employee('A'),employee('B',{annualCarCost:null})],keys,'vehicle')['2026-01'].fireMaintenance).toBe(100);
  const unassigned=allocateAccountByMonthlyCost({'2026-01':100},[employee('A',{analyticAllocationCodeId:null})],keys,'vehicle');expect(unassigned['2026-01'].other).toBe(100);
  const virtual=withCostAllocationKeys(keys,'gimi');expect(withCostAllocationKeys(virtual,'gimi').filter(key=>key.basis==='vehicle')).toHaveLength(1);
  expect(monthlyEmployeeCost([employee('A',{analyticAllocationCodeId:vehicleKeyId('gimi')})],virtual,'2026-01','vehicle').unallocatedShare).toBe(1);
});
test('analyse de marge : clé Salaire mensuelle puis annualisation unique, contrôle des totaux',()=>{
  const sections=[{id:'sales',kind:'accounts',prefixes:['70'],order:0},{id:'goods',kind:'accounts',prefixes:['60'],order:1}] as ProfitLossSection[];
  const report:ProfitLossReport={years:[2024,2025,2026],source:'odoo',generatedAt:'',lines:[{key:'sales',label:'CA',values:{2024:0,2025:0,2026:0},accounts:[]},{key:'goods',label:'Achats',values:{2024:0,2025:0,2026:-400},accounts:[{id:'1',code:'600000',label:'Achats',values:{2024:0,2025:0,2026:-400}}]}]};
  const allKeys=withCostAllocationKeys(keys,'gimi'),assignments=[{odooAccountId:'1',accountCode:'600000',analyticAllocationCodeId:salaryKeyId('gimi')}] as AccountAnalyticAllocation[],people=[employee('A'),employee('B',{entryDate:'2026-02-02',analyticAllocationCodeId:'installation'})];
  const result=buildMarginAnalysis(report,sections,assignments,allKeys,people,'2026-02',[{accountId:'1',values:{'2026-01':-100,'2026-02':-300}}]);
  expect(result.blocks[1].rows[0].values[2026]).toBe(-900);expect(result.blocks[1].rows[1].values[2026]).toBe(-1500);expect(result.blocks[1].totals[2026]).toBe(-2400);
  expect(()=>buildMarginAnalysis(report,sections,assignments,allKeys,people,'2026-02')).toThrow('détail mensuel');
  const carAssignments=assignments.map(row=>({...row,analyticAllocationCodeId:vehicleKeyId('gimi')})),carPeople=people.map(person=>person.id==='B'?{...person,annualCarCost:7200}:person);
  const carResult=buildMarginAnalysis(report,sections,carAssignments,allKeys,carPeople,'2026-02',[{accountId:'1',values:{'2026-01':-100,'2026-02':-300}}]);
  expect(carResult.blocks[1].rows[0].values[2026]).toBe(-1350);expect(carResult.blocks[1].rows[1].values[2026]).toBe(-1050);expect(carResult.blocks[1].totals[2026]).toBe(-2400);
  expect(()=>buildMarginAnalysis(report,sections,carAssignments,allKeys,carPeople,'2026-02')).toThrow('Voiture');
});
test('Odoo lit seulement les comptes ciblés, groupés par mois, avec écritures validées',async()=>{
  const calls:any[]=[],network=(async(_url:unknown,init:RequestInit)=>{const payload=JSON.parse(init.body as string);calls.push(payload.params);return Response.json({result:payload.params.service==='common'?1:[{account_id:[123,'Achats'],balance:100,__range:{'date:month':{from:'2026-02-01',to:'2026-03-01'}}}]});}) as typeof fetch;
  const connector=new OdooConnector({baseUrl:'https://example.invalid',username:'fixture',database:'fixture',apiKey:'fixture',timeoutMs:1000,retries:0},network);
  expect(await connector.getProfitLossAccountMonths(['123'],[2024,2025,2026],'2026-08-31')).toEqual([{accountId:'123',values:{'2026-02':-100}}]);
  expect(calls[1].args[4]).toBe('read_group');expect(calls[1].args[5][0]).toContainEqual(['parent_state','=','posted']);expect(calls[1].args[5][0]).toContainEqual(['date','<=','2026-08-31']);
});
test('API : fin persistante, modification ciblée, dates invalides, concurrence et clés protégées',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'equinoxe-employee-test-'));
  try{
    const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();const company=(await store.companies.read()).find(c=>c.slug==='gimi')!;
    await store.analyticAllocationCodes.write(keys.map(key=>({...key,companyId:company.id})));
    await store.employeeAnalyticAllocations.write([employee('A',{companyId:company.id}),employee('B',{companyId:company.id})]);
    const app=createApp(store,auth),login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})})),cookie=login.headers.get('set-cookie')!.split(';')[0],url=`http://api/v1/companies/${company.id}/employee-analytic-allocations`;
    const save=(item:object)=>app(new Request(url,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({assignments:[item]})}));
    expect((await save({employeeId:'A',endDate:'2026-02-15',expectedUpdatedAt:'initial'})).status).toBe(200);
    const reopened=new Store(dir);expect((await reopened.employeeAnalyticAllocations.read())[0].endDate).toBe('2026-02-15');
    expect((await save({employeeId:'A',analyticAllocationCodeId:'installation'})).status).toBe(200);
    expect((await store.employeeAnalyticAllocations.read())[0].endDate).toBe('2026-02-15');
    expect((await store.employeeAnalyticAllocations.read())[1].updatedAt).toBe('initial');
    for(const endDate of ['2026-02-30','2024-12-31'])expect((await save({employeeId:'A',endDate})).status).toBe(422);
    expect((await save({employeeId:'A',endDate:null,expectedUpdatedAt:'initial'})).status).toBe(409);
    expect((await save({employeeId:'A',analyticAllocationCodeId:salaryKeyId(company.id)})).status).toBe(422);
    expect((await save({employeeId:'A',analyticAllocationCodeId:vehicleKeyId(company.id)})).status).toBe(422);
    expect((await save({employeeId:'A',endDate:null})).status).toBe(200);expect((await reopened.employeeAnalyticAllocations.read())[0].endDate).toBeNull();
    const keyResponse=await app(new Request(`http://api/v1/companies/${company.id}/analytic-allocation-codes`,{headers:{cookie}}));expect((await keyResponse.json()).data.some((key:any)=>key.basis==='salary')).toBe(true);
    expect((await store.analyticAllocationCodes.read()).some(key=>key.id===salaryKeyId(company.id))).toBe(false);
    await store.accountAnalyticAllocations.write([{id:'account',companyId:company.id,odooAccountId:'123',accountCode:'620000',accountLabel:'Salaires',profitLossSectionId:null,profitLossSectionLabel:null,analyticAllocationCodeId:null,createdAt:'',updatedAt:''}]);
    const accountResponse=await app(new Request(`http://api/v1/companies/${company.id}/account-analytic-allocations`,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({assignments:[{accountId:'account',analyticAllocationCodeId:salaryKeyId(company.id)}]})}));
    expect(accountResponse.status).toBe(200);expect((await reopened.accountAnalyticAllocations.read())[0].analyticAllocationCodeId).toBe(salaryKeyId(company.id));
    const carResponse=await app(new Request(`http://api/v1/companies/${company.id}/account-analytic-allocations`,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({assignments:[{accountId:'account',analyticAllocationCodeId:vehicleKeyId(company.id)}]})}));
    expect(carResponse.status).toBe(200);expect((await reopened.accountAnalyticAllocations.read())[0].analyticAllocationCodeId).toBe(vehicleKeyId(company.id));
    const codesUrl=`http://api/v1/companies/${company.id}/analytic-allocation-codes`;
    const codes=(await (await app(new Request(codesUrl,{headers:{cookie}}))).json()).data;
    expect(codes.find((key:any)=>key.id===vehicleKeyId(company.id))).toMatchObject({label:'Voiture',basis:'vehicle'});
    expect((await app(new Request(codesUrl,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({codes})}))).status).toBe(200);
    expect(await reopened.analyticAllocationCodes.read()).toHaveLength(keys.length);
    expect((await reopened.accountAnalyticAllocations.read())[0].analyticAllocationCodeId).toBe(vehicleKeyId(company.id));
    expect((await app(new Request(codesUrl,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({codes:[{...keys[0],label:'Voiture'}]})}))).status).toBe(409);
    await store.users.mutate(users=>({values:users.map(user=>({...user,role:'viewer' as const})),result:null}));
    expect((await save({employeeId:'A',endDate:'2026-03-01'})).status).toBe(403);
  }finally{await rm(dir,{recursive:true,force:true});}
});
