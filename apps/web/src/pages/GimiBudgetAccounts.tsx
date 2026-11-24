import { Fragment, useMemo, useState } from 'react';
import { Plus, Search, Trash2 } from 'lucide-react';
import {
  gimiBudgetAccountValue,
  type GimiBudgetAccountAssumption,
  type GimiBudgetAccountDepartment,
  type GimiBudgetAccountGroup,
  type GimiBudgetAccountMethod,
  type GimiBudgetAccountSourceReport,
  type GimiBudgetOperatingCategory,
  type GimiBudgetPlan,
  type GimiBudgetSalesSubcategory,
} from '@equinoxe/shared';
import { Button, Card, ErrorState, Input, LoadingState, Select } from '../components/ui';

const departmentLabels: Record<GimiBudgetAccountDepartment, string> = {
  fireInstallation: 'Installation incendie', fireMaintenance: 'Maintenance incendie',
  intrusion: 'Intrusion et contrôle d’accès', led: 'LED', other: 'Autres',
};
const departmentOrder: GimiBudgetAccountDepartment[] = ['fireInstallation', 'fireMaintenance', 'intrusion', 'led', 'other'];
const salesSubcategoryLabels: Record<GimiBudgetSalesSubcategory, string> = {
  installation: 'Installations', supply: 'Fournitures', repair: 'Dépannages',
  contract: 'Contrats et entretiens', goods: 'Marchandises', subcontracting: 'Sous-traitance',
  stockVariation: 'Variation de stock', ancillary: 'Achats accessoires', other: 'Autres',
};
const salesSubcategoryOrder: GimiBudgetSalesSubcategory[] = ['installation', 'supply', 'repair', 'contract', 'goods', 'subcontracting', 'stockVariation', 'ancillary', 'other'];
const categoryLabels: Record<GimiBudgetOperatingCategory, string> = {
  rent: 'Loyers et charges locatives', insurance: 'Assurances', energy: 'Énergie et eau',
  maintenance: 'Entretiens et réparations', fees: 'Honoraires et cotisations', vehicles: 'Véhicules',
  itTelecom: 'Informatique et télécom', marketing: 'Marketing et représentation', travel: 'Déplacements et missions',
  temporaryStaff: 'Personnel intérimaire et externe', taxes: 'Taxes d’exploitation', losses: 'Pertes et réductions de valeur',
  penalties: 'Amendes et pénalités', subsidies: 'Subsides', recoveries: 'Récupérations de charges',
  recharges: 'Refacturations', employeeContributions: 'Contributions du personnel',
  operatingIncome: 'Autres produits d’exploitation', other: 'Autres',
};
const categoryOrder = Object.keys(categoryLabels) as GimiBudgetOperatingCategory[];
const money = new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });

type Props = { plan: GimiBudgetPlan; report?: GimiBudgetAccountSourceReport; group: GimiBudgetAccountGroup; editable: boolean; loading: boolean; error: boolean; onChange: (value: GimiBudgetPlan) => void };
const methodOptions = (group: GimiBudgetAccountGroup): Array<[GimiBudgetAccountMethod, string]> => group === 'salesPurchases'
  ? [['pending', 'À définir'], ['growth', 'Croissance sur 2026 extrapolé'], ['absolute', 'Montant 2027 fixé'], ['notRenewed', 'Non reconduit en 2027']]
  : [['pending', 'À définir'], ['indexation', '% de variation 2027 / indexation des coûts'], ['absolute', 'Montant 2027 fixé'], ['notRenewed', 'Non reconduit en 2027']];

