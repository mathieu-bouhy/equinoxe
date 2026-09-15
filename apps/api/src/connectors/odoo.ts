import { config, type OdooConnection } from '../config';
import { loadAccountingCoverage } from './odoo-accounting-coverage';
import { loadCashAudit } from './odoo-cash-audit';
import { loadSoConsumables } from './odoo-so-consumables';
import { buildBalance } from '../services/balance-sheet';
import type { BalanceAccount, BalanceLine, BalanceReport, BfrReport, BfrSection, CashFlowReport, ProfitLossAccount, ProfitLossLine, ProfitLossLtmReport, ProfitLossMonthlyReport, ProfitLossPeriod, ProfitLossReport, ProfitLossSection, ProfitLossSubsection } from '@equinoxe/shared';

/** A closed allow-list: a future RPC method is denied until explicitly reviewed. */
export const READ_ONLY_ODOO_METHODS = new Set([
  'read', 'search', 'search_read', 'read_group', 'search_count',
  'fields_get', 'name_get', 'check_access_rights'
]);
export class ConnectorError extends Error {
  constructor(message: string, public kind: 'not_configured' | 'network' | 'credentials' | 'forbidden' = 'network') { super(message); }
}
export function assertReadOnlyOdooMethod(method: string) {
  if (!READ_ONLY_ODOO_METHODS.has(method)) throw new ConnectorError(`La méthode Odoo « ${method} » est interdite : Equinoxe est strictement en lecture seule.`, 'forbidden');
}

type Group = { account_id?: [number, string]; balance?: number; debit?:number; credit?:number };
type MonthlyGroup = Group & { __range?: { 'date:month'?: { from?: string } } };
type Account = { id: number; code?: string | false; name?: string | false; account_type: string };
export function isProfitLossAccountCode(code: Account['code']): code is string { return typeof code === 'string' && /^\d{1,12}$/.test(code); }
const definitions: [string, string][] = [['revenue', 'Chiffre d’affaires'], ['purchases', 'Marchandises'], ['subcontracting', 'Sous-traitance'], ['services', 'Services et biens divers (hors bâtiment, véhicules et dirigeants)'], ['building', 'Frais de bâtiment'], ['vehicles', 'Frais de véhicules'], ['management', 'Rémunérations dirigeants'], ['personnel', 'Rémunérations, charges sociales et pensions'], ['operatingCharges', 'Charges d’exploitation'], ['operatingIncome', 'Produits d’exploitation'], ['depreciation', 'Amortissements'], ['provisions', 'Provisions'], ['financialCharges', 'Charges financières'], ['financialIncome', 'Produits financiers'], ['exceptional', 'Produits & charges exceptionnels'], ['taxes', 'Impôts']];
const configuredSections=(sections:ProfitLossSection[])=>sections.filter(section=>section.kind==='accounts');
const accountOwner=(account:ProfitLossAccount,sections:ProfitLossSection[])=>configuredSections(sections).filter(section=>section.prefixes.some(prefix=>account.code.startsWith(prefix))).sort((a,b)=>Math.max(...b.prefixes.filter(prefix=>account.code.startsWith(prefix)).map(prefix=>prefix.length))-Math.max(...a.prefixes.filter(prefix=>account.code.startsWith(prefix)).map(prefix=>prefix.length)))[0];
function buildConfiguredLines(keys:string[],sections:ProfitLossSection[],accounts:ProfitLossAccount[]):ProfitLossLine[]{
  const lines=new Map<string,ProfitLossLine>(),building=new Set<string>();
  const make=(section:ProfitLossSection):ProfitLossLine=>{
    const existing=lines.get(section.id);if(existing)return existing;
    if(building.has(section.id))return {key:section.id,label:section.label,values:{}};
    building.add(section.id);
    const line=section.kind==='accounts'
      ? {key:section.id,label:section.label,accounts:accounts.filter(account=>accountOwner(account,sections)?.id===section.id).sort((a,b)=>a.code.localeCompare(b.code)),values:{}}
      : {key:section.id,label:section.label,values:{}};
    lines.set(section.id,line);
    line.values=Object.fromEntries(keys.map(key=>[key,section.kind==='accounts'
      ? (line.accounts??[]).reduce((sum,account)=>sum+(account.values[key]??0),0)
      : section.formula.reduce((sum,term)=>{const source=sections.find(item=>item.id===term.sectionId);const value=source?(make(source).values[key]??0):0;return sum+(term.operator==='subtract'?-value:value)},0)]));
    building.delete(section.id);return line;
  };
  return [...sections].sort((a,b)=>a.order-b.order).map(make).filter(line=>line.accounts?.length||sections.find(section=>section.id===line.key)?.kind==='calculation');
}

