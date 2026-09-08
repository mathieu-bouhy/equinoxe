import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CashEvolution } from '../src/pages/CashEvolution';
import type { CashEvolutionReport } from '@equinoxe/shared';

const report: CashEvolutionReport = {
  companyId: 'gimi', from: '2024-01-01', through: '2024-01-31', requestedThrough: '2024-01-31', importedAt: '2026-09-08T10:00:00Z',
  needsSync: false, opening: 100000, closing: 120000, movementCount: 1, accounts: [], days: [],
  months: [{ month: '2024-01', days: 31, opening: 100000, closing: 120000, movement: 20000, average: 115000, minimum: 100000, maximum: 120000,
    minimumDate: '2024-01-01', maximumDate: '2024-01-31', difference: 0 }],
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
