import { RatioLegend } from '../components/RatioLegend';
import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { Button, Card, ErrorState, LoadingState } from '../components/ui';
import './margin-analysis.css';

const money=new Intl.NumberFormat('fr-BE',{maximumFractionDigits:0});
const percentage=new Intl.NumberFormat('fr-BE',{style:'percent',maximumFractionDigits:1});
const format=(amount:number)=>money.format(Math.round(amount/1000)||0);

export function MarginAnalysis({companyId}:{companyId:string}){
  const q=useQuery({queryKey:['margin-analysis',companyId],queryFn:()=>api.marginAnalysis(companyId)});
  const [open,setOpen]=useState<Set<string>>(new Set());
  if(q.isLoading)return <LoadingState/>;
  if(q.error||!q.data)return <><ErrorState message={q.error instanceof Error?q.error.message:'Impossible de charger l’analyse de marge.'}/><Button onClick={()=>q.refetch()}>Réessayer</Button></>;
  const report=q.data,revenue=report.blocks[0];
  const toggle=(key:string)=>setOpen(previous=>{const next=new Set(previous);next.has(key)?next.delete(key):next.add(key);return next;});
  const rate=(value:number,base:number)=>Math.abs(base)<0.005?'—':percentage.format(value/base);
  return <Card className="profit-loss margin-analysis">
    <div className="profit-loss-heading"><div><p className="eyebrow">Gimi · comptabilité analytique</p><h2>Analyse de marge par département</h2><p>Chiffre d’affaires, marchandises et marge brute selon les clés de répartition enregistrées.</p></div><div className="unit-note">Montants en milliers d’euros, arrondis</div></div>
    <p className="report-note">{report.extrapolatedYear} extrapolé : cumul de janvier au mois {report.lastClosedMonth.slice(5)} × {report.factor.toLocaleString('fr-BE',{maximumFractionDigits:3})}. Les deux années précédentes sont réalisées sur douze mois.</p>
    <RatioLegend basis="du CA total ; pour la marge d’un département, de son propre CA"/><div className="report-table"><table className="margin-matrix">
      <colgroup><col className="margin-label-col"/>{report.years.map(year=><col key={year}/>)}</colgroup>
      <thead><tr><th scope="col">Rubrique / département</th>{report.years.map(year=><th key={year} scope="col">{year}<small>{year===report.extrapolatedYear?'Extrapolé':'Réalisé'}</small></th>)}</tr></thead>
      {report.blocks.map(block=><tbody key={block.key}>
        <tr className="margin-section"><th scope="rowgroup" colSpan={report.years.length+1}>{block.label}</th></tr>
        {block.rows.map(row=>{
          const key=`${block.key}:${row.key}`,expanded=open.has(key);
          return <Fragment key={key}><tr className={block.key==='margin'?'margin-result':''}>
            <th scope="row">{row.accounts.length?<button className="drilldown-button" onClick={()=>toggle(key)} aria-expanded={expanded}>{expanded?<ChevronDown size={16}/>:<ChevronRight size={16}/>}<span>{row.label}</span><small>{row.accounts.length} comptes</small></button>:<span className="margin-empty-label">{row.label}</span>}</th>
            {report.years.map(year=><td key={year}><strong>{format(row.values[year])}</strong><small className="ratio-value">{rate(row.values[year],block.key==='margin'?(revenue.rows.find(item=>item.key===row.key)?.values[year]??0):revenue.totals[year])}</small></td>)}
          </tr>{expanded&&row.accounts.map(account=><tr className="margin-account" key={account.id}><th scope="row"><span>{account.code}</span> {account.label}</th>{report.years.map(year=><td key={year}>{format(account.values[year]??0)}<small className="ratio-value">{rate(account.values[year]??0,revenue.totals[year])}</small></td>)}</tr>)}</Fragment>;
        })}
        <tr className="margin-total"><th scope="row">Total {block.label.toLocaleLowerCase('fr-BE')}</th>{report.years.map(year=><td key={year}><strong>{format(block.totals[year])}</strong><small className="ratio-value">{rate(block.totals[year],revenue.totals[year])}</small></td>)}</tr>
      </tbody>)}
    </table></div>
    <p className="report-note">Marge brute = chiffre d’affaires + marchandises, les charges étant affichées en négatif. « Autres » regroupe les comptes sans clé valide. Le détail affiche la part du compte allouée au département, pas son montant intégral lorsqu’une clé est partagée.</p>
    <p className="report-note">Les clés actuelles s’appliquent aux trois années ; aucune répartition historique n’est reconstituée. Les écritures Odoo sont consultées en lecture seule. Les arrondis peuvent créer un écart apparent dans les sommes affichées.</p>
  </Card>;
}
