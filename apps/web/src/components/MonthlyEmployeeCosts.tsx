import { allocationFields, monthlyEmployeeCost, type AnalyticAllocationCode, type EmployeeAnalyticAllocation } from '@equinoxe/shared';
import { Card } from './ui';
const money=new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}),percent=new Intl.NumberFormat('fr-BE',{style:'percent',maximumFractionDigits:1});
export function MonthlyEmployeeCosts({employees,keys,kind}:{employees:EmployeeAnalyticAllocation[];keys:AnalyticAllocationCode[];kind:'salary'|'vehicle'}){
  const months=[2025,2026].flatMap(year=>Array.from({length:12},(_,index)=>`${year}-${String(index+1).padStart(2,'0')}`));
  const rows=months.map(month=>monthlyEmployeeCost(employees,keys,month,kind));
  const label=kind==='salary'?'salaire':'véhicule';
  const monthLabel=(month:string)=>new Intl.DateTimeFormat('fr-BE',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`));
  return <><Card className="analytic-introduction"><div><p className="eyebrow">Présence mensuelle · 2025–2026</p><h2>Coût {label} par mois</h2><p>Coût annuel divisé par 12. Les mois d’entrée et de départ sont inclus en entier ; la personne est exclue dès le mois suivant son départ. Une date de fin vide ne fixe aucune limite.</p></div><span>24 mois</span></Card>
    <Card className="analytic-table-card cost-table-card"><div className="analytic-table-wrap"><table className="analytic-table cost-allocation-table monthly-cost-table" aria-label={`Coût ${label} par mois`}><thead><tr><th scope="col">Mois</th><th scope="col">Coût {label} mensuel</th>{allocationFields.map(field=><th scope="col" key={field.key}>{field.label}</th>)}<th scope="col">Non réparti</th></tr></thead><tbody>
      {rows.map(row=><tr key={row.month} className={row.month.endsWith('-01')?'cost-summary':''}><th scope="row"><strong>{monthLabel(row.month)}</strong><small className="monthly-presence">{row.activeCount} employés présents</small></th><td className="employee-money">{money.format(row.globalTotal)}</td>{allocationFields.map(field=><td key={field.key}>{row.globalTotal?percent.format(row.departmentTotals[field.key]/row.globalTotal):'—'}</td>)}<td>{row.globalTotal?percent.format(row.unallocated/row.globalTotal):'—'}</td></tr>)}
    </tbody></table></div></Card>
    {rows.some(row=>row.missingEntryCount>0)&&<p className="analytic-validation">Dates d’entrée manquantes : ces personnes sont considérées présentes avant leur éventuelle date de fin. Vérifiez la source.</p>}
    {rows.some(row=>row.missingCostCount>0)&&<p className="analytic-validation">Certains coûts annuels sont absents : les pourcentages couvrent uniquement les coûts connus. La clé {kind==='salary'?'Salaire':'Voiture'} reprend cette même base ; sans base de coût utilisable, le montant comptable reste entièrement non réparti.</p>}
  </>;
}
