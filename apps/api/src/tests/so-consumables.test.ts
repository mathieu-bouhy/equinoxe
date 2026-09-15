import { expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { soConsumablesYears, type SoConsumableAccount, type SoConsumablesSnapshot } from '@equinoxe/shared';
import { consumableAccountMap, classifyConsumableOrder, soOrderDate, validateSoConsumables } from '../services/so-consumables';
import { SoConsumablesRepository, type SoConsumablesStorage } from '../repositories/so-consumables';
import { OdooConnector } from '../connectors/odoo';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';

export const accounts:SoConsumableAccount[]=[{id:'1',code:'700001',keyId:'install',department:'fireInstallation',hasFire:true},{id:'2',code:'700003',keyId:'maint',department:'fireMaintenance',hasFire:true},{id:'3',code:'700000',keyId:'mixed',department:null,hasFire:true}];
export const fixture=():SoConsumablesSnapshot=>({version:1,companyId:'gimi',from:'2023-01-01',through:'2026-07-31',startedAt:'2026-09-09T10:00:00.000Z',importedAt:'2026-09-09T10:01:00.000Z',accounts,unlinkedInvoiceLines:2,orders:[
  {id:101,reference:'SO101',date:'2023-02-01',year:2023,currency:'EUR',department:'fireInstallation',status:'allocated',amount:180,lines:[{id:10,productId:1,label:'Consommable',quantity:2,unitPrice:100,discount:10,unitPriceHt:90,amount:180,tracked:true}],invoices:[{lineId:123,invoiceId:45,reference:'FACT/45',date:'2024-01-01',accountId:'1',accountCode:'700001',department:'fireInstallation'}]},
  {id:102,reference:'SO102',date:'2023-02-02',year:2023,currency:'EUR',department:'fireMaintenance',status:'allocated',amount:60,lines:[{id:11,productId:1,label:'Consommable',quantity:1,unitPrice:60,discount:0,unitPriceHt:60,amount:60,tracked:false}],invoices:[{lineId:124,invoiceId:46,reference:'FACT/46',date:'2024-01-01',accountId:'2',accountCode:'700003',department:'fireMaintenance'}]},
]});
test('année de commande locale, montants après remise, parts annuelles et pas d’extrapolation',()=>{
  const s=fixture();validateSoConsumables(s);const result=soConsumablesYears(s);
  expect(soOrderDate('2023-12-31 23:30:00')).toBe('2024-01-01');
  expect(result[0]).toMatchObject({year:2023,installation:180,maintenance:60,installationShare:.75,maintenanceShare:.25});
  expect(result[1].installation).toBe(0);expect(result[1].installationShare).toBeNull();
  const partial={...s,through:'2023-07-31',orders:[]};expect(soConsumablesYears(partial)[1].installation).toBeNull();
});
test('rattachements ambigus et devises exclues, contrôles de doublons et sommes',()=>{
  const s=fixture();expect(classifyConsumableOrder(s.orders.flatMap(o=>o.invoices),'EUR').status).toBe('ambiguous');
  expect(classifyConsumableOrder(s.orders[0].invoices,'USD').status).toBe('currency');
  expect(()=>validateSoConsumables({...s,orders:[...s.orders,s.orders[0]]})).toThrow('dupliqué');
  expect(()=>validateSoConsumables({...s,orders:[{...s.orders[0],amount:200}]})).toThrow('total');
  expect(()=>validateSoConsumables({...s,orders:[{...s.orders[0],lines:[{...s.orders[0].lines[0],quantity:3}]}]})).toThrow('Montant HT');
});
test('comptes classés selon les clés, jamais selon leur nom ou Gimi Type',()=>{
  const keys=[{id:'install',companyId:'gimi',label:'Libellé différent',fireInstallation:100,fireMaintenance:0,intrusion:0,led:0,order:0,createdAt:'',updatedAt:''},{id:'mixed',companyId:'gimi',label:'Clé mixte',fireInstallation:60,fireMaintenance:40,intrusion:0,led:0,order:1,createdAt:'',updatedAt:''}];
  const assignments=accounts.map(a=>({id:a.id,companyId:'gimi',odooAccountId:a.id,accountCode:a.code,accountLabel:'N’importe quel nom',profitLossSectionId:null,profitLossSectionLabel:null,analyticAllocationCodeId:a.keyId,createdAt:'',updatedAt:''}));
  const result=consumableAccountMap(accounts,assignments,keys,[]);
  expect(result[0].department).toBe('fireInstallation');expect(result[2]).toMatchObject({hasFire:true,department:null});
});
test('PostgreSQL requis, sans repli JSON',async()=>{await expect(new SoConsumablesRepository().read('gimi')).rejects.toThrow('PostgreSQL');});

test('Odoo : factures validées paginées, SO uniques, consommables seuls, remises et année du SO',async()=>{
  const ledger=Array.from({length:1001},(_,i)=>({id:i+1,date:'2025-01-01',move_id:[45,'FACT/45'],account_id:[1,'700001'],sale_line_ids:[10]}));
  const models:Record<string,any[]>={
    'sale.order.line':[{id:10,order_id:[101,'SO101'],product_id:[1,'Consommable'],name:'Consommable',product_uom_qty:2,price_unit:100,discount:10,price_reduce_taxexcl:90,price_subtotal:180},{id:11,order_id:[101,'SO101'],product_id:[2,'Service'],product_uom_qty:1,price_subtotal:900},{id:12,order_id:[101,'SO101'],product_id:[3,'Combo'],price_subtotal:500},{id:13,order_id:[101,'SO101'],product_id:[1,'Consommable'],is_downpayment:true,price_subtotal:300},{id:14,order_id:[101,'SO101'],product_id:[1,'Consommable'],name:'Remise précise',product_uom_qty:38,price_unit:8.18,discount:56.35,price_reduce_taxexcl:3.57,price_subtotal:135.71},{id:15,order_id:[101,'SO101'],product_id:[1,'Consommable'],name:'TVA incluse',product_uom_qty:1,price_unit:121,discount:0,price_subtotal:100,tax_id:[11]}],
    'sale.order':[{id:101,name:'SO101',state:'sale',date_order:'2023-02-01 10:00:00',order_line:[10,11,12,13,14,15],currency_id:[1,'EUR']}],
    'product.product':[{id:1,type:'consu',is_storable:true},{id:2,type:'service'},{id:3,type:'combo'}],
    'res.currency':[{id:1,name:'EUR'}],
    'account.tax':[{id:11,price_include:false,children_tax_ids:[21]},{id:21,price_include:true,children_tax_ids:[]}],
  };
  const calls:any[]=[];
  const connector=new OdooConnector({baseUrl:'https://odoo.invalid',database:'fixture',username:'fixture',apiKey:'fixture',timeoutMs:1000,retries:0},(async(_url:unknown,init:RequestInit)=>{
    const params=JSON.parse(String(init.body)).params;if(params.service==='common')return Response.json({result:1});
    const [,,,model,method,args,kwargs]=params.args;calls.push({model,method,args,kwargs});let result:any;
    if(method==='read')result=models[model].filter(row=>args[0].includes(row.id));
    else if(method==='search_count')result=ledger.length;
    else if(method==='search_read')result=ledger.filter(row=>row.id>args[0].find((d:any[])=>d[0]==='id')[2]).slice(0,kwargs.limit);
    else throw new Error('Méthode inattendue');return Response.json({result});
  }) as typeof fetch);
  const s=await connector.getSoConsumables('gimi','2026-07-31',accounts);
  expect(s.orders).toHaveLength(1);expect(s.orders[0].amount).toBeCloseTo(415.68,6);expect(s.orders[0].year).toBe(2023);expect(s.orders[0].lines).toHaveLength(3);expect(s.orders[0].lines.find(l=>l.id===14)!.sourceAmount).toBe(135.71);expect(s.orders[0].lines.find(l=>l.id===14)!.amount).toBe(135.68);expect(s.orders[0].lines.find(l=>l.id===14)!.unitPriceHt).toBeCloseTo(3.57057,6);expect(s.orders[0].lines.find(l=>l.id===15)!.unitPriceHt).toBe(100);expect(s.orders[0].invoices).toHaveLength(1001);
  expect(calls.every(c=>['read','search_read','search_count'].includes(c.method))).toBe(true);
  for(const c of calls.filter(c=>c.model==='account.move.line')){expect(c.args[0]).toContainEqual(['parent_state','=','posted']);expect(c.args[0]).toContainEqual(['move_id.move_type','=','out_invoice']);}
  expect(JSON.stringify(calls)).not.toContain('gimi_type');
});
test('API : admin uniquement, calcul explicite/relecture, configuration des comptes inchangée',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'equinoxe-consumables-test-'));
  try{
    const store=new Store(dir),auth=new AuthService(store);await auth.bootstrap();const company=(await store.companies.read()).find(c=>c.slug==='gimi')!;
    const snapshot={...fixture(),companyId:company.id};let saved:SoConsumablesSnapshot|null=null,calls=0;
    const repository:SoConsumablesStorage={read:async()=>saved,save:async s=>{validateSoConsumables(s);saved=structuredClone(s);}};
    const connector={getProfitLossAccounts:async()=>accounts,getSoConsumables:async()=>{calls++;return snapshot;}} as unknown as OdooConnector;
    const app=createApp(store,auth,connector,undefined,repository),url=`http://api/v1/companies/${company.id}/so-consumables`;
    const before=JSON.stringify(await store.accountAnalyticAllocations.read());
    expect((await app(new Request(url))).status).toBe(401);
    const login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})})),cookie=login.headers.get('set-cookie')!.split(';')[0];
    const req=(method='GET')=>app(new Request(url,{method,headers:{cookie}}));
    expect((await (await req()).json()).data).toBeNull();expect(calls).toBe(0);
    expect((await req('POST')).status).toBe(200);expect(calls).toBe(1);
    expect((await (await req()).json()).data.orders).toHaveLength(2);expect(calls).toBe(1);
    expect(JSON.stringify(await store.accountAnalyticAllocations.read())).toBe(before);
    const user=(await store.users.read())[0];await store.users.write([{...user,role:'viewer'}]);await store.access.write([{userId:user.id,companyId:company.id,createdAt:''}]);
    expect((await req()).status).toBe(403);expect((await req('POST')).status).toBe(403);expect(calls).toBe(1);
    await store.access.write([]);expect((await req()).status).toBe(403);
  }finally{await rm(dir,{recursive:true,force:true});}
});
