import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { BalanceAccount, BalanceLine, BalanceReport } from '@equinoxe/shared';
import { Card } from './ui';
import './balance-table.css';

const amount=(value:number|undefined)=>value===undefined?'—':new Intl.NumberFormat('fr-BE',{maximumFractionDigits:0}).format(value/1000);
const accountLabel=(account:BalanceAccount)=>account.label.startsWith(account.code)?account.label.slice(account.code.length).trim():account.label;
export function visibleBalanceAccounts(accounts:BalanceAccount[],years:number[]){
  return accounts.filter(account=>years.some(year=>account.values[year]===undefined||Math.abs(account.values[year])>.004));
}

export function BalanceTable({report}:{report:BalanceReport}){
  const [open,setOpen]=useState(new Set<string>());
  const toggle=(key:string)=>setOpen(previous=>{const next=new Set(previous);next.has(key)?next.delete(key):next.add(key);return next;});
  const unavailable=(year:number)=>report.periods?.find(period=>period.year===year)?.status==='unavailable';
  const value=(values:Record<string,number>,year:number)=>amount(unavailable(year)?undefined:values[year]);
  function section(title:string,lines:BalanceLine[]){
    return <section className="company-balance-section" aria-label={title}><h3>{title}</h3>
      <div className="company-balance-scroll" tabIndex={0} role="region" aria-label={`Tableau ${title}`}>
        <table className="company-balance-matrix" aria-label={`Bilan ${title}`}>
          <colgroup><col className="balance-label-col"/>{report.years.map(year=><col key={year}/>)}</colgroup>
          <thead><tr><th scope="col">Rubrique</th>{report.years.map(year=><th scope="col" key={year}>{year}</th>)}</tr></thead>
          <tbody>{lines.map(line=>{
            const accounts=visibleBalanceAccounts(line.accounts,report.years),expanded=open.has(line.key);
            return <Fragment key={line.key}><tr className="balance-summary-row"><th scope="row">
              {accounts.length?<button className="balance-toggle" aria-expanded={expanded} onClick={()=>toggle(line.key)}>
                {expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}<span>{line.label}<small>{accounts.length} comptes</small></span>
              </button>:<span className="balance-static-label">{line.label}</span>}
            </th>{report.years.map(year=><td key={year}>{value(line.values,year)}</td>)}</tr>
            {expanded&&accounts.map(account=><tr className="balance-detail-row" key={account.code}><th scope="row"><span className="balance-account-code">{account.code}</span>{accountLabel(account)}</th>{report.years.map(year=><td key={year}>{value(account.values,year)}</td>)}</tr>)}</Fragment>;
          })}</tbody>
          <tfoot><tr><th scope="row">Total {title.toLowerCase()}</th>{report.years.map(year=><td key={year}>{amount(unavailable(year)?undefined:lines.reduce((sum,line)=>sum+(line.values[year]??0),0))}</td>)}</tr></tfoot>
        </table>
      </div>
    </section>;
  }
  return <Card className="balance-card company-balance-card">
    <div className="profit-loss-heading"><div><p className="eyebrow">Bilan comptable</p><h2>Actif & passif</h2><p>Ouvrez une rubrique pour consulter les numéros et les soldes des comptes.</p></div></div>
    <div className="company-balance-columns">{section('Actif',report.assets)}{section('Passif',report.liabilities)}</div>
    {report.periods&&<div className="balance-provenance">{report.periods.map(period=><div key={period.year} className={period.status==='available'?'':'balance-period-warning'}>
      <strong>{period.year} · {period.source==='history'?'Historique Excel enregistré':'Odoo · écritures validées'} · au {period.asOf.split('-').reverse().join('/')}</strong>
      {period.status!=='available'&&<span>{period.status==='unavailable'?'Données indisponibles':'Données incomplètes / à vérifier'}</span>}
      {period.warnings.map(warning=><p key={warning}>{warning}</p>)}
    </div>)}</div>}
    <p className="report-note">Montants en milliers d’euros, arrondis sans décimales · — : données indisponibles.</p>
  </Card>;
}
