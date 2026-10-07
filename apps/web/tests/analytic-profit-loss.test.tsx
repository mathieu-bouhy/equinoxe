import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AnalyticProfitLossReport, AnalyticReportMode } from '@equinoxe/shared';
import { AnalyticDepartmentSelector, AnalyticReport, GimiProfitLoss } from '../src/components/AnalyticProfitLoss';

test('quatre cases dans l’ordre demandé et retour explicite à la société entière',()=>{
  const html=renderToStaticMarkup(<AnalyticDepartmentSelector value={['fireMaintenance','led']} onChange={()=>{}}/>);
  expect(html.match(/type="checkbox"/g)).toHaveLength(4);
  expect(html.match(/checked=""/g)).toHaveLength(2);
  const labels=['Incendie installation','Incendie maintenance','Intrusion','LED'];
  expect(labels.map(label=>html.indexOf(label))).toEqual(labels.map(label=>html.indexOf(label)).sort((a,b)=>a-b));
  expect(html).toContain('aria-pressed="false"');expect(html).toContain('Société entière');
});
for(const mode of ['annual','ltm','extrapolated'] as const)test(`${mode} conserve par défaut le composant global existant`,()=>{
  const html=renderToStaticMarkup(<GimiProfitLoss companyId="gimi" mode={mode} closed="2026-07"><div>Rapport global original</div></GimiProfitLoss>);
  expect(html).toContain('Rapport global original');expect(html).toContain('aria-pressed="true"');expect(html).not.toContain('checked=""');
});

function analyticReport(mode:AnalyticReportMode):AnalyticProfitLossReport {
  const key=mode==='ltm'?'ltm-2026-09':'2026';
  return {
    mode,departments:['led'],lastClosedMonth:'2026-09',revenueKey:'revenue',unallocated:[],warnings:[],generatedAt:'2026-10-07T10:00:00.000Z',
    periods:[{key,label:mode==='ltm'?'Oct. 2025 – sept. 2026':'2026',start:'2026-01-01',end:'2026-09-30',months:['2026-01'],factor:mode==='extrapolated'?4/3:1}],
    lines:[
      {key:'revenue',label:'Chiffre d’affaires',kind:'accounts',values:{[key]:1_000_000},monthlyValues:{'2026-01':100_000},accounts:[],subsections:[]},
      {key:'goods',label:'Marchandises',kind:'accounts',values:{[key]:-250_000},monthlyValues:{'2026-01':-25_000},accounts:[],subsections:[]},
    ],
  };
}

for(const mode of ['annual','ltm','extrapolated'] as const)test(`${mode} affiche le budget société et l’écart dans la sélection analytique`,()=>{
  const departments=['led'] as const,client=new QueryClient(),report=analyticReport(mode);
  client.setQueryData(['analytic-profit-loss','gimi',mode,[...departments],'2026-09'],report);
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><AnalyticReport companyId="gimi" mode={mode} departments={[...departments]} closed="2026-09"/></QueryClientProvider>);
  expect(html).toContain('Budget 2026 — société');
  expect(html).toContain('Écart sélection vs budget société');
  expect(html).toContain('Budget 2026 de la société entière');
  expect(html.replaceAll('\u202f','')).toContain(mode==='annual'?'6009':'8012');
});
