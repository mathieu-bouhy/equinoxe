import { Fragment } from 'react';
import { BookOpen } from 'lucide-react';
import type { AccountAnalyticAllocation, AnalyticAllocationCode } from '@equinoxe/shared';
import { Card, Select } from './ui';
import './account-allocation-table.css';

export function AccountAllocationTable({accounts, allocationKeys, onChange}: {
  accounts: AccountAnalyticAllocation[];
  allocationKeys: AnalyticAllocationCode[];
  onChange: (id: string, keyId: string | null) => void;
}) {
  return <Card className="analytic-table-card employee-table-card">
    <div className="analytic-table-wrap"><table className="analytic-table employee-table account-allocation-table">
      <thead><tr><th scope="col">Numéro de compte</th><th scope="col">Intitulé du compte</th><th scope="col">Clé de répartition</th></tr></thead>
      <tbody>{accounts.map((account, index) => <Fragment key={account.id}>
        {(index === 0 || accounts[index - 1]?.profitLossSectionId !== account.profitLossSectionId) &&
          <tr className="allocation-section"><th scope="rowgroup" colSpan={3}>{account.profitLossSectionLabel ?? 'Non classé'}<small>Rubrique du compte de résultat</small></th></tr>}
        <tr><th scope="row"><span className="employee-name"><BookOpen size={17}/><strong>{account.accountCode}</strong></span></th>
          <td>{account.accountLabel}</td>
          <td><Select aria-label={`Clé de répartition du compte ${account.accountCode}`} value={account.analyticAllocationCodeId ?? ''} onChange={event => onChange(account.id, event.target.value || null)}>
            <option value="">Non affecté — à préciser</option>
            {allocationKeys.map(key => <option key={key.id} value={key.id}>{key.label}</option>)}
          </Select></td></tr>
      </Fragment>)}</tbody>
    </table></div>
    {!accounts.length && <div className="analytic-empty">Aucun compte de résultat n’a été trouvé dans Odoo.</div>}
  </Card>;
}
