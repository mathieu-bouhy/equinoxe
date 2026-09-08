import { afterEach, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CashHistorySnapshot, CashMovement } from '@equinoxe/shared';
import { buildCashEvolution, cashCutoff, cashMonthlyCsv } from '../services/cash-history';
import { CashHistoryRepository, type CashHistoryStorage } from '../repositories/cash-history';
import { OdooConnector } from '../connectors/odoo';
import { Store } from '../repositories/store';
import { AuthService } from '../auth/service';
import { createApp } from '../http/app';

const movement = (id: number, date: string, debit: number, credit = 0): CashMovement => ({ id, date, debit, credit, accountId: 1, moveId: id, label: 'Fixture' });
const fixture = (): CashHistorySnapshot => ({ version: 1, companyId: 'gimi', source: 'odoo', currency: 'EUR', accountPrefix: '5',
  from: '2024-01-01', through: '2026-07-31', startedAt: '2026-09-08T00:00:00.000Z', importedAt: '2026-09-08T00:00:01.000Z',
  accounts: [{ id: 1, code: '550000', label: 'Banque', opening: 100, closing: 110 }],
  movements: [movement(1, '2024-01-01', 20), movement(2, '2024-01-31', 0, 10)],
  monthlyControls: Array.from({ length: 31 }, (_, index) => ({ month: new Date(Date.UTC(2024, index, 1)).toISOString().slice(0,7), closing: 110, difference: 0 })),
});

test('soldes journaliers, week-ends, année bissextile, 31 mois et moyenne non arrondie', () => {
  const snapshot = fixture(), before = JSON.stringify(snapshot), report = buildCashEvolution(snapshot, cashCutoff('2026-07'));
  expect(report.months).toHaveLength(31); expect(report.days).toHaveLength(943);
  expect(report.months[0]).toMatchObject({ days: 31, minimum: 110, maximum: 120, minimumDate: '2024-01-31', maximumDate: '2024-01-01', closing: 110, difference: 0 });
  expect(report.months[0].average).toBeCloseTo((30 * 120 + 110) / 31, 10);
  expect(report.months[1]).toMatchObject({ days: 29, average: 110, minimum: 110, maximum: 110 });
  expect(JSON.stringify(snapshot)).toBe(before);
});
test('bornage enregistré, absence de faux zéros futurs, historique 2024-2025 stable', () => {
  const snapshot = fixture(), report = buildCashEvolution(snapshot, cashCutoff('2025-12'));
  expect(report.months).toHaveLength(24); expect(report.through).toBe('2025-12-31'); expect(report.needsSync).toBe(false);
  expect(buildCashEvolution(snapshot, cashCutoff('2026-08')).needsSync).toBe(true);
  expect(buildCashEvolution(snapshot, cashCutoff('2026-08')).months).toHaveLength(31);
  expect(cashCutoff('2024-02')).toBe('2024-02-29'); expect(() => cashCutoff('2023-12')).toThrow(); expect(() => cashCutoff('2026-13')).toThrow();
  expect(report.months).toEqual(buildCashEvolution(snapshot, snapshot.through).months.slice(0,24));
});
test('soldes négatifs, précision centimes et extrema fin de journée uniquement', () => {
  const snapshot = fixture(); snapshot.accounts[0].opening = 0;
  snapshot.movements = [movement(1, '2024-01-01', .1), movement(2, '2024-01-01', .2), movement(3, '2024-01-01', 0, 10.3)];
  const report = buildCashEvolution(snapshot, '2024-01-31');
  expect(report.days[0].closing).toBe(-10); expect(report.months[0].maximum).toBe(-10); expect(report.months[0].minimum).toBe(-10);
  expect(report.months[0].difference).toBe(-120);
});
test('doublons, comptes inconnus et contrôles manquants bloquent le calcul', () => {
  const snapshot = fixture(); snapshot.movements.push(snapshot.movements[0]); expect(() => buildCashEvolution(snapshot,snapshot.through)).toThrow('dupliqué');
  snapshot.movements.pop(); snapshot.movements[0].accountId = 2; expect(() => buildCashEvolution(snapshot,snapshot.through)).toThrow('périmètre');
  snapshot.movements[0].accountId = 1; snapshot.monthlyControls = []; expect(() => buildCashEvolution(snapshot,snapshot.through)).toThrow('manquant');
});
test('export CSV mensuel Excel : BOM, centimes, jours et contrôles', () => {
  const csv = cashMonthlyCsv(buildCashEvolution(fixture(),'2024-01-31'));
  expect(csv.startsWith('\uFEFFMois;')).toBe(true); expect(csv.split('\r\n')).toHaveLength(2);
  expect(csv).toContain('2024-01;31;100,00;119,68;110,00;2024-01-31;120,00;2024-01-01;110,00;10,00;0,00');
});
test('absence PostgreSQL : aucun repli JSON', async () => {
  await expect(new CashHistoryRepository().read('gimi')).rejects.toThrow('PostgreSQL');
});

