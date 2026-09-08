import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { allocationFields, withCostAllocationKeys, salaryKeyId, vehicleKeyId } from '@equinoxe/shared';
import type { AllocationDepartment, AnalyticReportMode, ProfitLossSection, EmployeeAnalyticAllocation, AccountAnalyticAllocation, AnalyticAllocationCode } from '@equinoxe/shared';
import { analyticPeriods, buildAnalyticProfitLoss } from '../services/analytic-profit-loss';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';
import { OdooConnector } from '../connectors/odoo';

const section=(id:string,prefix:string,order:number):ProfitLossSection=>({id,companyId:'gimi',label:id==='sales'?'Chiffre d’affaires':id,kind:'accounts',prefixes:[prefix],formula:[],order,createdAt:'',updatedAt:''});
const sections=[section('sales','70',0),section('goods','60',1),section('sub','603',2),section('staff','62',3),section('cars','61',4),section('financial','65',6),section('tax','67',7)];
sections.push({...section('ebitda','',5),label:'EBITDA',kind:'calculation',prefixes:[],formula:['sales','goods','sub','staff','cars'].map(sectionId=>({sectionId,operator:'add'}))});
sections.push({...section('net','',8),label:'Résultat après impôts',kind:'calculation',prefixes:[],formula:['ebitda','financial','tax'].map(sectionId=>({sectionId,operator:'add'}))});
const fixed=(id:string,i:number,m:number):AnalyticAllocationCode=>({id,companyId:'gimi',label:id,fireInstallation:i,fireMaintenance:m,led:0,intrusion:0,order:0,createdAt:'',updatedAt:''});
const keys=withCostAllocationKeys([fixed('installation',100,0),fixed('maintenance',0,100),fixed('ca',75,25)],'gimi');
const employee=(id:string,assignment:string,car:number,entryDate='2020-01-01',endDate:string|null=null):EmployeeAnalyticAllocation=>({id,companyId:'gimi',firstName:id,lastName:id,fullName:id,function:'test',sourceDocumentId:'test',sourceRow:1,sourceSheet:'test',entryDate,endDate,annualSalaryCost:12000,annualCarCost:car,analyticAllocationCodeId:assignment,createdAt:'',updatedAt:''});
const employees=[employee('A','maintenance',2400),employee('B','installation',7200,'2026-02-02')];
test('écritures paginées : uniquement lecture, période bornée, liens sans secrets',async()=>{
  const requests:any[]=[];
  const connector=new OdooConnector({baseUrl:'https://odoo.example.invalid',database:'fixture',username:'fixture',apiKey:'secret-test-only',timeoutMs:1000,retries:0},(async(_url:unknown,init:RequestInit)=>{
    const {params}=JSON.parse(String(init.body));requests.push(params);
    if(params.service==='common')return Response.json({result:1});
    const after=params.args[5][0].find((d:any[])=>d[0]==='id')[2];
    return Response.json({result:after>=2?[]:[{id:after+1,date:'2026-01-15',name:'Test',partner_id:[1,'Partenaire'],move_id:[42,'FACT/42'],debit:0,credit:100}]});
  }) as typeof fetch);
  const rows=await connector.getAnalyticAccountEntries('123','2026-01-01','2026-02-28');
  expect(rows.map(r=>r.id)).toEqual(['1','2']);expect(rows[0].odooUrl).toBe('https://odoo.example.invalid/web#id=42&model=account.move&view_type=form');
  expect(JSON.stringify(rows)).not.toContain('secret-test-only');
  expect(requests.slice(1).every(p=>p.args[3]==='account.move.line'&&p.args[4]==='search_read')).toBe(true);
  for(const p of requests.slice(1)){expect(p.args[5][0]).toContainEqual(['parent_state','=','posted']);expect(p.args[5][0]).toContainEqual(['date','<=','2026-02-28']);}
  await expect(connector.getAnalyticAccountEntries('invalid','2026-01-01','2026-02-28')).rejects.toThrow('invalide');
});
const definitions=[['1','700001','installation',1000],['2','700007','maintenance',2000],['3','600001','ca',-300],['4','603001','maintenance',-40],['5','620000',salaryKeyId('gimi'),-400],['6','610022',vehicleKeyId('gimi'),-200],['7','650000','ca',-20],['8','670000','',-10]] as const;
const assignments=definitions.map(([id,code,key])=>({id,companyId:'gimi',odooAccountId:id,accountCode:code,accountLabel:code,profitLossSectionId:null,profitLossSectionLabel:null,analyticAllocationCodeId:key||null,createdAt:'',updatedAt:''}));
function fixture(mode:AnalyticReportMode='annual',selected:AllocationDepartment[]=['fireMaintenance']){
  const closed='2026-02',periods=analyticPeriods(mode,closed),months=[...new Set(periods.flatMap(p=>p.months))];
  const monthly=definitions.map(([id,,,amount])=>({accountId:id,values:Object.fromEntries(months.map((m)=>[m,amount*(m==='2026-02'?2:1)]))}));
  const accounts=definitions.map(([id,code])=>({id,code,label:code,values:Object.fromEntries(periods.map(p=>[p.key,p.months.reduce((s,m)=>s+(monthly.find(a=>a.accountId===id)!.values[m]??0),0)]))}));
  return {mode,closed,selected,keys,assignments,employees,sections,subsections:[],monthly,sourceLines:[{key:'fixture',label:'fixture',values:{},accounts}]};
}
test('périodes annuelles, LTM de 12 mois et extrapolation unique',()=>{
  const ltm=analyticPeriods('ltm','2026-07');expect(ltm.map(p=>[p.start,p.end,p.months.length])).toEqual([['2023-08-01','2024-07-31',12],['2024-08-01','2025-07-31',12],['2025-08-01','2026-07-31',12]]);
  expect(analyticPeriods('annual','2026-02').map(p=>p.months.length)).toEqual([12,12,2]);
  expect(analyticPeriods('extrapolated','2026-02').map(p=>p.factor)).toEqual([1,1,6]);
  expect(()=>analyticPeriods('ltm','2026-13')).toThrow();
});
for(const mode of ['annual','ltm','extrapolated'] as const)test(`${mode}: quatre départements + non-réparti = comptes sources, formules jusqu’au résultat final`,()=>{
  const input=fixture(mode),before=JSON.stringify(input),combined=buildAnalyticProfitLoss({...input,selected:allocationFields.map(f=>f.key)}),parts=allocationFields.map(f=>buildAnalyticProfitLoss({...input,selected:[f.key]}));
  for(const p of combined.periods){
    const sum=combined.lines.filter(l=>l.kind==='accounts').reduce((s,l)=>s+l.values[p.key],0)+combined.unallocated.reduce((s,a)=>s+a.values[p.key],0);
    expect(sum).toBeCloseTo(input.sourceLines[0].accounts.reduce((s,a)=>s+a.values[p.key],0)*p.factor,8);
    for(const line of combined.lines)expect(parts.reduce((s,r)=>s+r.lines.find(l=>l.key===line.key)!.values[p.key],0)).toBeCloseTo(line.values[p.key],8);
    expect(combined.lines.find(l=>l.key==='net')!.values[p.key]).toBeCloseTo(combined.lines.filter(l=>l.kind==='accounts').reduce((s,l)=>s+l.values[p.key],0),8);
  }
  expect(combined.lines.find(l=>l.key==='goods')!.accounts.map(a=>a.code)).toEqual(['600001']);expect(combined.lines.find(l=>l.key==='sub')!.accounts.map(a=>a.code)).toEqual(['603001']);
  expect(JSON.stringify(input)).toBe(before);expect(combined.unallocated.map(a=>a.code)).toEqual(['670000']);
});
test('parts salaire et voiture mensuelles distinctes, départ et absence de base',()=>{
  const input=fixture(),report=buildAnalyticProfitLoss(input);
  const staff=report.lines.find(l=>l.key==='staff')!,cars=report.lines.find(l=>l.key==='cars')!;
  expect(staff.monthlyValues['2026-02']).toBe(-400);expect(cars.monthlyValues['2026-02']).toBe(-100);
  expect(staff.values['2026']).toBe(-800);expect(cars.values['2026']).toBe(-300);
  const empty=buildAnalyticProfitLoss({...input,employees:[]});expect(empty.lines.find(l=>l.key==='staff')!.values['2026']).toBe(0);expect(empty.unallocated.map(a=>a.code)).toContain('620000');
  const departed=buildAnalyticProfitLoss({...input,employees:[{...employees[0],endDate:'2026-01-15'},employees[1]]});expect(departed.lines.find(l=>l.key==='staff')!.monthlyValues['2026-02']).toBe(0);
});
test('contrôles des montants et formules, sous-rubriques sans double compte',()=>{
  const input=fixture();expect(()=>buildAnalyticProfitLoss({...input,monthly:[]})).toThrow('Détail mensuel absent');
  expect(()=>buildAnalyticProfitLoss({...input,monthly:input.monthly.map(m=>({...m,values:{}}))})).toThrow('ne correspond pas');
  const cyclic=sections.map(s=>s.id==='net'?{...s,formula:[{sectionId:'net',operator:'add' as const}]}:s);expect(()=>buildAnalyticProfitLoss({...input,sections:cyclic})).toThrow('circulaire');
  const sub=(id:string,prefix:string)=>({id,companyId:'gimi',label:id,parentSectionId:'sales',prefixes:[prefix],order:0,createdAt:'',updatedAt:''});
  const report=buildAnalyticProfitLoss({...input,subsections:[sub('broad','70'),sub('specific','700007')]});expect(report.lines.find(l=>l.key==='sales')!.subsections.flatMap(s=>s.accounts).map(a=>a.code)).toEqual(['700007']);
});
test('API : accès, validation, rapports et écritures avec la même part et même période',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'equinoxe-analytic-pnl-'));
  try{
    const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();const company=(await store.companies.read()).find(c=>c.slug==='gimi')!;
    const input=fixture('extrapolated'),companyId=company.id;
    await store.pnlSections.write(sections.map(s=>({...s,companyId})));await store.pnlSubsections.write([]);
    await store.analyticAllocationCodes.write(keys.filter(k=>!k.basis).map(k=>({...k,companyId})));
    await store.employeeAnalyticAllocations.write(employees.map(e=>({...e,companyId})));
    await store.accountAnalyticAllocations.write(assignments.map(a=>({...a,companyId,analyticAllocationCodeId:a.analyticAllocationCodeId?.replace('system:salary:gimi',salaryKeyId(companyId)).replace('system:vehicle:gimi',vehicleKeyId(companyId))??null})));
    await store.reportSettings.write([{companyId,lastClosedMonth:'2026-02',updatedAt:''}]);
    let calls=0,entryRange:string[]=[];
    const connector={getProfitLoss:async()=>{calls++;return {years:[2024,2025,2026],lines:input.sourceLines};},getProfitLossAccountMonths:async()=>input.monthly,getAnalyticAccountEntries:async(id:string,start:string,end:string)=>{entryRange=[id,start,end];return [{id:'1',date:'2026-01-10',label:'fixture',partner:null,debit:400,credit:0,odooUrl:null},{id:'2',date:'2026-02-10',label:'fixture',partner:null,debit:800,credit:0,odooUrl:null}];}} as unknown as OdooConnector;
    const app=createApp(store,auth,connector),url=`http://api/v1/companies/${companyId}/profit-loss/analytic?mode=extrapolated&departments=fireMaintenance`;
    expect((await app(new Request(url))).status).toBe(401);expect(calls).toBe(0);
    const login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})})),cookie=login.headers.get('set-cookie')!.split(';')[0];
    expect((await app(new Request(url+'&departments=bad',{headers:{cookie}}))).status).toBe(422);
    expect((await app(new Request(url.replace('fireMaintenance','bad'),{headers:{cookie}}))).status).toBe(422);
    const response=await app(new Request(url,{headers:{cookie}})),data=(await response.json()).data;expect(response.status).toBe(200);expect(data.lines.find((l:any)=>l.key==='staff').values['2026']).toBe(-4800);expect(JSON.stringify(data)).not.toContain('annualSalaryCost');
    const detailUrl=url.replace('/analytic?','/analytic/entries?')+'&account=5&period=2026';const detail=await app(new Request(detailUrl,{headers:{cookie}}));expect(detail.status).toBe(200);const entries=(await detail.json()).data;expect(entries.allocatedTotal).toBe(-800);expect(entries.projectedTotal).toBe(-4800);expect(entryRange).toEqual(['5','2026-01-01','2026-02-28']);
    expect((await app(new Request(detailUrl+'&month=2026-03',{headers:{cookie}}))).status).toBe(422);
    const users=await store.users.read(),userId=users[0].id;await store.users.mutate(rows=>({values:rows.map(u=>({...u,role:'viewer' as const})),result:null}));
    expect((await app(new Request(url,{headers:{cookie}}))).status).toBe(403);
    await store.access.write([{userId,companyId,createdAt:''}]);expect((await app(new Request(url,{headers:{cookie}}))).status).toBe(200);
    await store.access.write([]);expect((await app(new Request(detailUrl,{headers:{cookie}}))).status).toBe(403);
  }finally{await rm(dir,{recursive:true,force:true});}
});
