import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';
import { config } from '../config';
import { OdooConnector, assertReadOnlyOdooMethod } from '../connectors/odoo';
import { companyOdooResolver } from '../connectors/company-odoo';
import { companyAvailable } from '../services/company-availability';
import { prepareEurodrill, type ReportingDocuments } from '../services/eurodrill-setup';

const dirs: string[] = [];
afterEach(async () => { await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'eurodrill-test-')); dirs.push(dir);
  const store = new Store(dir), auth = new AuthService(store); await auth.bootstrap();
  const source: ReportingDocuments = { companies: await store.companies.read(), dashboards: await store.dashboards.read(), sections: await store.pnlSections.read(), settings: await store.reportSettings.read() };
  return { dir, store, auth, source };
}

test('Eurodrill préparée : accès local explicite, droits conservés, statut partagé intact', async () => {
  const {store,auth,source}=await fixture(), prepared=prepareEurodrill(source,'2026-07');
  const company=prepared.company, before=config.localEurodrillEnabled;
  await store.companies.write(prepared.documents.companies);
  await store.dashboards.write(prepared.documents.dashboards);
  const app=createApp(store,auth);
  const login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})}));
  const cookie=login.headers.get('set-cookie')!.split(';')[0];
  const get=()=>app(new Request(`http://api/v1/companies/${company.id}/dashboards`,{headers:{cookie}}));
  try {
    config.localEurodrillEnabled=false; expect((await get()).status).toBe(403);
    config.localEurodrillEnabled=true; expect((await get()).status).toBe(200);
    expect((await (await get()).json()).data).toHaveLength(3);
    const admin=(await store.users.read())[0]; await store.users.write([{...admin,role:'viewer'}]);
    expect((await get()).status).toBe(403);
    await store.access.write([{userId:admin.id,companyId:company.id,createdAt:''}]);
    expect((await get()).status).toBe(200);
    await store.access.write([]); expect((await get()).status).toBe(403);
    expect((await store.companies.read()).find(row=>row.id===company.id)?.status).toBe('inactive');
    expect(companyAvailable(company,true,true)).toBe(false);
    expect(companyAvailable({...company,slug:'gimi'},true,false)).toBe(false);
    expect(companyAvailable({...company,connectorType:'none'},true,false)).toBe(false);
  } finally { config.localEurodrillEnabled=before; }
});

test('la connexion de l’aperçu n’écrase pas celle de l’application habituelle',async()=>{
  const {store,auth}=await fixture();
  const main=createApp(store,auth), preview=createApp(store,auth,undefined,undefined,undefined,undefined,'equinoxe_eurodrill_preview');
  const login=()=>new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})});
  const mainCookie=(await main(login())).headers.get('set-cookie')!.split(';')[0];
  const previewCookie=(await preview(login())).headers.get('set-cookie')!.split(';')[0];
  expect(mainCookie.startsWith('equinoxe_session=')).toBe(true);
  expect(previewCookie.startsWith('equinoxe_eurodrill_preview=')).toBe(true);
  const me=(cookie:string)=>new Request('http://api/v1/auth/me',{method:'POST',headers:{cookie}});
  expect((await main(me(previewCookie))).status).toBe(401);
  expect((await preview(me(mainCookie))).status).toBe(401);
  for(const app of [main,preview])expect((await app(me(`${mainCookie}; ${previewCookie}`))).status).toBe(200);
  const logout=await preview(new Request('http://api/v1/auth/logout',{method:'POST'}));
  expect(logout.headers.get('set-cookie')).toStartWith('equinoxe_eurodrill_preview=');
});

test('prépare trois rapports indépendants sans altérer Gimi, rejouer ou réactiver une société', async () => {
  const { source } = await fixture(), original = structuredClone(source);
  const prepared = prepareEurodrill(source, '2026-07');
  expect(source).toEqual(original);
  expect(prepared.company.status).toBe('inactive');
  expect(prepared.documents.dashboards.filter(row => row.companyId === prepared.company.id).map(row => row.slug)).toEqual(['compte-resultat', 'compte-resultat-ltm', 'compte-resultat-extrapole']);
  const sections = prepared.documents.sections.filter(row => row.companyId === prepared.company.id);
  const ids = new Set(sections.map(row => row.id));
  expect(sections.length).toBeGreaterThan(10);
  expect(sections.every(row => row.formula.every(term => ids.has(term.sectionId)))).toBe(true);
  expect(sections.every(row => !source.sections.some(old => old.id === row.id))).toBe(true);
  prepared.documents.settings.find(row => row.companyId === prepared.company.id)!.lastClosedMonth = '2026-06';
  const again = prepareEurodrill(prepared.documents, '2026-08');
  expect(again.created).toBe(false); expect(again.documents).toEqual(prepared.documents);
  expect(again.documents.settings.find(row => row.companyId === prepared.company.id)?.lastClosedMonth).toBe('2026-06');
});

