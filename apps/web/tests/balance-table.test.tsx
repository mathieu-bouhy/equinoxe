import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BalanceTable, visibleBalanceAccounts } from '../src/components/BalanceTable';
import { CompanyBalanceSheet } from '../src/components/CompanyBalanceSheet';
import type { BalanceReport } from '@equinoxe/shared';

const report:BalanceReport={years:[2024,2025,2026],source:'mixed',generatedAt:'2026-09-08T00:00:00Z',assets:[{key:'cash',label:'Trésorerie',values:{'2024':100000,'2025':200000},accounts:[{id:'550000',code:'550000',label:'Banque',values:{'2024':100000,'2025':200000}}]}],liabilities:[],periods:[{year:2024,source:'history',asOf:'2024-12-31',status:'available',warnings:[]},{year:2025,source:'history',asOf:'2025-12-31',status:'available',warnings:[]},{year:2026,source:'odoo',asOf:'2026-08-31',status:'unavailable',warnings:['Odoo indisponible.']}]};
test('Actif et Passif ont chacun leurs trois colonnes annuelles dans le tableau',()=>{
  const html=renderToStaticMarkup(<BalanceTable report={report}/>);
  for(const year of report.years)expect(html.match(new RegExp(`<th scope="col">${year}</th>`,'g'))).toHaveLength(2);
  expect(html).toContain('aria-label="Bilan Actif"');expect(html).toContain('aria-label="Bilan Passif"');
  expect(html).toContain('<td>100</td>');expect(html).toContain('<td>200</td>');expect(html).toContain('<td>—</td>');
  expect(html).not.toContain('class="balance-years"');
});
test('les comptes nuls sont masqués, pas ceux dont une période est inconnue',()=>{
  const make=(values:Record<string,number>)=>({id:'1',code:'550000',label:'Banque',values});
  expect(visibleBalanceAccounts([make({'2024':0,'2025':0,'2026':0})],report.years)).toHaveLength(0);
  expect(visibleBalanceAccounts([make({'2024':0,'2025':0})],report.years)).toHaveLength(1);
  expect(visibleBalanceAccounts([make({'2024':0,'2025':-1,'2026':0})],report.years)).toHaveLength(1);
});
for(const state of ['loading','error'] as const)test(`pont ${state} : le bilan reste visible`,()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,retryOnMount:false,staleTime:Infinity}}});
  client.setQueryData(['balance','lonneux'],report);
  if(state==='error')client.getQueryCache().build(client,{queryKey:['cash-flow','lonneux']}).setState({status:'error',error:new Error('Échec Odoo'),fetchStatus:'idle'});
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><CompanyBalanceSheet companyId="lonneux" renderCashFlow={()=><p>Pont chargé</p>}/></QueryClientProvider>);
  expect(html).toContain('Bilan Actif');expect(html).toContain('<td>200</td>');
  if(state==='error')expect(html).toContain('Le pont de trésorerie est indisponible');
  client.clear();
});
test('Eurodrill : bilan autonome sans pont de trésorerie',()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  client.setQueryData(['balance','eurodrill'],report);
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><CompanyBalanceSheet companyId="eurodrill" showCashFlow={false} renderCashFlow={()=><p>Pont chargé</p>}/></QueryClientProvider>);
  expect(html).toContain('Bilan Actif'); expect(html).not.toContain('Pont chargé');
  expect(client.getQueryCache().find({queryKey:['cash-flow','eurodrill']})?.isActive()).toBe(false);
  client.clear();
});
