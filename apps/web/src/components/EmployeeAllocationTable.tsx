import { isMonthlyCostKey, type AnalyticAllocationCode, type EmployeeAnalyticAllocation } from '@equinoxe/shared';
import { Card, Input, Select } from './ui';
const money=new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0});
export function EmployeeAllocationTable({employees,keys,onChange,disabled=false}:{employees:EmployeeAnalyticAllocation[];keys:AnalyticAllocationCode[];disabled?:boolean;onChange:(id:string,change:Partial<EmployeeAnalyticAllocation>)=>void}){
  return <Card className="analytic-table-card employee-table-card"><div className="analytic-table-wrap"><table className="analytic-table employee-table" aria-label="Répartition employés"><thead><tr><th>Prénom et nom</th><th>Date d’entrée</th><th>Date de fin</th><th>Fonction</th><th>Coût annuel salaire</th><th>Coût annuel voiture</th><th>Clé de répartition</th></tr></thead><tbody>
    {employees.map(employee=><tr key={employee.id}><th scope="row">{employee.fullName}</th><td>{employee.entryDate?employee.entryDate.slice(0,10).split('-').reverse().join('/'):'—'}</td>
      <td><Input disabled={disabled} type="date" aria-label={`Date de fin de ${employee.fullName}`} min={employee.entryDate?.slice(0,10)} value={employee.endDate??''} onChange={event=>onChange(employee.id,{endDate:event.target.value||null})}/></td><td>{employee.function??'—'}</td>
      <td className="employee-money">{employee.annualSalaryCost===null?'—':money.format(employee.annualSalaryCost)}</td><td className="employee-money">{employee.annualCarCost===null?'—':money.format(employee.annualCarCost)}</td>
      <td><Select disabled={disabled} aria-label={`Clé de répartition de ${employee.fullName}`} value={employee.analyticAllocationCodeId??''} onChange={event=>onChange(employee.id,{analyticAllocationCodeId:event.target.value||null})}><option value="">Non affecté</option>{keys.filter(key=>!isMonthlyCostKey(key)).map(key=><option key={key.id} value={key.id}>{key.label}</option>)}</Select></td></tr>)}
  </tbody></table></div>{!employees.length&&<div className="analytic-empty">Aucun employé n’a encore été importé.</div>}</Card>;
}