export function GimiBudgetAccounts({ plan, report, group, editable, loading, error, onChange }: Props) {
  const [search, setSearch] = useState('');
  const savedBySource = new Map(plan.accountPlanning.lines.filter(line => line.group === group && line.sourceAccountId).map(line => [line.sourceAccountId, line]));
  const sourceLines = (report?.accounts ?? []).map(source => {
    const saved = savedBySource.get(source.id);
    if (saved) return { ...saved, method: group === 'salesPurchases' && saved.method === 'indexation' ? 'growth' as const : group === 'operating' && saved.method === 'growth' ? 'indexation' as const : saved.method };
    return { id: `odoo-${source.id}`, sourceAccountId: source.id, accountCode: source.code, accountLabel: source.label, group,
      department: source.suggestedDepartment, subcategory: source.suggestedSubcategory, category: source.suggestedCategory,
      method: 'pending', indexationRate: null, absolute2027: null, note: '', manual: false } satisfies GimiBudgetAccountAssumption;
  });
  const manualLines = plan.accountPlanning.lines.filter(line => line.group === group && line.manual);
  const sourceById = new Map((report?.accounts ?? []).map(line => [line.id, line]));
  const rows = useMemo(() => [...sourceLines, ...manualLines].sort((a, b) => {
    if (group === 'salesPurchases') {
      const classOrder = (value: string) => value.startsWith('7') ? 0 : value.startsWith('60') ? 1 : 2;
      return classOrder(a.accountCode) - classOrder(b.accountCode)
        || departmentOrder.indexOf(a.department) - departmentOrder.indexOf(b.department)
        || salesSubcategoryOrder.indexOf(a.subcategory) - salesSubcategoryOrder.indexOf(b.subcategory)
        || a.accountCode.localeCompare(b.accountCode, 'fr-BE');
    }
    return a.accountCode.slice(0, 2).localeCompare(b.accountCode.slice(0, 2), 'fr-BE')
      || categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category)
      || a.accountCode.localeCompare(b.accountCode, 'fr-BE');
  }), [sourceLines, manualLines, group]);
  const visible = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase('fr-BE');
    return needle ? rows.filter(line => `${line.accountCode} ${line.accountLabel} ${line.note}`.toLocaleLowerCase('fr-BE').includes(needle)) : rows;
  }, [rows, search]);

  const upsert = (line: GimiBudgetAccountAssumption, patch: Partial<GimiBudgetAccountAssumption>) => {
    const next = { ...line, ...patch };
    const matches = (item: GimiBudgetAccountAssumption) => item.id === line.id || Boolean(line.sourceAccountId) && item.sourceAccountId === line.sourceAccountId;
    const lines = plan.accountPlanning.lines.some(matches) ? plan.accountPlanning.lines.map(item => matches(item) ? next : item) : [...plan.accountPlanning.lines, next];
    onChange({ ...plan, accountPlanning: { ...plan.accountPlanning, lines } });
  };
  const remove = (id: string) => onChange({ ...plan, accountPlanning: { ...plan.accountPlanning, lines: plan.accountPlanning.lines.filter(line => line.id !== id) } });
  const add = () => onChange({ ...plan, accountPlanning: { ...plan.accountPlanning, lines: [...plan.accountPlanning.lines, {
    id: crypto.randomUUID(), sourceAccountId: null, accountCode: '', accountLabel: 'Nouveau poste', group,
    department: 'other', subcategory: 'other', category: 'other', method: 'absolute', indexationRate: null,
    absolute2027: null, note: '', manual: true,
  }] } });
  const updateDepartmentRate = (key: GimiBudgetAccountDepartment, value: number | null) => onChange({ ...plan, accountPlanning: { ...plan.accountPlanning, departmentRates: { ...plan.accountPlanning.departmentRates, [key]: value } } });
  const updateCategoryRate = (key: GimiBudgetOperatingCategory, value: number | null) => onChange({ ...plan, accountPlanning: { ...plan.accountPlanning, categoryRates: { ...plan.accountPlanning.categoryRates, [key]: value } } });
  const completed = rows.filter(line => gimiBudgetAccountValue(line, sourceById.get(line.sourceAccountId ?? '')?.amount2026 ?? null, plan.accountPlanning) !== null).length;

  if (loading) return <LoadingState />;
  if (error || !report) return <ErrorState message="Impossible de lire les comptes actifs dans Odoo." />;

  let previousGroup = '';
  return <>
    <Card className="account-budget-intro">
      <div><p className="eyebrow">Budget 2027 · comptes actifs Odoo</p><h2>{group === 'salesPurchases' ? 'Comptes 70, 71 et 60' : 'Comptes 61, 64 et 74'}</h2><p>{group === 'salesPurchases' ? 'Les comptes de revenus sont présentés avant les achats et regroupés par activité.' : 'Les charges et produits sont regroupés par nature. Les flux dirigeants confidentiels restent traités séparément.'} Chaque classement reste modifiable.</p></div>
      <div className="account-budget-status"><span>{completed} / {rows.length}</span><small>lignes calculables</small><span>Clôture {report.lastClosedMonth}</span><small>2026 extrapolé</small></div>
    </Card>
    <Card className="account-budget-rates">
      <div className="card-title-row"><div><p className="eyebrow">Hypothèses générales</p><h2>{group === 'salesPurchases' ? 'Taux de croissance par activité' : '% de variation 2027 / Indexation des coûts 2027'}</h2><p>Un taux saisi directement sur un compte remplace le taux général.</p></div></div>
      {group === 'salesPurchases'
        ? <div className="account-rate-grid">{departmentOrder.map(key => <label key={key}><span>{departmentLabels[key]}</span><div className="rate-input"><Input type="number" step="0.1" value={plan.accountPlanning.departmentRates[key] === null ? '' : plan.accountPlanning.departmentRates[key]! * 100} placeholder="—" disabled={!editable} onChange={event => updateDepartmentRate(key, event.target.value === '' ? null : Number(event.target.value) / 100)} /><span>%</span></div></label>)}</div>
        : <div className="account-rate-grid">{categoryOrder.map(key => <label key={key}><span>{categoryLabels[key]}</span><div className="rate-input"><Input type="number" step="0.1" value={plan.accountPlanning.categoryRates[key] === null ? '' : plan.accountPlanning.categoryRates[key]! * 100} placeholder="—" disabled={!editable} onChange={event => updateCategoryRate(key, event.target.value === '' ? null : Number(event.target.value) / 100)} /><span>%</span></div></label>)}</div>}
    </Card>
    <Card className="account-budget-card">
      <div className="card-title-row account-budget-toolbar"><div><p className="eyebrow">Revue ligne par ligne</p><h2>Construction du budget 2027</h2><p>Montants en EUR. Une hypothèse non définie reste vide : elle n’est jamais assimilée à zéro.</p></div><div className="account-budget-actions"><label className="account-budget-search"><Search size={15} /><Input value={search} placeholder="Compte ou libellé" onChange={event => setSearch(event.target.value)} /></label>{editable && <Button variant="secondary" onClick={add}><Plus size={16} />Ajouter un poste</Button>}</div></div>
      <div className="budget-table-wrap"><table className="account-budget-table"><thead><tr><th>Compte</th><th>Libellé Odoo</th><th>{group === 'salesPurchases' ? 'Activité' : 'Sous-catégorie'}</th>{group === 'salesPurchases' && <th>Sous-catégorie</th>}<th>2025</th><th>2026 extrapolé</th><th>Méthode</th><th>% ou montant</th><th>Budget 2027</th><th>Hypothèse / commentaire</th><th></th></tr></thead><tbody>{visible.map(line => {
        const source = sourceById.get(line.sourceAccountId ?? '');
        const value = gimiBudgetAccountValue(line, source?.amount2026 ?? null, plan.accountPlanning);
        const grouping = group === 'salesPurchases'
          ? `${line.accountCode.startsWith('7') ? 'Revenus' : 'Achats'} · ${departmentLabels[line.department]} · ${salesSubcategoryLabels[line.subcategory]}`
          : `Classe ${line.accountCode.slice(0, 2) || '—'} · ${categoryLabels[line.category]}`;
        const showGroup = grouping !== previousGroup; previousGroup = grouping;
        const columnCount = group === 'salesPurchases' ? 11 : 10;
        return <Fragment key={line.id}>{showGroup && <tr className="account-group-row"><td colSpan={columnCount}>{grouping}</td></tr>}<tr className={line.method === 'pending' ? 'pending-row' : ''}>
          <td>{line.manual ? <Input inputMode="numeric" value={line.accountCode} placeholder="6… / 7…" disabled={!editable} onChange={event => upsert(line, { accountCode: event.target.value.replace(/\D/g, '').slice(0, 12) })} /> : line.accountCode}</td>
          <td>{line.manual ? <Input value={line.accountLabel} disabled={!editable} onChange={event => upsert(line, { accountLabel: event.target.value })} /> : line.accountLabel}</td>
          <td>{group === 'salesPurchases' ? <Select value={line.department} disabled={!editable} onChange={event => upsert(line, { department: event.target.value as GimiBudgetAccountDepartment })}>{departmentOrder.map(key => <option key={key} value={key}>{departmentLabels[key]}</option>)}</Select> : <Select value={line.category} disabled={!editable} onChange={event => upsert(line, { category: event.target.value as GimiBudgetOperatingCategory })}>{categoryOrder.map(key => <option key={key} value={key}>{categoryLabels[key]}</option>)}</Select>}</td>
          {group === 'salesPurchases' && <td><Select value={line.subcategory} disabled={!editable} onChange={event => upsert(line, { subcategory: event.target.value as GimiBudgetSalesSubcategory })}>{salesSubcategoryOrder.map(key => <option key={key} value={key}>{salesSubcategoryLabels[key]}</option>)}</Select></td>}
          <td className="amount-cell">{source?.amount2025 == null ? '—' : money.format(source.amount2025)}</td><td className="amount-cell">{source?.amount2026 == null ? '—' : money.format(source.amount2026)}</td>
          <td><Select value={line.method} disabled={!editable} onChange={event => upsert(line, { method: event.target.value as GimiBudgetAccountMethod })}>{methodOptions(group).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></td>
          <td>{line.method === 'indexation' || line.method === 'growth' ? <div className="rate-input"><Input type="number" step="0.1" value={line.indexationRate === null ? '' : line.indexationRate * 100} placeholder="taux général" disabled={!editable} onChange={event => upsert(line, { indexationRate: event.target.value === '' ? null : Number(event.target.value) / 100 })} /><span>%</span></div> : line.method === 'absolute' ? <Input type="number" min="0" step="100" value={line.absolute2027 ?? ''} placeholder="Montant" disabled={!editable} onChange={event => upsert(line, { absolute2027: event.target.value === '' ? null : Math.abs(Number(event.target.value)) })} /> : <span className="muted">—</span>}</td>
          <td className="amount-cell budget-2027-cell">{value === null ? '—' : money.format(value)}</td><td><Input value={line.note} placeholder="Justification ou point à confirmer" disabled={!editable} onChange={event => upsert(line, { note: event.target.value })} /></td><td>{line.manual && editable ? <button className="icon-button" aria-label={`Supprimer ${line.accountLabel}`} onClick={() => remove(line.id)}><Trash2 size={16} /></button> : null}</td>
        </tr></Fragment>;
      })}{!visible.length && <tr><td className="empty-row" colSpan={group === 'salesPurchases' ? 11 : 10}>Aucun compte ne correspond à la recherche.</td></tr>}</tbody></table></div>
    </Card>
  </>;
}
