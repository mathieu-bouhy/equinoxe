import { Fragment, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Sigma } from 'lucide-react';
import { allocationFields } from '@equinoxe/shared';
import type { AllocationDepartment, AnalyticAccount, AnalyticPeriod, AnalyticReportMode } from '@equinoxe/shared';
import { api } from '../services/api';
import { Button, Card, EmptyState, ErrorState, LoadingState } from './ui';
import './analytic-profit-loss.css';

const amount=(n:number)=>new Intl.NumberFormat('fr-BE',{maximumFractionDigits:0}).format(n/1000);
const euros=(n:number)=>new Intl.NumberFormat('fr-BE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
const percent=(n:number,base:number)=>base?new Intl.NumberFormat('fr-BE',{style:'percent',maximumFractionDigits:1}).format(n/base):'—';
const monthLabel=(month:string)=>new Intl.DateTimeFormat('fr-BE',{month:'short',year:'2-digit',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`));
const titles={annual:'Compte de résultat simplifié',ltm:'Compte de résultat LTM',extrapolated:'Compte de résultat extrapolé'};

export function AnalyticDepartmentSelector({value,onChange}:{value:AllocationDepartment[]|null;onChange:(value:AllocationDepartment[]|null)=>void}){
  return <Card className="analytic-report-filter"><fieldset><legend>Départements analytiques</legend><div className="analytic-report-options">
    {allocationFields.map(field=><label key={field.key}><input type="checkbox" checked={value?.includes(field.key)??false} onChange={()=>onChange(value?.includes(field.key)?value.filter(key=>key!==field.key):[...(value??[]),field.key])}/>{field.label.replace(' — ',' ')}</label>)}
    <Button variant={value===null?'primary':'secondary'} aria-pressed={value===null} onClick={()=>onChange(null)}>Société entière</Button>
  </div></fieldset><p>{value===null?'Vue globale : tous les comptes, y compris les non-affectés.':'Les départements cochés sont additionnés. Le filtre ne modifie ni le bilan ni les flux de trésorerie.'}</p></Card>;
}
export function GimiProfitLoss({companyId,mode,closed,children}:{companyId:string;mode:AnalyticReportMode;closed?:string;children:ReactNode}){
  const [selected,setSelected]=useState<AllocationDepartment[]|null>(null);
  const departments=allocationFields.map(f=>f.key).filter(key=>selected?.includes(key));
  return <><AnalyticDepartmentSelector value={selected} onChange={setSelected}/>{selected===null?children:!departments.length?<EmptyState title="Aucun département sélectionné">Cochez un département ou revenez à Société entière.</EmptyState>:<AnalyticReport key={`${mode}:${departments.join(',')}:${closed}`} companyId={companyId} mode={mode} departments={departments} closed={closed}/>}</>;
}
type Detail={account:AnalyticAccount;period:AnalyticPeriod;month?:string};
function AnalyticReport({companyId,mode,departments,closed}:{companyId:string;mode:AnalyticReportMode;departments:AllocationDepartment[];closed?:string}){
  const q=useQuery({queryKey:['analytic-profit-loss',companyId,mode,departments,closed],queryFn:()=>api.analyticProfitLoss(companyId,mode,departments),retry:1});
  const [open,setOpen]=useState(new Set<string>()),[expanded,setExpanded]=useState(new Set<string>()),[detail,setDetail]=useState<Detail|null>(null);
  if(q.isLoading)return <LoadingState/>;
  if(q.error||!q.data)return <ErrorState message={q.error instanceof Error?q.error.message:'Impossible de calculer le compte de résultat analytique.'}/>;
  const report=q.data,revenue=report.lines.find(l=>l.key===report.revenueKey);
  const toggle=(key:string,set:typeof setOpen)=>set(old=>{const next=new Set(old);next.has(key)?next.delete(key):next.add(key);return next;});
  const cells=(values:Record<string,number>,monthly:Record<string,number>,ratios=false,account?:AnalyticAccount)=>report.periods.map(p=><Fragment key={p.key}>
    <td>{ratios?percent(values[p.key]??0,revenue?.values[p.key]??0):account?<button className="amount-button" title={`Montant comptable réalisé : ${euros(account.originalValues[p.key]??0)} · part analytique ${p.factor!==1?'extrapolée':''}`} onClick={()=>setDetail({account,period:p})}>{amount(values[p.key]??0)}</button>:amount(values[p.key]??0)}</td>
    {expanded.has(p.key)&&p.months.map(month=><td className="month-cell" key={month}>{ratios?percent(monthly[month]??0,revenue?.monthlyValues[month]??0):account?<button className="amount-button" onClick={()=>setDetail({account,period:p,month})}>{amount(monthly[month]??0)}</button>:amount(monthly[month]??0)}</td>)}
  </Fragment>);
  const accountRows=(accounts:AnalyticAccount[])=>accounts.map(account=><Fragment key={account.id}><tr className="account-row"><td><em>{account.code}</em>{account.label}<small className="analytic-key-label">{account.keyLabel}</small></td>{cells(account.values,account.monthlyValues,false,account)}</tr><tr className="percentage-row"><td>% du CA sélectionné</td>{cells(account.values,account.monthlyValues,true)}</tr></Fragment>);
  return <><Card className="profit-loss analytic-pnl"><div className="profit-loss-heading"><div><p className="eyebrow">Gimi · sélection analytique · Odoo en lecture seule</p><h2>{titles[mode]}</h2><p>{departments.map(d=>allocationFields.find(f=>f.key===d)!.label).join(' + ')}</p></div><div className="unit-note"><Sigma size={17}/><span>Milliers d’euros · sans décimales</span></div></div>
    <p className="report-note">Clés actuellement enregistrées appliquées à toutes les années. Salaire et Voiture : répartition mensuelle selon les coûts connus et les dates de présence, pas un historique réel des salaires.</p>
    {mode==='extrapolated'&&<p className="report-note">Seul le total de la dernière année est extrapolé (× {report.periods[report.periods.length-1].factor.toLocaleString('fr-BE')}). Les colonnes mensuelles et les écritures restent réalisées.</p>}
    {report.warnings.map(w=><p className="analytic-report-warning" key={w}>{w}</p>)}
    {report.unallocated.length>0&&<details className="analytic-report-warning"><summary>{report.unallocated.length} comptes comportent des montants non répartis, exclus de cette sélection.</summary><p>La somme des quatre départements peut donc différer de « Société entière ». Affectez ces comptes dans la configuration pour les inclure.</p><ul>{report.unallocated.map(a=><li key={a.id}>{a.code} · {a.label} — {report.periods.map(p=>`${p.label} : ${amount(a.values[p.key]??0)}`).join(' ; ')}</li>)}</ul></details>}
    <div className="report-table"><table className="report-matrix analytic-pnl-matrix" style={{minWidth:`calc(var(--analytic-label-width, 360px) + ${116*report.periods.reduce((sum,p)=>sum+1+(expanded.has(p.key)?p.months.length:0),0)}px)`}} aria-label={titles[mode]}><colgroup><col/>{report.periods.flatMap(p=>Array.from({length:1+(expanded.has(p.key)?p.months.length:0)},(_,i)=><col className="analytic-number-col" key={`${p.key}:${i}`}/>))}</colgroup><thead><tr><th rowSpan={2}>Rubrique</th>{report.periods.map(p=><th key={p.key} colSpan={1+(expanded.has(p.key)?p.months.length:0)}><button className="year-button" aria-expanded={expanded.has(p.key)} onClick={()=>toggle(p.key,setExpanded)}>{expanded.has(p.key)?<ChevronDown size={15}/>:<ChevronRight size={15}/>} {p.label}{p.factor!==1?' · extrapolée':''}</button></th>)}</tr><tr>{report.periods.map(p=><Fragment key={p.key}><th>Total</th>{expanded.has(p.key)&&p.months.map(m=><th className="month-head" key={m}>{monthLabel(m)}</th>)}</Fragment>)}</tr></thead><tbody>
      {report.lines.map(line=><Fragment key={line.key}><tr className={line.kind==='calculation'?`calculation-row ${/EBITDA|Résultat/i.test(line.label)?'key-calculation':''}`:'account-section'}><td>{line.accounts.length?<button className="drilldown-button" aria-expanded={open.has(line.key)} onClick={()=>toggle(line.key,setOpen)}>{open.has(line.key)?<ChevronDown size={17}/>:<ChevronRight size={17}/>}<span>{line.label}</span><small>{line.accounts.length} comptes</small></button>:<span className="calculation-label">{line.kind==='calculation'&&<Sigma size={15}/>} {line.label}</span>}</td>{cells(line.values,line.monthlyValues)}</tr><tr className="percentage-row"><td>% du CA sélectionné</td>{cells(line.values,line.monthlyValues,true)}</tr>
        {open.has(line.key)&&<>{line.subsections.map(sub=><Fragment key={sub.id}><tr className="subsection-row"><td><button className="drilldown-button" aria-expanded={open.has(sub.id)} onClick={()=>toggle(sub.id,setOpen)}>{open.has(sub.id)?<ChevronDown size={15}/>:<ChevronRight size={15}/>} {sub.label}</button></td>{cells(sub.values,sub.monthlyValues)}</tr><tr className="percentage-row"><td>% du CA sélectionné</td>{cells(sub.values,sub.monthlyValues,true)}</tr>{open.has(sub.id)&&accountRows(sub.accounts)}</Fragment>)}{accountRows(line.accounts.filter(a=>!line.subsections.some(s=>s.accounts.some(b=>b.id===a.id))))}</>}
      </Fragment>)}
    </tbody></table></div><p className="report-note">Généré le {new Date(report.generatedAt).toLocaleString('fr-BE')}. Le retour à Société entière conserve le rapport global d’origine.</p>
  </Card>{detail&&<AnalyticEntryDetails key={`${detail.account.id}:${detail.period.key}:${detail.month}`} companyId={companyId} mode={mode} departments={departments} detail={detail} onClose={()=>setDetail(null)}/>}</>;
}
function AnalyticEntryDetails({companyId,mode,departments,detail,onClose}:{companyId:string;mode:AnalyticReportMode;departments:AllocationDepartment[];detail:Detail;onClose:()=>void}){
  const {account,period,month}=detail,q=useQuery({queryKey:['analytic-entries',companyId,mode,departments,account.id,period.key,month],queryFn:()=>api.analyticEntries(companyId,mode,departments,account.id,period.key,month),retry:1});
  const expected=month?account.monthlyValues[month]??0:account.values[period.key]??0;
  return <Card className="analytic-ledger"><div className="profit-loss-heading"><div><p className="eyebrow">Écritures comptables · montants en euros</p><h3>{account.code} · {account.label}</h3><p>{month?monthLabel(month):period.label} · clé {account.keyLabel}</p></div><Button variant="secondary" onClick={onClose}>Fermer le détail</Button></div>
    {q.isLoading?<LoadingState/>:q.error||!q.data?<ErrorState message={q.error instanceof Error?q.error.message:'Détail indisponible.'}/>:<>
      {Math.abs(q.data.projectedTotal-expected)>.01&&<p className="analytic-report-warning">Les écritures ou la configuration ont changé depuis le chargement du tableau. Rechargez le rapport pour rapprocher les totaux.</p>}
      {q.data.factor!==1&&<p>Les intérêts, charges et produits ci-dessous sont les écritures réalisées. Total analytique réalisé × {q.data.factor.toLocaleString('fr-BE')} = total extrapolé : {euros(q.data.projectedTotal)}.</p>}
      <div className="report-table"><table aria-label="Détail analytique des écritures"><thead><tr><th>Date comptable</th><th>Libellé</th><th>Partenaire</th><th>Débit original</th><th>Crédit original</th><th>Part retenue</th><th>Montant analytique</th><th>Odoo</th></tr></thead><tbody>{q.data.rows.map(row=><tr key={row.id}><td>{row.date}</td><td>{row.label}</td><td>{row.partner??'—'}</td><td>{euros(row.debit)}</td><td>{euros(row.credit)}</td><td>{percent(row.share,1)}</td><td>{euros(row.allocatedAmount)}</td><td>{row.odooUrl&&<a href={row.odooUrl} target="_blank" rel="noreferrer">Odoo</a>}</td></tr>)}</tbody><tfoot><tr><th colSpan={6}>Total analytique réalisé</th><td>{euros(q.data.allocatedTotal)}</td><td/></tr></tfoot></table></div>
      {!q.data.rows.length&&<p>Aucune écriture avec une part retenue sur cette période.</p>}
    </>}
  </Card>;
}