export class OdooConnector {
  async getCashAudit(accountIds: number[], moveIds: number[], through: string) {
    const uid = await this.authenticate();
    return loadCashAudit((model, method, args, kwargs) => this.call(uid, model, method, args, kwargs), accountIds, moveIds, through);
  }
  async getAccountingCoverage(years: number[]) {
    const uid = await this.authenticate();
    return loadAccountingCoverage((model, method, args, kwargs) => this.call(uid, model, method, args, kwargs), years);
  }
  async getSoConsumables(companyId:string,through:string,accounts:import('@equinoxe/shared').SoConsumableAccount[]){
    const uid=await this.authenticate();
    return loadSoConsumables((model,method,args,kwargs)=>this.call(uid,model,method,args,kwargs),companyId,through,accounts);
  }
  constructor(private settings: OdooConnection = config.odoo.gimi, private fetcher: typeof fetch = fetch) {}
  configured() { return Boolean(this.settings.baseUrl && this.settings.database && this.settings.username && this.settings.apiKey); }
  getProviderInfo() { return { provider: 'odoo' as const, baseUrl: this.settings.baseUrl ?? null, database: this.settings.database ?? null }; }
  private endpoint() {
    const baseUrl = this.settings.baseUrl!, url = new URL(baseUrl);
    const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1', '::1'].includes(url.hostname);
    if (url.protocol !== 'https:' && !localHttp) throw new ConnectorError('L’URL Odoo doit utiliser HTTPS hors environnement local.', 'forbidden');
    return `${baseUrl.replace(/\/$/, '')}/jsonrpc`;
  }
  private async rpc(service: 'common' | 'object', method: string, args: unknown[]) {
    let lastError: unknown;
    for (let attempt = 0; attempt <= this.settings.retries; attempt += 1) {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), this.settings.timeoutMs);
      try {
        const response = await this.fetcher(this.endpoint(), { method: 'POST', headers: { 'content-type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ jsonrpc: '2.0', method: 'call', params: { service, method, args }, id: crypto.randomUUID() }) });
        if (!response.ok) throw new ConnectorError('Le serveur Odoo ne répond pas correctement.');
        const payload = await response.json() as { result?: unknown; error?: unknown };
        if (payload.error) {
          const errorType = (payload.error as { data?: { name?: unknown } }).data?.name;
          if (errorType === 'psycopg2.OperationalError') {
            throw new ConnectorError('Odoo ne parvient pas à accéder à la base configurée. Vérifiez le nom de la base et sa disponibilité.', 'network');
          }
          throw new ConnectorError('Odoo a refusé la requête.', 'credentials');
        }
        return payload.result;
      } catch (error) {
        lastError = error;
        if (error instanceof ConnectorError && error.kind !== 'network') throw error;
      } finally { clearTimeout(timer); }
    }
    if (lastError instanceof ConnectorError) throw lastError;
    throw new ConnectorError('Impossible de joindre Odoo. Vérifiez l’URL et le réseau.');
  }
  private async authenticate() {
    if (!this.configured()) throw new ConnectorError('La connexion Odoo n’est pas configurée.', 'not_configured');
    const uid = await this.rpc('common', 'authenticate', [this.settings.database, this.settings.username, this.settings.apiKey, {}]);
    if (!uid) throw new ConnectorError('L’authentification Odoo a été refusée.', 'credentials');
    return uid as number;
  }
  /** The sole object-method gateway. It cannot send an Odoo write. */
  private call(uid: number, model: string, method: string, args: unknown[], kwargs: Record<string, unknown> = {}) {
    assertReadOnlyOdooMethod(method);
    return this.rpc('object', 'execute_kw', [this.settings.database, uid, this.settings.apiKey, model, method, args, method === 'read_group' ? { ...kwargs, limit: 0 } : kwargs]).catch(error => {
      if (error instanceof ConnectorError && error.kind === 'credentials') {
        throw new ConnectorError(`Odoo a refusé l’accès au modèle « ${model} » pour l’opération de lecture « ${method} ». Vérifiez les droits de lecture du compte de service.`, 'forbidden');
      }
      throw error;
    });
  }
  /**
   * Authentication is the only operation used by the connectivity test. The
   * credential may have broad Odoo rights, but `call` remains the sole path
   * for application data and its allow-list rejects every write method.
   */
  async testConnection() { await this.authenticate(); return { provider: 'odoo' as const, connected: true, readOnlyEnforced: true }; }
  async getProfitLossAccounts() {
    const uid=await this.authenticate();
    const accounts=await this.call(uid,'account.account','search_read',[['|',['code','=like','6%'],['code','=like','7%']]],{fields:['code','name','account_type'],order:'code asc',context:{active_test:false}}) as Account[];
    return accounts.filter(account=>isProfitLossAccountCode(account.code)&&/^[67]/.test(account.code)).map(account=>({id:String(account.id),code:account.code as string,label:typeof account.name==='string'&&account.name.trim()?account.name:'Compte sans libellé'})).sort((a,b)=>a.code.localeCompare(b.code,'fr-BE',{numeric:true}));
  }
  /** Paginated, posted ledger used by analytical P&L drilldowns. */
  async getAnalyticAccountEntries(accountId:string,start:string,end:string):Promise<import('@equinoxe/shared').AccountingEntry[]>{
    if(!/^\d+$/.test(accountId)||!/^20\d{2}-\d{2}-\d{2}$/.test(start)||!/^20\d{2}-\d{2}-\d{2}$/.test(end)||start>end)throw new ConnectorError('Période ou compte invalide.','forbidden');
    const uid=await this.authenticate(),result:import('@equinoxe/shared').AccountingEntry[]=[];
    let after=0;
    type Row={id:number;date:string;name:string|false;partner_id:[number,string]|false;move_id:[number,string]|false;debit:number;credit:number};
    while(true){
      const rows=await this.call(uid,'account.move.line','search_read',[[['account_id','=',Number(accountId)],['parent_state','=','posted'],['date','>=',start],['date','<=',end],['id','>',after]]],{fields:['date','name','partner_id','move_id','debit','credit'],order:'id asc',limit:500}) as Row[];
      if(!rows.length)break;
      for(const row of rows){
        if(row.id<=after||!Number.isFinite(row.debit)||!Number.isFinite(row.credit))throw new ConnectorError('Détail des écritures incohérent.');
        const base=new URL(this.endpoint());base.username='';base.password='';base.pathname='/web';base.search='';base.hash=`id=${row.move_id?row.move_id[0]:row.id}&model=${row.move_id?'account.move':'account.move.line'}&view_type=form`;
        result.push({id:String(row.id),date:row.date,label:row.name||'Sans libellé',partner:row.partner_id?row.partner_id[1]:null,debit:row.debit,credit:row.credit,odooUrl:base.toString()});
      }
      after=rows.at(-1)!.id;
    }
    return result.sort((a,b)=>a.date.localeCompare(b.date)||Number(a.id)-Number(b.id));
  }
  async getAccountEntries(accountId: string, year: number, includeDraftInvoices = false) {
    const uid = await this.authenticate();
    const stateDomain = includeDraftInvoices ? ['parent_state', 'in', ['posted', 'draft']] : ['parent_state', '=', 'posted'];
    const rows = await this.call(uid, 'account.move.line', 'search_read', [[['account_id', '=', Number(accountId)], stateDomain, ['date', '>=', `${year}-01-01`], ['date', '<=', `${year}-12-31`]]], { fields: ['date', 'name', 'partner_id', 'debit', 'credit'], order: 'date asc,id asc', limit: 5000 }) as Array<{ id: number; date: string; name: string; partner_id?: [number, string] | false; debit: number; credit: number }>;
    const base=this.settings.baseUrl?.replace(/\/$/,'')??null;
    return rows.map(row => ({ id: String(row.id), date: row.date, label: row.name, partner: row.partner_id ? row.partner_id[1] : null, debit: row.debit ?? 0, credit: row.credit ?? 0, odooUrl:base?`${base}/web#id=${encodeURIComponent(String(row.id))}&model=account.move.line&view_type=form`:null }));
  }
  async getProfitLoss(years: number[], sections: ProfitLossSection[] = [], subsections: ProfitLossSubsection[] = [], includeDraftInvoices = false, asOf?:string): Promise<ProfitLossReport> {
    const uid = await this.authenticate();
    const stateDomain = includeDraftInvoices ? ['parent_state', 'in', ['posted', 'draft']] : ['parent_state', '=', 'posted'];
    const groups = await Promise.all(years.map(year => {const end=asOf&&year===Number(asOf.slice(0,4))?asOf:`${year}-12-31`;return this.call(uid, 'account.move.line', 'read_group', [[stateDomain, ['date', '>=', `${year}-01-01`], ['date', '<=', end]], ['balance'], ['account_id']], { lazy: false }) as Promise<Group[]>}));
    const ids = [...new Set(groups.flat().flatMap(g => g.account_id ? [g.account_id[0]] : []))], accounts = ids.length ? await this.call(uid, 'account.account', 'read', [ids], { fields: ['code', 'name', 'account_type'] }) as Account[] : [], byId = new Map(accounts.map(a => [a.id, a]));
    const totals = new Map(definitions.map(([key]) => [key, {} as Record<string, number>])), details = new Map(definitions.map(([key]) => [key, new Map<string, ProfitLossAccount>()]));
    groups.forEach((yearGroups, index) => yearGroups.forEach(group => { const account = group.account_id ? byId.get(group.account_id[0]) : undefined, key = account && this.category(account); if (!key || !account || !isProfitLossAccountCode(account.code) || typeof group.balance !== 'number' || !group.account_id) return; const year = String(years[index]), amount = -group.balance, accountId = String(group.account_id[0]); totals.get(key)![year] = (totals.get(key)![year] ?? 0) + amount; const rows = details.get(key)!, previous = rows.get(accountId) ?? { id: accountId, code: account.code, label: String(account.name ?? group.account_id[1] ?? 'Compte sans libellé'), values: {} }; previous.values[year] = (previous.values[year] ?? 0) + amount; rows.set(accountId, previous); }));
    let lines: ProfitLossLine[] = definitions.map(([key, label]) => ({ key, label, values: totals.get(key)!, accounts: [...details.get(key)!.values()].sort((a, b) => a.code.localeCompare(b.code)) })).filter(line => Object.values(line.values).some(value => Math.abs(value) > .004));
    const sum = (year: number, keys: string[]) => keys.reduce((total, key) => total + (totals.get(key)?.[String(year)] ?? 0), 0), calculated = (key: string, label: string, keys: string[]) => ({ key, label, values: Object.fromEntries(years.map(year => [String(year), sum(year, keys)])) });
    lines.splice(2, 0, calculated('grossMargin', 'Marge brute', ['revenue', 'purchases'])); lines.splice(10, 0, calculated('ebitda', 'EBITDA', ['revenue', 'purchases', 'subcontracting', 'services', 'building', 'vehicles', 'management', 'personnel', 'operatingCharges', 'operatingIncome'])); lines.splice(13, 0, calculated('operatingResult', 'Résultat d’exploitation', ['revenue', 'purchases', 'subcontracting', 'services', 'building', 'vehicles', 'management', 'personnel', 'operatingCharges', 'operatingIncome', 'depreciation', 'provisions'])); lines.push(calculated('resultBeforeTaxes', 'Résultat avant impôts', ['revenue', 'purchases', 'subcontracting', 'services', 'building', 'vehicles', 'management', 'personnel', 'operatingCharges', 'operatingIncome', 'depreciation', 'provisions', 'financialCharges', 'financialIncome', 'exceptional'])); lines.push(calculated('netResult', 'Résultat après impôts', ['revenue', 'purchases', 'subcontracting', 'services', 'building', 'vehicles', 'management', 'personnel', 'operatingCharges', 'operatingIncome', 'depreciation', 'provisions', 'financialCharges', 'financialIncome', 'exceptional', 'taxes']));
    if (sections.length) lines=buildConfiguredLines(years.map(String),sections,[...details.values()].flatMap(rows=>[...rows.values()]));
    for (const line of lines) {
      const parent = sections.find(section => line.accounts?.some(account => section.prefixes.some(prefix => account.code.startsWith(prefix))));
      if (!parent || !line.accounts?.length) continue;
      const configured = subsections.filter(section => section.parentSectionId === parent.id).sort((a, b) => a.order - b.order);
      if (!configured.length) continue;
      line.subsections = configured.map(section => {
        const accounts = line.accounts!.filter(account => section.prefixes.some(prefix => account.code.startsWith(prefix)));
        return { id: section.id, label: section.label, accounts, values: Object.fromEntries(years.map(year => [String(year), accounts.reduce((sum, account) => sum + (account.values[String(year)] ?? 0), 0)])) };
      }).filter(section => section.accounts.length);
    }
    return { years, lines, generatedAt: new Date().toISOString(), source: 'odoo' };
  }
  async getProfitLossLtm(periods:ProfitLossPeriod[],sections:ProfitLossSection[],includeDraftInvoices=false):Promise<ProfitLossLtmReport>{
    const uid=await this.authenticate(),stateDomain=includeDraftInvoices?['parent_state','in',['posted','draft']]:['parent_state','=','posted'];
    const groups=await Promise.all(periods.map(period=>this.call(uid,'account.move.line','read_group',[[stateDomain,['date','>=',period.start],['date','<=',period.end]],['balance'],['account_id']],{lazy:false}) as Promise<Group[]>));
    const ids=[...new Set(groups.flat().flatMap(group=>group.account_id?[group.account_id[0]]:[]))],accounts=ids.length?await this.call(uid,'account.account','read',[ids],{fields:['code','name','account_type']}) as Account[]:[],byId=new Map(accounts.map(account=>[account.id,account]));
    const details=new Map<string,ProfitLossAccount>();
    groups.forEach((periodGroups,index)=>periodGroups.forEach(group=>{const account=group.account_id?byId.get(group.account_id[0]):undefined;if(!account||!isProfitLossAccountCode(account.code)||typeof group.balance!=='number'||!group.account_id)return;const id=String(group.account_id[0]),previous=details.get(id)??{id,code:account.code,label:String(account.name??group.account_id[1]??'Compte sans libellé'),values:{}};const key=periods[index].key;previous.values[key]=(previous.values[key]??0)-group.balance;details.set(id,previous)}));
    return {periods,lines:buildConfiguredLines(periods.map(period=>period.key),sections,[...details.values()]),generatedAt:new Date().toISOString(),source:'odoo'};
  }
  async getProfitLossMonths(year: number, sections: ProfitLossSection[] = [], includeDraftInvoices = false, asOf?: string): Promise<ProfitLossMonthlyReport> {
    const end = asOf && year === Number(asOf.slice(0,4)) ? asOf : `${year}-12-31`;
    const uid = await this.authenticate(), stateDomain = includeDraftInvoices ? ['parent_state', 'in', ['posted', 'draft']] : ['parent_state', '=', 'posted'];
    const groups = await this.call(uid, 'account.move.line', 'read_group', [[stateDomain, ['date', '>=', `${year}-01-01`], ['date', '<=', end]], ['balance'], ['account_id', 'date:month']], { lazy: false }) as MonthlyGroup[];
    const ids = [...new Set(groups.flatMap(group => group.account_id ? [group.account_id[0]] : []))], accounts = ids.length ? await this.call(uid, 'account.account', 'read', [ids], { fields: ['code', 'name', 'account_type'] }) as Account[] : [], byId = new Map(accounts.map(account => [account.id, account]));
    const months = Array.from({length:Number(end.slice(5,7))},(_,index)=>`${year}-${String(index+1).padStart(2,'0')}`), values = new Map<string, Record<string, number>>();
    for (const group of groups) { const account = group.account_id ? byId.get(group.account_id[0]) : undefined, dateStart = group.__range?.['date:month']?.from, month = typeof dateStart === 'string' ? dateStart.slice(0,7) : undefined; if (!account || !month || !isProfitLossAccountCode(account.code) || typeof group.balance !== 'number') continue; const section=accountOwner({id:String(group.account_id![0]),code:account.code,label:String(account.name??''),values:{}},sections); if (!section) continue; const row = values.get(section.id) ?? {}; row[month] = (row[month] ?? 0) - group.balance; values.set(section.id,row); }
    const lines=new Map(sections.filter(section=>section.kind==='accounts').map(section=>[section.id,{key:section.id,label:section.label,values:values.get(section.id)??{}}]));
    const make=(section:ProfitLossSection):{key:string;label:string;values:Record<string,number>}=>{const existing=lines.get(section.id);if(existing)return existing;const line={key:section.id,label:section.label,values:Object.fromEntries(months.map(month=>[month,section.formula.reduce((sum,term)=>{const source=sections.find(item=>item.id===term.sectionId);const value=source?(make(source).values[month]??0):0;return sum+(term.operator==='subtract'?-value:value)},0)]))};lines.set(section.id,line);return line};
    return { year, months, lines:[...sections].sort((a,b)=>a.order-b.order).map(make).filter(line=>Object.values(line.values).some(value=>Math.abs(value)>.004)),generatedAt:new Date().toISOString(),source:'odoo' };
  }
  /** Complete, keyset-paginated cash ledger. Only the existing read-only gateway is used. */
  async getCashHistory(companyId: string, through: string): Promise<import('@equinoxe/shared').CashHistorySnapshot> {
    if (!/^20\d{2}-\d{2}-\d{2}$/.test(through) || through < '2024-01-01') throw new ConnectorError('Période de trésorerie invalide.', 'forbidden');
    const startedAt = new Date().toISOString(), uid = await this.authenticate(), from = '2024-01-01';
    const accounts: Account[] = [];
    let after = 0;
    while (true) {
      const page = await this.call(uid, 'account.account', 'search_read', [[['code', '=like', '5%'], ['id', '>', after]]],
        { fields: ['code', 'name'], context: { active_test: false }, order: 'id asc', limit: 500 }) as Account[];
      if (!page.length) break;
      if (page.some(row => row.id <= after)) throw new ConnectorError('Pagination des comptes incohérente.');
      accounts.push(...page); after = page.at(-1)!.id;
    }
    const valid = accounts.filter(a => typeof a.code === 'string' && /^5\d{1,11}$/.test(a.code));
    if (!valid.length) throw new ConnectorError('Aucun compte de trésorerie et placements disponible.');
    const domain = [['parent_state', '=', 'posted'], ['account_id', 'in', valid.map(a => a.id)]];
    const grouped = (end: string) => this.call(uid, 'account.move.line', 'read_group', [[...domain, ['date', '<=', end]], ['balance'], ['account_id']], { lazy: false }) as Promise<Group[]>;
    const opening = await grouped('2023-12-31');
    type Row = { id: number; date: string; account_id: [number,string]; move_id: [number,string]; name: string | false; debit: number; credit: number };
    const movements: import('@equinoxe/shared').CashMovement[] = [];
    after = 0;
    while (true) {
      const page = await this.call(uid, 'account.move.line', 'search_read', [[...domain, ['date', '>=', from], ['date', '<=', through], ['id', '>', after]]],
        { fields: ['date', 'account_id', 'move_id', 'name', 'debit', 'credit'], order: 'id asc', limit: 1000 }) as Row[];
      if (!page.length) break;
      if (page.some(row => row.id <= after)) throw new ConnectorError('Pagination des mouvements incohérente.');
      for (const row of page) {
        if (!row.account_id || !row.move_id || !Number.isFinite(row.debit) || !Number.isFinite(row.credit)) throw new ConnectorError('Écriture de trésorerie incomplète.');
        movements.push({ id: row.id, date: row.date, accountId: row.account_id[0], moveId: row.move_id[0], label: row.name || '', debit: row.debit, credit: row.credit });
      }
      after = page.at(-1)!.id;
    }
    const [closing, monthly] = await Promise.all([
      grouped(through),
      this.call(uid, 'account.move.line', 'read_group', [[...domain, ['date', '>=', from], ['date', '<=', through]], ['balance'], ['date:month']], { lazy: false }) as Promise<MonthlyGroup[]>,
    ]);
    const amount = (rows: Group[], id: number) => rows.find(g => g.account_id?.[0] === id)?.balance ?? 0;
    const cashAccounts = valid.map(a => ({ id: a.id, code: String(a.code), label: String(a.name || ''), opening: amount(opening, a.id), closing: amount(closing, a.id) }));
    for (const account of cashAccounts) {
      const calculated = account.opening + movements.filter(row => row.accountId === account.id).reduce((sum, row) => sum + row.debit - row.credit, 0);
      if (Math.abs(calculated - account.closing) > .011) throw new ConnectorError('Les mouvements ne se rapprochent pas des soldes Odoo. Relancez l’import ; aucun historique n’a été remplacé.');
    }
    const controls = new Map<string, number>();
    for (const group of monthly) {
      const month = group.__range?.['date:month']?.from?.slice(0, 7);
      if (!month || !Number.isFinite(group.balance)) throw new ConnectorError('Contrôle mensuel Odoo incomplet.');
      controls.set(month, (controls.get(month) ?? 0) + group.balance!);
    }
    const monthlyControls: import('@equinoxe/shared').CashHistorySnapshot['monthlyControls'] = [];
    let balance = cashAccounts.reduce((sum, a) => sum + a.opening, 0);
    for (const date = new Date('2024-01-01T00:00:00Z'); date.toISOString().slice(0,10) <= through; date.setUTCMonth(date.getUTCMonth() + 1)) {
      const month = date.toISOString().slice(0, 7), net = controls.get(month) ?? 0;
      const actual = movements.filter(row => row.date.startsWith(month)).reduce((sum, row) => sum + row.debit - row.credit, 0);
      if (Math.abs(actual - net) > .011) throw new ConnectorError('Contrôle mensuel des mouvements incohérent. Relancez l’import.');
      balance += net; monthlyControls.push({ month, closing: balance, difference: actual - net });
    }
    return { version: 1, companyId, source: 'odoo', currency: 'EUR', accountPrefix: '5', from, through, startedAt,
      importedAt: new Date().toISOString(), accounts: cashAccounts.sort((a,b) => a.code.localeCompare(b.code)), movements, monthlyControls };
  }
  async getBalance(years:number[], asOf?:string):Promise<BalanceReport>{
    const uid=await this.authenticate();
    const groups=await Promise.all(years.map(year=>{const end=asOf&&year===Number(asOf.slice(0,4))?asOf:`${year}-12-31`;return this.call(uid,'account.move.line','read_group',[[['parent_state','=','posted'],['date','<=',end]],['balance'],['account_id']],{lazy:false}) as Promise<Group[]>;}));
    const ids=[...new Set(groups.flat().flatMap(group=>group.account_id?[group.account_id[0]]:[]))],accounts=ids.length?await this.call(uid,'account.account','read',[ids],{fields:['code','name','account_type']}) as Account[]:[],byId=new Map(accounts.map(account=>[account.id,account]));
    const rows=new Map<string,BalanceAccount>();
    groups.forEach((yearGroups,index)=>yearGroups.forEach(group=>{const account=group.account_id?byId.get(group.account_id[0]):undefined;if(!account||!isProfitLossAccountCode(account.code)||typeof group.balance!=='number'||!group.account_id||!/^[1-5]/.test(account.code))return;const id=String(account.id),row=rows.get(id)??{id,code:account.code,label:String(account.name??group.account_id[1]??'Compte sans libellé'),values:{}};row.values[String(years[index])]=group.balance;rows.set(id,row)}));
    return buildBalance(years,[...rows.values()],asOf);
  }
  /** Actual posted amounts by account/month for computed allocation keys. No Odoo writes. */
  async getProfitLossAccountMonths(accountIds:string[],years:number[],asOf?:string):Promise<import('@equinoxe/shared').AccountMonthlyAmounts[]>{
    if(!accountIds.length)return [];
    if(accountIds.some(id=>!/^\d+$/.test(id))||!years.length||years.some(year=>!Number.isInteger(year)||year<2000||year>2100))throw new ConnectorError('Période ou comptes invalides.','forbidden');
    const uid=await this.authenticate(),end=asOf??`${Math.max(...years)}-12-31`;
    const groups=await this.call(uid,'account.move.line','read_group',[[['parent_state','=','posted'],['account_id','in',accountIds.map(Number)],['date','>=',`${Math.min(...years)}-01-01`],['date','<=',end]],['balance'],['account_id','date:month']],{lazy:false}) as MonthlyGroup[];
    const rows=new Map(accountIds.map(accountId=>[accountId,{accountId,values:{} as Record<string,number>}]));
    for(const group of groups){
      const row=group.account_id?rows.get(String(group.account_id[0])):undefined,month=group.__range?.['date:month']?.from?.slice(0,7);
      if(!row)continue;
      if(!month||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||typeof group.balance!=='number')throw new ConnectorError('Détail mensuel comptable incomplet.');
      if(years.includes(Number(month.slice(0,4))))row.values[month]=(row.values[month]??0)-group.balance;
    }
    return [...rows.values()];
  }
  async getBfr(years:number[], sections:BfrSection[], asOf?:string):Promise<BfrReport>{
    const uid=await this.authenticate(), ordered=[...sections].sort((a,b)=>a.order-b.order);
    const groups=await Promise.all(years.map(year=>{const end=asOf&&year===Number(asOf.slice(0,4))?asOf:`${year}-12-31`;return this.call(uid,'account.move.line','read_group',[[['parent_state','=','posted'],['date','<=',end]],['balance'],['account_id']],{lazy:false}) as Promise<Group[]>;}));
    const ids=[...new Set(groups.flat().flatMap(group=>group.account_id?[group.account_id[0]]:[]))],accounts=ids.length?await this.call(uid,'account.account','read',[ids],{fields:['code','name','account_type']}) as Account[]:[],byId=new Map(accounts.map(account=>[account.id,account]));
    const details=new Map<string,Map<string,BalanceAccount>>(ordered.map(section=>[section.id,new Map()]));
    const owner=(code:string)=>ordered.filter(section=>section.prefixes.some(prefix=>code.startsWith(prefix))).sort((a,b)=>Math.max(...b.prefixes.filter(prefix=>code.startsWith(prefix)).map(prefix=>prefix.length))-Math.max(...a.prefixes.filter(prefix=>code.startsWith(prefix)).map(prefix=>prefix.length)))[0];
    groups.forEach((yearGroups,index)=>yearGroups.forEach(group=>{const account=group.account_id?byId.get(group.account_id[0]):undefined;if(!account||!group.account_id||!isProfitLossAccountCode(account.code)||typeof group.balance!=='number')return;const section=owner(account.code);if(!section)return;const rows=details.get(section.id)!,id=String(account.id),row=rows.get(id)??{id,code:account.code,label:String(account.name??group.account_id[1]??'Compte sans libellé'),values:{}};row.values[String(years[index])]=group.balance;rows.set(id,row)}));
    const lines=ordered.map(section=>{const accounts=[...details.get(section.id)!.values()].sort((a,b)=>a.code.localeCompare(b.code)),values=Object.fromEntries(years.map(year=>[String(year),accounts.reduce((sum,account)=>sum+(account.values[String(year)]??0),0)])),variations=Object.fromEntries(years.map((year,index)=>[String(year),index===0?null:(values[String(year)]??0)-(values[String(years[index-1])]??0)]));return {id:section.id,label:section.label,sign:section.sign,values,variations,accounts};});
    const total=Object.fromEntries(years.map(year=>[String(year),lines.reduce((sum,line)=>sum+(line.values[String(year)]??0),0)])),variation=Object.fromEntries(years.map((year,index)=>[String(year),index===0?null:(total[String(year)]??0)-(total[String(years[index-1])]??0)]));
    return {years,lines,total,variation,generatedAt:new Date().toISOString(),source:'odoo'};
  }
  async getCashFlow(years:number[],sections:ProfitLossSection[],asOf?:string,bfrSections:BfrSection[]=[]):Promise<CashFlowReport>{
    const balanceYears=[years[0]-1,...years], [pnl,balance,bfr]=await Promise.all([this.getProfitLoss(years,sections,[],false,asOf),this.getBalance(balanceYears,asOf),this.getBfr(balanceYears,bfrSections,asOf)]);
    const line=(label:string)=>pnl.lines.find(item=>item.label===label)?.values??{};
    const net=line('Résultat après impôts'),depreciation=line('Amortissements'),taxes=line('Impôts');
    const asset=(key:string)=>balance.assets.find(item=>item.key===key)?.values??{},liability=(key:string)=>balance.liabilities.find(item=>item.key===key)?.values??{};
    const change=(values:Record<string,number>,year:number)=>(values[String(year)]??0)-(values[String(year-1)]??0);
    const nwc=bfrSections.length?years.map(year=>bfr.variation[String(year)]??0):years.map(year=>change(asset('inventory'),year)+change(asset('receivables'),year)+change(asset('prepayments'),year)-change(liability('suppliers'),year)-change(liability('tax-social'),year)-change(liability('accruals'),year));
    const balanceCapexAccounts=[...new Map(balance.assets.flatMap(line=>line.accounts).filter(account=>/^2[0-7]/.test(account.code)).map(account=>[account.id,account])).values()],capexRows=new Map<string,ProfitLossAccount>();
    balanceCapexAccounts.forEach(account=>{const id=account.id,row:ProfitLossAccount=capexRows.get(id)??{id,code:account.code,label:account.label,values:{}};years.forEach(year=>{const variation=(account.values[String(year)]??0)-(account.values[String(year-1)]??0);row.values[String(year)]=-variation;});capexRows.set(id,row);});
    // The 63*** depreciation expense is already added back separately. Exclude
    // accumulated depreciation/value-reduction balance accounts from gross CAPEX.
    const isNonCashCapex=(account:ProfitLossAccount)=>/^63/.test(account.code)||/AMORT|R[ÉE]DUCT/i.test(account.label);
    const capexDetail=[...capexRows.values()].filter(account=>!isNonCashCapex(account)&&Object.values(account.values).some(value=>Math.abs(value)>.004)).sort((a,b)=>a.code.localeCompare(b.code));
    const nonCashCapexDetail=[...capexRows.values()].filter(account=>isNonCashCapex(account)&&Object.values(account.values).some(value=>Math.abs(value)>.004)).sort((a,b)=>a.code.localeCompare(b.code));
    const capex=years.map(year=>capexDetail.reduce((sum,account)=>sum+(account.values[String(year)]??0),0));
    // 694 -> 471 is only an appropriation of profit. A distribution belongs in the
    // cash bridge only when a class-5 cash account is actually credited.
    const cashAccounts=(await this.call(await this.authenticate(),'account.account','search_read',[[['code','=like','5%']]],{fields:['code','name'],order:'code'}) as Account[]).filter(account=>isProfitLossAccountCode(account.code));
    const distributionRows=new Map<string,ProfitLossAccount>();
    await Promise.all(years.map(async year=>{const end=asOf&&year===Number(asOf.slice(0,4))?asOf:`${year}-12-31`,entries=await this.call(await this.authenticate(),'account.move.line','search_read',[[['parent_state','=','posted'],['date','>=',`${year}-01-01`],['date','<=',end],['account_id','in',cashAccounts.map(account=>account.id)],['name','ilike','dividende']]],{fields:['account_id','name','debit','credit']}) as Array<{account_id?:[number,string];name?:string;debit?:number;credit?:number}>;entries.forEach(entry=>{if(!entry.account_id)return;const code=String(entry.account_id[1]).split(' ')[0],id=String(entry.account_id[0]),row:ProfitLossAccount=distributionRows.get(id)??{id,code,label:`${entry.name??'Paiement de dividende'} · ${entry.account_id[1]}`,values:{}};row.values[String(year)]=(row.values[String(year)]??0)+((entry.debit??0)-(entry.credit??0));distributionRows.set(id,row);});}));
    const distributionDetail=[...distributionRows.values()].filter(account=>Object.values(account.values).some(value=>Math.abs(value)>.004)).sort((a,b)=>a.code.localeCompare(b.code));
    const debtRepayment=years.map(year=>Math.min(0,change(liability('financial-debt'),year)));
    const record=(key:string,label:string,fn:(year:number,index:number)=>number,detail?:string)=>({key,label,detail,values:Object.fromEntries(years.map((year,index)=>[String(year),fn(year,index)]))});
    const cashBeforeDebt=record('cfads','Cash-flow après intérêts, avant remboursement du capital',(year,index)=>(net[String(year)]??0)+(depreciation[String(year)]??0)-nwc[index]+capex[index],"Résultat après impôts, incluant déjà les charges financières, + amortissements - variation du BFR - investissements nets.");
    const cash=asset('cash'),openingCash=Object.fromEntries(years.map(year=>[String(year),cash[String(year-1)]??0])),closingCash=Object.fromEntries(years.map(year=>[String(year),cash[String(year)]??0]));
    return {years,openingCash,closingCash,accountDetails:{capex:capexDetail,distributions:distributionDetail},nonCashDetails:{capex:nonCashCapexDetail},lines:[record('net-result','Résultat après impôts',year=>net[String(year)]??0),record('depreciation','+ Amortissements',year=>depreciation[String(year)]??0),record('nwc','- / + Variation du besoin en fonds de roulement',(_year,index)=>-nwc[index]),record('capex','- Investissements nets (CAPEX)',(_year,index)=>capex[index],"Variation des soldes des immobilisations bilantaires 20 à 27 entre N et N-1, hors comptes d’amortissements/réductions de valeur ; les charges 63*** sont déjà reprises dans + Amortissements et ne sont pas reprises dans CAPEX."),cashBeforeDebt,record('interest','Charges financières (déjà incluses dans le résultat)',year=>line('Financier')[String(year)]??0,"Information : elles ne sont pas déduites une seconde fois."),record('debt-repayment','- Remboursements nets de dettes financières',(_year,index)=>debtRepayment[index]),record('free-cash-flow','Cash-flow libre après dette',(year,index)=>cashBeforeDebt.values[String(year)]+debtRepayment[index],"Résultat après impôts + amortissements - variation du BFR - investissements nets - remboursements de capital. Les intérêts sont déjà inclus dans le résultat après impôts.")],generatedAt:new Date().toISOString(),source:'odoo'};
  }
  private category(account: Account) { if (!isProfitLossAccountCode(account.code)) return null; const code = account.code; if (/^(70|71)/.test(code)) return 'revenue'; if (/^603/.test(code)) return 'subcontracting'; if (/^60/.test(code)) return 'purchases'; if (/^(610001|610002|610003|610010|610020|611000|612111|612112|612113)/.test(code)) return 'building'; if (/^(61002[2-5]|61003[2-5]|610500|6112|611430|61218|61312|61318)/.test(code)) return 'vehicles'; if (/^(618000|613208)/.test(code)) return 'management'; if (/^62/.test(code)) return 'personnel'; if (/^61/.test(code)) return 'services'; if (/^64/.test(code)) return 'operatingCharges'; if (/^74/.test(code)) return 'operatingIncome'; if (/^630/.test(code)) return 'depreciation'; if (/^(634|642)/.test(code)) return 'provisions'; if (/^65/.test(code)) return 'financialCharges'; if (/^75/.test(code)) return 'financialIncome'; if (/^(66|76)/.test(code)) return 'exceptional'; if (/^(67|77)/.test(code)) return 'taxes'; return null; }
}