test('connecteur : pagination intégrale, archived inclus, posted seul, ouverture et contrôle indépendant', async () => {
  const calls: any[] = [], lines = Array.from({ length: 1001 }, (_, i) => ({ id: i + 1, date: '2024-01-15', account_id: [1,'Banque'], move_id: [i + 1,'Écriture'], name: 'Fixture', debit: 1, credit: 0 }));
  const fetcher = (async (_url: unknown, init: RequestInit) => {
    const params = JSON.parse(init.body as string).params; calls.push(params);
    if (params.service === 'common') return Response.json({ result: 1 });
    const [, , , model, method, args, kwargs] = params.args;
    let result: unknown;
    if (model === 'account.account') result = args[0].some((part: any[]) => part[0] === 'id' && part[2] > 0) ? [] : [{ id: 1, code: '550000', name: 'Banque' }];
    else if (method === 'search_read') {
      const after = args[0].find((part: any[]) => part[0] === 'id')[2]; result = lines.filter(row => row.id > after).slice(0,kwargs.limit);
    } else if (args[2][0] === 'date:month') result = [{ balance: 1001, __range: { 'date:month': { from: '2024-01-01' } } }];
    else result = [{ account_id: [1,'Banque'], balance: args[0].some((part: any[]) => part[2] === '2023-12-31') ? 100 : 1101 }];
    return Response.json({ result });
  }) as typeof fetch;
  const connector = new OdooConnector({ baseUrl: 'https://odoo.invalid', database: 'fixture', username: 'fixture', apiKey: 'fixture', timeoutMs: 5000, retries: 0 }, fetcher);
  const snapshot = await connector.getCashHistory('gimi','2024-01-31');
  expect(snapshot.movements).toHaveLength(1001); expect(snapshot.accounts[0].opening).toBe(100);
  expect(buildCashEvolution(snapshot,snapshot.through).months[0].difference).toBe(0);
  const objectCalls = calls.filter(call => call.service === 'object');
  expect(objectCalls.every(call => ['search_read','read_group'].includes(call.args[4]))).toBe(true);
  expect(objectCalls.filter(call => call.args[3] === 'account.move.line').every(call => call.args[5][0].some((part: any[]) => part[0] === 'parent_state' && part[2] === 'posted'))).toBe(true);
  expect(objectCalls.filter(call => call.args[3] === 'account.account')[0].args[6].context.active_test).toBe(false);
});

const dirs: string[] = [];
afterEach(async () => { for (const dir of dirs.splice(0)) await rm(dir,{recursive:true,force:true}); });
test('API : import, relecture, export, contrôle, droits lecteur et accès retiré', async () => {
  const dir = await mkdtemp(join(tmpdir(),'equinoxe-cash-test-')); dirs.push(dir);
  const store = new Store(dir), auth = new AuthService(store); await auth.bootstrap();
  const company = (await store.companies.read()).find(row => row.slug === 'gimi')!;
  const snapshot = { ...fixture(), companyId: company.id }; let saved: CashHistorySnapshot | null = null, imports = 0;
  const repository: CashHistoryStorage = { read: async () => saved, save: async value => { saved = structuredClone(value); } };
  const connector = { getCashHistory: async () => { imports++; return snapshot; } } as unknown as OdooConnector;
  const app = createApp(store, auth, connector, repository);
  const login = await app(new Request('http://api/v1/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'admin@equinoxe.local',password:'change-me-now'})}));
  const cookie = login.headers.get('set-cookie')!.split(';')[0], url = `http://api/v1/companies/${company.id}/cash-history`;
  const call = (method = 'GET', suffix = '') => app(new Request(url + suffix,{method,headers:{cookie}}));
  await store.reportSettings.mutate(rows => ({ values: rows.map(row => row.companyId === company.id ? {...row,lastClosedMonth:'2026-07'} : row), result: null }));
  expect((await app(new Request(url))).status).toBe(401);
  expect((await (await call()).json()).data).toBeNull(); expect(imports).toBe(0);
  expect((await call('POST')).status).toBe(200); expect(imports).toBe(1);
  expect((await (await call()).json()).data.months).toHaveLength(31); expect(imports).toBe(1);
  const csv = await call('GET','/export'); expect(csv.status).toBe(200); expect(await csv.text()).toContain('2026-07;31;');
  snapshot.monthlyControls[0].closing = 999; expect((await call('POST')).status).toBe(409);
  expect((await (await call()).json()).data.months[0].difference).toBe(0);
  const admin = (await store.users.read())[0]; await store.users.write([{...admin,role:'viewer'}]);
  expect((await call()).status).toBe(403); expect((await call('GET','/export')).status).toBe(403);
  await store.access.write([{userId:admin.id,companyId:company.id,createdAt:new Date().toISOString()}]);
  expect((await call()).status).toBe(200); expect((await call('GET','/export')).status).toBe(200); expect((await call('POST')).status).toBe(403);
  await store.access.write([]); expect((await call()).status).toBe(403); expect((await call('GET','/export')).status).toBe(403);
});
