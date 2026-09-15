import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CashEvolution } from '../src/pages/CashEvolution';
import type { CashEvolutionReport } from '@equinoxe/shared';

const report: CashEvolutionReport = {
  companyId: 'gimi', from: '2024-01-01', through: '2024-01-31', requestedThrough: '2024-01-31', importedAt: '2026-09-08T10:00:00Z',
  needsSync: false, opening: 100000, closing: 120000, movementCount: 1, accounts: [], days: [],
  months: [{ month: '2024-01', days: 31, opening: 100000, closing: 120000, movement: 20000, average: 115000, minimum: 100000, maximum: 120000,
    minimumDate: '2024-01-01', maximumDate: '2024-01-31', difference: 0, accounts: [] }],
};
const render = (data: CashEvolutionReport | null, editable: boolean) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(['cash-history','gimi'],data);
  const html = renderToStaticMarkup(<QueryClientProvider client={client}><CashEvolution companyId="gimi" editable={editable}/></QueryClientProvider>);
  client.clear(); return html;
};
test('trésorerie : moyenne, plage minimum–maximum, unité et export présents', () => {
  const html = render(report,true);
  expect(html).toContain('Minimum–maximum'); expect(html).toContain('<strong>115</strong>');
  expect(html).toContain('Rapproché'); expect(html).toContain('Exporter le tableau CSV'); expect(html).toContain('Actualiser depuis Odoo');
  expect(html).toContain('jours calendaires');
});
test('lecteur : lecture et export seuls ; pas d’import', () => {
  const html = render(report,false); expect(html).toContain('Exporter le tableau CSV'); expect(html).not.toContain('Actualiser depuis Odoo');
  expect(render(null,false)).toContain('Un administrateur doit importer');
});
test('historique manquant ou partiel signalé explicitement', () => {
  expect(render(null,true)).toContain('Aucun historique enregistré');
  const html = render({...report,needsSync:true,requestedThrough:'2024-02-29'},true);
  expect(html).toContain('les mois manquants ne sont pas affichés à zéro');
});
test('Eurodrill : origine et limites visibles avec les soldes mensuels',()=>{
  const client=new QueryClient({defaultOptions:{queries:{retry:false,staleTime:Infinity}}});
  client.setQueryData(['cash-history','eurodrill'],{...report,companyId:'eurodrill'});
  const html=renderToStaticMarkup(<QueryClientProvider client={client}><CashEvolution companyId="eurodrill" companyName="Eurodrill" companySlug="eurodrill" editable={false}/></QueryClientProvider>);
  expect(html).toContain('Eurodrill'); expect(html).toContain('Fin de mois'); expect(html).toContain('Historique partiel');
  expect(html).not.toContain('Gimi'); client.clear();
});

import { CashMonthAccounts } from '../src/components/CashMonthAccounts';
test('détail mensuel : tous les comptes, même nuls, moyenne et solde négatif sans confusion', () => {
  const month={...report.months[0],accounts:[{id:1,code:'550001',label:'Compte nul',opening:0,closing:0,debit:0,credit:0,movement:0,average:0},{id:2,code:'550007',label:'Opticash',opening:-1000,closing:-2000,debit:0,credit:1000,movement:-1000,average:-1500}]};
  const html=renderToStaticMarkup(<CashMonthAccounts month={month}/>);
  expect(html).toContain('2 comptes inclus');expect(html).toContain('550001');expect(html).toContain('550007');
  expect(html).toContain('Moyenne');expect(html).toContain('Fin de mois');expect(html).toContain('Total du mois');
  expect(html).toContain('janvier 2024');expect(html).toContain('EUR');expect(html).toContain('>-2<');
});
