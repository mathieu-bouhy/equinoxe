import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AccountAnalyticAllocation, AccountAllocationAmounts } from '@equinoxe/shared';
import { AccountAllocationTable } from '../src/components/AccountAllocationTable';
const accounts:AccountAnalyticAllocation[]=[{id:'saved-id',companyId:'gimi',odooAccountId:'60',accountCode:'600000',accountLabel:'Achats',profitLossSectionId:'purchases',profitLossSectionLabel:'Marchandises',analyticAllocationCodeId:null,createdAt:'',updatedAt:''}];
const amounts:AccountAllocationAmounts={lastClosedMonth:'2026-07',through:'2026-07-31',generatedAt:'',accounts:[{accountId:'60',amount2025:-123456,amount2026:-240000}]};
const render=(props:Partial<Parameters<typeof AccountAllocationTable>[0]>={})=>renderToStaticMarkup(<AccountAllocationTable accounts={accounts} allocationKeys={[]} onChange={()=>{}} amounts={amounts} {...props}/>);
test('deux colonnes annuelles, signes, kEUR, identifiant Odoo et rubriques préservés',()=>{
  const html=render();expect(html).toContain('>2025</th>');expect(html).toContain('>2026 extrapolé</th>');
  expect(html).toContain('>-123</td>');expect(html).toContain('>-240</td>');expect(html).toContain('colSpan="5"');
  expect(html).toContain('milliers d’euros');expect(html).toContain('Clé de répartition du compte 600000');expect(html).toContain('Non affecté — à préciser');
});
test('erreur, chargement et absence ne deviennent pas des zéros ; clés toujours disponibles',()=>{
  const failed=render({amountsError:true});expect(failed).toContain('Montants Odoo indisponibles');expect(failed).toContain('>—</td>');expect(failed).not.toContain('>-240</td>');expect(failed).toContain('<select');
  expect(render({amountsLoading:true})).toContain('>…</td>');expect(render({amounts:undefined})).toContain('>—</td>');
  expect(render({amounts:{...amounts,accounts:[{accountId:'60',amount2025:0,amount2026:0}]}})).toContain('>0</td>');
});
