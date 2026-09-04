import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';
import { Store } from '../repositories/store';
import type { OdooConnector } from '../connectors/odoo';

const directories:string[]=[];
afterEach(async()=>Promise.all(directories.splice(0).map(directory=>rm(directory,{recursive:true,force:true}))));

describe('répartition analytique des comptes',()=>{
  test('synchronise les comptes Odoo puis conserve leur clé de répartition',async()=>{
    const directory=await mkdtemp(join(tmpdir(),'equinoxe-accounts-'));directories.push(directory);
    const store=new Store(directory),auth=new AuthService(store);await auth.bootstrap();
    const connector={getProfitLossAccounts:async()=>[{id:'60',code:'600000',label:'Achats'},{id:'70',code:'700007',label:'Contrat incendie'}]} as unknown as OdooConnector;
    const app=createApp(store,auth,connector),login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})})),cookie=login.headers.get('set-cookie')?.split(';')[0]??'',gimi=(await store.companies.read()).find(company=>company.slug==='gimi')!,now=new Date().toISOString();
    const key={id:'maintenance',companyId:gimi.id,label:'Incendie maintenance',intrusion:0,fireInstallation:0,fireMaintenance:100,led:0,order:0,createdAt:now,updatedAt:now};await store.analyticAllocationCodes.write([key]);
    const url=`http://api/v1/companies/${gimi.id}/account-analytic-allocations`,synced=await app(new Request(url,{headers:{cookie}})),rows=(await synced.json()).data;
    expect(synced.status).toBe(200);expect(rows).toHaveLength(2);expect(rows.find((row:{accountCode:string})=>row.accountCode==='700007').profitLossSectionLabel).toBe('Chiffre d’affaires');
    const target=rows.find((row:{accountCode:string})=>row.accountCode==='700007'),saved=await app(new Request(url,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({assignments:[{accountId:target.id,analyticAllocationCodeId:key.id}]})}));
    expect(saved.status).toBe(200);expect((await store.accountAnalyticAllocations.read()).find(row=>row.id===target.id)?.analyticAllocationCodeId).toBe(key.id);
  });
});
