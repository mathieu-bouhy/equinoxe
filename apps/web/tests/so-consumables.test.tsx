import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PurchaseSoTable } from '../src/components/PurchaseSoTable';
import type { SoConsumablesSnapshot } from '@equinoxe/shared';
const snapshot:SoConsumablesSnapshot={version:1,companyId:'gimi',from:'2023-01-01',through:'2026-07-31',startedAt:'2026-09-09T10:00:00Z',importedAt:'2026-09-09T10:01:00Z',accounts:[],unlinkedInvoiceLines:3,orders:[{id:101,reference:'SO101',date:'2025-02-01',year:2025,currency:'EUR',department:'fireInstallation',status:'allocated',amount:123456.78,lines:[],invoices:[]}]};
function render(value:SoConsumablesSnapshot|null){const qc=new QueryClient();qc.setQueryData(['so-consumables','gimi'],value);qc.setQueryData(['report-settings','gimi'],{lastClosedMonth:'2026-07'});return renderToStaticMarkup(<QueryClientProvider client={qc}><PurchaseSoTable companyId="gimi"/></QueryClientProvider>);}
test('quatre lignes et quatre années, kEUR, centimes au survol, bouton et pourcentages',()=>{
  const html=render(snapshot);
  expect(html.match(/<tr[ >]/g)?.length).toBe(5);
  for(const year of [2023,2024,2025,2026])expect(html).toContain(`>${year}`);
  expect(html).toContain('Incendie installation — montant');expect(html).toContain('Incendie maintenance — part du total');
  expect(html).toContain('>123</button>');expect(html).toContain('123 456,78 EUR HT');expect(html).toContain('100');
  expect(html).toContain('Recalculer');expect(html).toContain('sans extrapolation');expect(html).not.toContain('Gimi Type');
  expect(html).toContain('3 lignes de facture');expect(html).not.toContain('Détail des SO consommables');
});
test('aucun import ne devient un tableau de faux zéros',()=>{const html=render(null);expect(html).toContain('Aucun résultat calculé');expect(html).not.toContain('Ventes de produits consommables par année');});