test('sélection explicite Eurodrill : aucun repli vers Gimi et aucune écriture envoyée', async () => {
  const previous = { ...config.odoo.eurodrill }, requests: any[] = [];
  Object.assign(config.odoo.eurodrill, { baseUrl: 'https://eurodrill.example.invalid', database: 'eurodrill-fixture', username: 'fixture', apiKey: 'eurodrill-test-key' });
  try {
    const fetcher = (async (url: unknown, init: RequestInit) => { const request = JSON.parse(String(init.body)); requests.push({ url, ...request.params }); return Response.json({ result: 7 }); }) as typeof fetch;
    const resolver = companyOdooResolver(new OdooConnector(), fetcher);
    const company = { id: 'euro', name: 'Eurodrill', slug: 'eurodrill', connectorType: 'odoo', status: 'active', createdAt: '', updatedAt: '' } as const;
    const connector = resolver(company); await connector.testConnection();
    expect(requests[0].url).toBe('https://eurodrill.example.invalid/jsonrpc');
    expect(requests[0].args[0]).toBe('eurodrill-fixture');
    expect(requests[0].args[2]).toBe('eurodrill-test-key');
    await expect(resolver({ ...company, slug: 'unknown' }).testConnection()).rejects.toThrow('pas configurée');
    const before = requests.length;
    for (const method of ['create', 'write', 'unlink', 'action_post', 'button_cancel']) {
      expect(() => assertReadOnlyOdooMethod(method)).toThrow('lecture seule');
      expect(() => (connector as any).call(7, 'account.move', method, [])).toThrow('lecture seule');
    }
    expect(requests).toHaveLength(before);
  } finally { Object.assign(config.odoo.eurodrill, previous); }
});

