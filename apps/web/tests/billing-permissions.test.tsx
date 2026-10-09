import { expect, test } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Billing } from '../src/pages/TimeTracking';
const render=(editable:boolean)=>renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><Billing editable={editable} invoices={[]} rate={90} diverseHours={8} setRate={()=>{}} setDiverseHours={()=>{}} save={()=>{}} saving={false}/></QueryClientProvider>);
test('Equinoxe : utilisateur consulte et exporte, sans bouton de configuration refusé par le serveur',()=>{const html=render(false);expect(html).not.toContain('Enregistrer pour tous');expect(html).toContain('readonly');expect(html).toContain('Exporter Excel');});
test('Equinoxe : administration conserve la configuration de facturation',()=>{const html=render(true);expect(html).toContain('Enregistrer pour tous');expect(html).not.toContain('readonly');});
