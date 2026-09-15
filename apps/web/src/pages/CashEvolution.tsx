import { Fragment, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CartesianGrid, ComposedChart, ErrorBar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from 'recharts';
import type { CashMonth } from '@equinoxe/shared';
import { Button, Card, ErrorState, LoadingState } from '../components/ui';
import { api } from '../services/api';
import './cash-evolution.css';
import { CashMonthAccounts } from '../components/CashMonthAccounts';

const amount = (value: number) => new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 }).format(value / 1000);
const label = (month: string) => new Date(`${month}-01T12:00:00Z`).toLocaleDateString('fr-BE', { month: 'short', year: '2-digit', timeZone: 'UTC' });
const dayLabel = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString('fr-BE', { timeZone: 'UTC' });

function CashTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload?: CashMonth }> }) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  return <div className="cash-chart-tooltip"><strong>{label(row.month)}</strong>
    <span>Moyenne : {amount(row.average)}</span><span>Maximum : {amount(row.maximum)} · {dayLabel(row.maximumDate)}</span>
    <span>Minimum : {amount(row.minimum)} · {dayLabel(row.minimumDate)}</span><small>Milliers d’euros · soldes en fin de journée</small></div>;
}

export function CashEvolution({ companyId, editable, companyName = 'Gimi', companySlug = 'gimi' }: { companyId: string; editable: boolean; companyName?: string; companySlug?: string }) {
  const qc = useQueryClient(), [selected, setSelected] = useState<string | null>(null);
  const query = useQuery({ queryKey: ['cash-history', companyId], queryFn: () => api.cashHistory(companyId) });
  const sync = useMutation({ mutationFn: () => api.syncCashHistory(companyId), onSuccess: () => qc.invalidateQueries({ queryKey: ['cash-history', companyId] }) });
  const download = useMutation({ mutationFn: async () => {
    const blob = await api.exportCashHistory(companyId), url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${companySlug}-tresorerie-2024-01-${query.data?.through.slice(0,7)}.csv`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  } });
  if (query.isLoading) return <LoadingState/>;
  const report = query.data;
  const chart = report?.months.map(month => ({ ...month, meanK: month.average / 1000,
    range: [(month.average - month.minimum) / 1000, (month.maximum - month.average) / 1000] }));
  const selectedDays = report?.days.filter(day => day.date.startsWith(selected ?? 'none')) ?? [];
  return <div className="cash-evolution">
    <Card>
      <div className="cash-evolution-heading"><div><p className="eyebrow">{companyName} · trésorerie et placements</p><h2>Évolution de la trésorerie</h2>
        <p>Moyenne des soldes de fin de journée, tous les jours calendaires compris.</p></div>
        <div className="cash-evolution-actions">{editable && <Button variant="secondary" disabled={sync.isPending} onClick={() => sync.mutate()}>{sync.isPending ? 'Import Odoo en cours…' : report ? 'Actualiser depuis Odoo' : 'Importer depuis janvier 2024'}</Button>}
          {report && <Button variant="secondary" disabled={download.isPending} onClick={() => download.mutate()}>{download.isPending ? 'Export…' : 'Exporter le tableau CSV'}</Button>}</div>
      </div>
      {query.error && <ErrorState message="Impossible de charger l’historique PostgreSQL."/>}
      {sync.error && <ErrorState message={sync.error.message}/>}
      {download.error && <ErrorState message={download.error.message}/>}
      {sync.isSuccess && !sync.isPending && <p role="status">Historique actualisé et enregistré dans PostgreSQL.</p>}
      {!report && !query.error && <p>Aucun historique enregistré. {editable ? 'L’import lit uniquement les écritures validées Odoo et enregistre une copie dans PostgreSQL.' : 'Un administrateur doit importer l’historique.'}</p>}
      {report && <>
        {report.needsSync && <p className="cash-warning" role="status">Historique disponible jusqu’au {dayLabel(report.through)} seulement. Actualisez l’import pour couvrir le mois sélectionné ; les mois manquants ne sont pas affichés à zéro.</p>}
        {companySlug==='eurodrill'&&<p className="cash-warning">Les soldes 2024–2025 reflètent un historique Odoo partiel et des écritures d’annulation/reprise. Le rapprochement confirme le calcul avec Odoo, pas l’exhaustivité des mouvements bancaires.</p>}<div className="cash-evolution-summary">
          <div><span>Ouverture · 31 décembre 2023</span><strong>{amount(report.opening)}</strong></div>
          <div><span>Clôture · {dayLabel(report.through)}</span><strong>{amount(report.closing)}</strong></div>
          <div><span>Période observée</span><strong>{report.months.length} mois</strong></div>
        </div>
        <div className="cash-chart-legend"><span className="cash-average-key"/>Moyenne journalière du mois <span className="cash-range-key"/>Minimum–maximum des soldes journaliers <small>Montants en milliers d’euros</small></div>
        <div className="cash-chart-scroll"><div className="cash-chart" role="img" aria-label="Évolution mensuelle de la trésorerie moyenne avec minimum et maximum ; valeurs détaillées dans le tableau ci-dessous.">
          <ResponsiveContainer width="100%" height={360}><ComposedChart data={chart} margin={{ top: 24, right: 28, bottom: 30, left: 10 }}>
            <CartesianGrid stroke="#eadbc6" vertical={false}/><XAxis dataKey="month" tickFormatter={label} angle={-45} textAnchor="end" height={64} interval={0} tick={{ fontSize: 11 }} tickMargin={12}/>
            <YAxis tickFormatter={value => new Intl.NumberFormat('fr-BE').format(Number(value))} width={65} domain={['auto', 'auto']} tick={{ fontSize: 12 }}/>
            <Tooltip content={<CashTooltip/>}/><ReferenceLine y={0} stroke="#947863"/>
            <Line type="linear" dataKey="meanK" name="Moyenne" stroke="#ac7614" strokeWidth={2} dot={{ r: 4, fill: '#f4b533', stroke: '#724e17' }} isAnimationActive={false}>
              <ErrorBar dataKey="range" width={9} strokeWidth={2} stroke="#937b61" direction="y"/>
            </Line>
          </ComposedChart></ResponsiveContainer>
        </div></div>
        <p className="report-note">Source : Odoo, écritures validées, comptes de classe 5 (même périmètre que le bilan), débit − crédit, en EUR. Import du {new Date(report.importedAt).toLocaleString('fr-BE')} · {report.movementCount.toLocaleString('fr-BE')} mouvements · {report.accounts.length} comptes. Les jours sans mouvement conservent le solde précédent. L’import est actualisable avec le bouton ci-dessus.</p>
      </>}
    </Card>
    {report && <>
      <Card><h2>Détail mensuel</h2><p>Montants en milliers d’euros. Cliquez sur un mois pour consulter tous ses comptes et ses soldes journaliers.</p>
        <div className="report-table"><table className="report-matrix cash-month-table"><thead><tr><th>Mois</th><th>Jours</th><th>Moyenne</th><th>Minimum</th><th>Maximum</th><th>Fin de mois</th><th>Contrôle Odoo</th></tr></thead>
          <tbody>{report.months.map(month => <Fragment key={month.month}><tr className={selected === month.month ? 'cash-selected' : ''}>
            <td><button className="cash-month-button" aria-expanded={selected === month.month} onClick={() => setSelected(selected === month.month ? null : month.month)}>{label(month.month)}</button></td>
            <td>{month.days}</td><td><strong>{amount(month.average)}</strong></td><td title={dayLabel(month.minimumDate)}>{amount(month.minimum)}</td><td title={dayLabel(month.maximumDate)}>{amount(month.maximum)}</td><td>{amount(month.closing)}</td>
            <td>{companySlug==='eurodrill'&&month.month<'2026-01'&&<small>Historique partiel · </small>}{Math.abs(month.difference) <= .01 ? 'Rapproché' : `Écart : ${month.difference.toFixed(2)} EUR`}</td>
          </tr>{selected === month.month && <tr><td colSpan={7}><CashMonthAccounts month={month}/><div className="cash-daily-table"><h3>Soldes journaliers · {label(month.month)}</h3><p>Montants en milliers d’euros · fin de journée.</p><table className="report-matrix"><thead><tr><th>Date</th><th>Mouvements nets</th><th>Solde de clôture</th></tr></thead><tbody>{selectedDays.map(day => <tr key={day.date}><td>{dayLabel(day.date)}</td><td>{amount(day.movement)}</td><td>{amount(day.closing)}</td></tr>)}</tbody></table></div></td></tr>}</Fragment>)}</tbody></table></div>
      </Card>
      <Card><details><summary>Comptes inclus et soldes d’ouverture / clôture</summary><p>Montants en milliers d’euros. Solde d’ouverture au 31 décembre 2023 ; clôture au {dayLabel(report.through)}.</p><div className="report-table"><table className="report-matrix"><thead><tr><th>Compte</th><th>Ouverture</th><th>Clôture</th></tr></thead><tbody>{report.accounts.filter(row => row.opening !== 0 || row.closing !== 0).map(account => <tr key={account.id}><td>{account.code} · {account.label}</td><td>{amount(account.opening)}</td><td>{amount(account.closing)}</td></tr>)}</tbody></table></div></details></Card>
    </>}
  </div>;
}