test('trois rapports Eurodrill : périodes, extrapolation, données isolées et contrôle des accès', async () => {
  const { store, auth, source } = await fixture(), prepared = prepareEurodrill(source, '2026-07'), company = { ...prepared.company, status: 'active' as const };
  await store.companies.write(prepared.documents.companies.map(row => row.id === company.id ? company : row));
  await store.dashboards.write(prepared.documents.dashboards); await store.pnlSections.write(prepared.documents.sections); await store.reportSettings.write(prepared.documents.settings);
  const requests: any[] = [];
  const connector = new OdooConnector({ baseUrl: 'https://eurodrill.example.invalid', database: 'euro-fixture', username: 'fixture', apiKey: 'fixture', timeoutMs: 1000, retries: 0 }, (async (_url: unknown, init: RequestInit) => {
    const { params } = JSON.parse(String(init.body)); requests.push(params);
    if (params.service === 'common') return Response.json({ result: 7 });
    const [, , , model, method] = params.args;
    if (model === 'account.move.line' && method === 'search_read') return Response.json({ result: [] });
    if (model === 'account.move.line' && method === 'read_group') return Response.json({ result: [{ account_id: [1, '700000 Sales'], balance: -120 }, { account_id: [2, '600000 Purchases'], balance: 40 }] });
    if (model === 'account.account' && method === 'read') return Response.json({ result: [{ id: 1, code: '700000', name: 'Eurodrill sales', account_type: 'income' }, { id: 2, code: '600000', name: 'Purchases', account_type: 'expense' }] });
    throw new Error('Unexpected fixture request');
  }) as typeof fetch);
  const app = createApp(store, auth, undefined, undefined, undefined, requested => { expect(requested.id).toBe(company.id); return connector; });
  const login = await app(new Request('http://api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'admin@equinoxe.local', password: 'change-me-now' }) }));
  const cookie = login.headers.get('set-cookie')!.split(';')[0];
  const get = (suffix: string, session = cookie) => app(new Request(`http://api/v1/companies/${company.id}/${suffix}`, { headers: { cookie: session } }));
  const annual = await (await get('profit-loss')).json(), extrapolated = await (await get('profit-loss/extrapolated')).json(), ltm = await (await get('profit-loss/ltm')).json();
  const revenue = (report: any, year: string) => report.data.lines.find((line: any) => line.label === 'Chiffre d’affaires').values[year];
  expect(revenue(annual, '2026')).toBe(120); expect(revenue(extrapolated, '2026')).toBeCloseTo(120 * 12 / 7);
  expect(revenue(extrapolated, '2024')).toBe(120); expect(revenue(extrapolated, '2025')).toBe(120);
  expect(ltm.data.periods.map((p: any) => [p.start, p.end])).toEqual([['2023-08-01', '2024-07-31'], ['2024-08-01', '2025-07-31'], ['2025-08-01', '2026-07-31']]);
  const grouped = requests.filter(row => row.args[4] === 'read_group');
  expect(grouped.every(row => row.args[5][0].some((term: any) => JSON.stringify(term) === JSON.stringify(['parent_state', '=', 'posted'])))).toBe(true);
  expect(grouped.some(row => JSON.stringify(row.args[5]).includes('2026-07-31'))).toBe(true);
  const months = await (await get('profit-loss/months?year=2026')).json();
  expect(months.data.months).toHaveLength(7);
  expect(months.data.months.at(-1)).toBe('2026-07');
  expect((await get('profit-loss/accounts/1/entries?year=2026')).status).toBe(200);
  const ledger = requests.find(row => row.args[4] === 'search_read');
  expect(ledger.args[5][0]).toContainEqual(['date', '<=', '2026-07-31']);
  const user = { ...(await store.users.read())[0], id: 'reader', role: 'viewer' as const, email: 'reader@test.local' };
  await store.users.mutate(users => ({ values: [...users, user], result: null }));
  const readerLogin = await app(new Request('http://api/v1/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: user.email, password: 'change-me-now' }) }));
  const readerCookie = readerLogin.headers.get('set-cookie')!.split(';')[0];
  for (const path of ['profit-loss', 'profit-loss/ltm', 'profit-loss/extrapolated']) expect((await get(path, readerCookie)).status).toBe(403);
  await store.access.write([{ userId: user.id, companyId: company.id, createdAt: '' }]);
  expect((await get('profit-loss/ltm', readerCookie)).status).toBe(200);
  await store.access.write([]); expect((await get('profit-loss/ltm', readerCookie)).status).toBe(403);
  expect((await store.pnlSections.read()).filter(row => row.companyId !== company.id)).toEqual(source.sections);
});

import { prepareEurodrillBfr } from '../repositories/eurodrill-bfr';
test('BFR Eurodrill : copie indépendante, préservation et opération rejouable',async()=>{
  const {store,source}=await fixture(),prepared=prepareEurodrill(source,'2026-07');
  const sections=await store.bfrSections.read(),before=JSON.stringify(sections);
  const result=prepareEurodrillBfr(prepared.documents.companies,sections,prepared.documents.dashboards);
  const gimi=source.companies.find(c=>c.slug==='gimi')!,copied=result.sections.filter(s=>s.companyId===prepared.company.id),original=sections.filter(s=>s.companyId===gimi.id).sort((a,b)=>a.order-b.order);
  expect(copied).toHaveLength(original.length);expect(result.addedDashboards).toBe(1);
  expect(copied.map(s=>[s.label,s.sign,s.prefixes,s.order])).toEqual(original.map(s=>[s.label,s.sign,s.prefixes,s.order]));
  expect(copied.every(c=>!sections.some(s=>s.id===c.id))).toBe(true);
  copied[0].prefixes.push('999');expect(JSON.stringify(sections)).toBe(before);
  const again=prepareEurodrillBfr(prepared.documents.companies,result.sections,result.dashboards);
  expect(again.addedSections).toBe(0);expect(again.addedDashboards).toBe(0);expect(again.sections).toEqual(result.sections);
  expect(prepared.company.status).toBe('inactive');
});

test('BFR Eurodrill : sauvegarde isolée de Gimi, relecture et droits',async()=>{
 const {store,auth,source}=await fixture(),prepared=prepareEurodrill(source,'2026-07');
 prepared.company.status='active';await store.companies.write(prepared.documents.companies);
 const bfr=prepareEurodrillBfr(prepared.documents.companies,await store.bfrSections.read(),prepared.documents.dashboards);
 await store.bfrSections.write(bfr.sections);
 const unrelated=bfr.sections.filter(s=>s.companyId!==prepared.company.id),app=createApp(store,auth);
 const login=await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})}));
 const cookie=login.headers.get('set-cookie')!.split(';')[0],url=`http://api/v1/companies/${prepared.company.id}/bfr-sections`;
 const get=()=>app(new Request(url,{headers:{cookie}}));
 const sections=bfr.sections.filter(s=>s.companyId===prepared.company.id).map((s,i)=>i? s : {...s,label:'Stocks Eurodrill'});
 const save=()=>app(new Request(url,{method:'PUT',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({sections})}));
 expect((await save()).status).toBe(200);expect((await (await get()).json()).data[0].label).toBe('Stocks Eurodrill');
 expect((await store.bfrSections.read()).filter(s=>s.companyId!==prepared.company.id)).toEqual(unrelated);
 const admin=(await store.users.read())[0];await store.users.write([{...admin,role:'viewer'}]);
 expect((await get()).status).toBe(403);await store.access.write([{userId:admin.id,companyId:prepared.company.id,createdAt:''}]);
 expect((await get()).status).toBe(200);expect((await save()).status).toBe(403);
 await store.access.write([]);expect((await get()).status).toBe(403);
});
