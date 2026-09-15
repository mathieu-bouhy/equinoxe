import type { CashMonth } from '@equinoxe/shared';

const amount = (value: number) => new Intl.NumberFormat('fr-BE', { maximumFractionDigits: 0 }).format(value / 1000);
const exact = (value: number) => new Intl.NumberFormat('fr-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value) + ' EUR';
const cell = (value: number) => <td title={exact(value)}>{amount(value)}</td>;

export function CashMonthAccounts({ month }: { month: CashMonth }) {
  const label = new Date(`${month.month}-01T12:00:00Z`).toLocaleDateString('fr-BE', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const active = (account: CashMonth['accounts'][number]) => [account.opening, account.closing, account.debit, account.credit, account.average].some(value => value !== 0);
  const accounts = [...month.accounts].sort((a, b) => Number(active(b)) - Number(active(a)) || a.code.localeCompare(b.code));
  return <section className="cash-account-detail" aria-label={`Soldes des comptes · ${label}`}>
    <h3>Soldes de tous les comptes · {label}</h3>
    <p>{month.accounts.length} comptes inclus, y compris les comptes à zéro, présentés après les comptes actifs du mois. Montants en milliers d’euros ; survolez un montant pour les euros et centimes.</p>
    <p>La colonne Moyenne décompose la moyenne du mois. Début et fin de mois sont des soldes à une date précise ; mouvement net = débits − crédits. Les arrondis peuvent créer un écart d’affichage.</p>
    <div className="cash-account-scroll"><table className="report-matrix cash-account-table">
      <thead><tr><th>Compte</th><th>Début de mois</th><th>Mouvement net</th><th>Moyenne</th><th>Fin de mois</th></tr></thead>
      <tbody>{accounts.map(account => <tr key={account.id}>
        <td><span>{account.code}</span> · {account.label}</td>{cell(account.opening)}{cell(account.movement)}{cell(account.average)}{cell(account.closing)}
      </tr>)}</tbody>
      <tfoot><tr><th>Total du mois</th>{cell(month.opening)}{cell(month.movement)}{cell(month.average)}{cell(month.closing)}</tr></tfoot>
    </table></div>
  </section>;
}
