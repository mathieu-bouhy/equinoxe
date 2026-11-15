import { expect,test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient,QueryClientProvider } from '@tanstack/react-query';
import type { ProfitLossLine,ProfitLossMonthlyReport,ProfitLossReport } from '@equinoxe/shared';
import { LonneuxAnalysis } from '../src/pages/LonneuxAnalysis';

const labels=['Chiffre d’affaires','Marchandises','Marge brute','Sous-traitance','Services et biens divers','Personnel','EBITDA'];
const lines:ProfitLossLine[]=labels.map((label,index)=>({key:String(index),label,values:{'2025':987654321,'2026':index===0?100000:index===6?10000:-10000},accounts:index===4?[{id:'1',code:'610000',label:'Compte Lonneux',values:{'2025':987654321,'2026':-10000}}]:[]}));
const annual:ProfitLossReport={years:[2024,2025,2026],lines,generatedAt:'2026-09-30T12:00:00Z',source:'odoo'};
const monthly:ProfitLossMonthlyReport={year:2026,months:['2026-01'],lines:lines.map(line=>({key:line.key,label:line.label,values:{'2026-01':line.values['2026']}})),generatedAt:'2026-09-30T12:00:00Z',source:'odoo'};

test('le reporting Lonneux conserve ses sources, ses absences et le personnel en bas',()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  client.setQueryData(['profit-loss','lonneux','lonneux-reporting','2026-09'],annual);
  client.setQueryData(['profit-loss-months','lonneux',2026,'lonneux-reporting','2026-09'],monthly);
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><LonneuxAnalysis companyId="lonneux" closed="2026-09"/></QueryClientProvider>);
  expect(html).toContain('Excel 2024–2025 · Odoo 2026 avec factures non validées');
  expect(html).toContain('comparaison YTD N−1 indisponible');
  expect(html).toContain('Budget Lonneux et mouvements RH : non disponibles');
  expect(html).toContain('Entrées');expect(html).toContain('Sorties');
  expect(html.indexOf('PERSONNEL · LECTURE RH ET FINANCIÈRE')).toBeGreaterThan(html.indexOf('EXPLIQUER LES ÉCARTS'));
  expect(html).not.toContain('987654321');expect(html).not.toContain('La croissance crée-t-elle de la marge');
  client.clear();
});
