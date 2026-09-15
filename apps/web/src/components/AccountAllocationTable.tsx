import { Fragment } from 'react';
import { BookOpen } from 'lucide-react';
import type { AccountAnalyticAllocation, AnalyticAllocationCode, AccountAllocationAmounts } from '@equinoxe/shared';
import { Card, Select } from './ui';
import './account-allocation-table.css';

const amount = (value: number | null | undefined) => value == null ? '—' : new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 }).format(value / 1000);
const exactAmount = (value: number | null | undefined) => value == null ? 'Montant indisponible' : new Intl.NumberFormat('fr-BE', { style: 'currency', currency: 'EUR' }).format(value);

export function AccountAllocationTable({accounts, allocationKeys, onChange, amounts, amountsLoading = false, amountsError = false}: {
  accounts: AccountAnalyticAllocation[];
  allocationKeys: AnalyticAllocationCode[];
  onChange: (id: string, keyId: string | null) => void;
  amounts?: AccountAllocationAmounts;
  amountsLoading?: boolean;
  amountsError?: boolean;
}) {
  const byId = new Map(amounts?.accounts.map(row => [row.accountId,row]) ?? []);
  return <Card className="analytic-table-card employee-table-card">
    <div className="account-amounts-note">
      <p>Montants en milliers d’euros, avant répartition · produits positifs, charges négatives.</p>
      <p>2025 : année réalisée. 2026 extrapolé : cumul jusqu’au mois clôturé × 12 / nombre de mois.
        {amounts && <> Mois clôturé : {amounts.lastClosedMonth}. {amounts.lastClosedMonth >= '2026-12' && '2026 est entièrement réalisée (facteur 1).'}</>}</p>
      {amountsLoading && <p role="status">Chargement des montants Odoo…</p>}
      {amountsError && <p role="alert">Montants Odoo indisponibles. Les clés restent modifiables ; aucun zéro n’est substitué aux montants manquants.</p>}
    </div>
    <div className="analytic-table-wrap"><table className="analytic-table employee-table account-allocation-table">
      <thead><tr><th scope="col">Numéro de compte</th><th scope="col">Intitulé du compte</th><th scope="col" className="account-amount">2025</th><th scope="col" className="account-amount">2026 extrapolé</th><th scope="col">Clé de répartition</th></tr></thead>
      <tbody>{accounts.map((account, index) => <Fragment key={account.id}>
        {(index === 0 || accounts[index - 1]?.profitLossSectionId !== account.profitLossSectionId) &&
          <tr className="allocation-section"><th scope="rowgroup" colSpan={5}>{account.profitLossSectionLabel ?? 'Non classé'}<small>Rubrique du compte de résultat</small></th></tr>}
        <tr><th scope="row"><span className="employee-name"><BookOpen size={17}/><strong>{account.accountCode}</strong></span></th>
          <td>{account.accountLabel}</td>
          <td className="account-amount" title={exactAmount(amountsError ? null : byId.get(account.odooAccountId)?.amount2025)}>{amountsLoading ? '…' : amount(amountsError ? null : byId.get(account.odooAccountId)?.amount2025)}</td>
          <td className="account-amount" title={exactAmount(amountsError ? null : byId.get(account.odooAccountId)?.amount2026)}>{amountsLoading ? '…' : amount(amountsError ? null : byId.get(account.odooAccountId)?.amount2026)}</td>
          <td><Select aria-label={`Clé de répartition du compte ${account.accountCode}`} value={account.analyticAllocationCodeId ?? ''} onChange={event => onChange(account.id, event.target.value || null)}>
            <option value="">Non affecté — à préciser</option>
            {allocationKeys.map(key => <option key={key.id} value={key.id}>{key.label}</option>)}
          </Select></td></tr>
      </Fragment>)}</tbody>
    </table></div>
    {!accounts.length && <div className="analytic-empty">Aucun compte de résultat n’a été trouvé dans Odoo.</div>}
  </Card>;
}
