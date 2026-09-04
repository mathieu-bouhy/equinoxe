import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Save, Upload } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import type { HoursClient, PublicUser, TimeEntry } from '@equinoxe/shared';
import { Button, Card, ErrorState, LoadingState, PageHeader } from '../components/ui';
import { api } from '../services/api';
import './time-tracking.css';

const billableClients=['Gimi','Eurodrill'] as const;
type Tab='all'|'Gimi'|'Eurodrill'|'billing';
const agendaHours=(entry:TimeEntry)=>Math.max(0,(new Date(entry.end).getTime()-new Date(entry.start).getTime())/3_600_000);
const correctedHours=(entry:TimeEntry)=>entry.correctedHours??agendaHours(entry);
const hours=(value:number)=>new Intl.NumberFormat('fr-BE',{minimumFractionDigits:0,maximumFractionDigits:2}).format(value);
const amount=(value:number)=>new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:2}).format(value);
const date=(value:string)=>new Intl.DateTimeFormat('fr-BE',{dateStyle:'medium'}).format(new Date(value));
const time=(value:string)=>new Intl.DateTimeFormat('fr-BE',{hour:'2-digit',minute:'2-digit'}).format(new Date(value));
const month=(key:string)=>new Intl.DateTimeFormat('fr-BE',{month:'long',year:'numeric'}).format(new Date(`${key}-01T12:00:00`));
const monthKey=(value:string)=>value.slice(0,7);
type InvoiceMonth={period:string;meetings:TimeEntry[]};

const csvCell=(value:string|number)=>`"${String(value).replace(/"/g,'""')}"`;
const exportNumber=(value:number)=>value.toFixed(2).replace('.',',');

function exportBilling(invoices:InvoiceMonth[],rate:number,diverseHours:number){
  const lines:Array<Array<string|number>>=[['Mois','Client','Prestation','Date','Début','Fin','Heures agenda','Heures corrigées','Taux horaire HTVA','Montant HTVA']];
  let totalHours=0;
  for(const invoice of invoices){
    let monthlyHours=diverseHours;
    for(const entry of invoice.meetings){
      const entryHours=correctedHours(entry);
      monthlyHours+=entryHours;
      lines.push([month(invoice.period),`Mathieu · ${entry.client}`,entry.title,date(entry.start),time(entry.start),time(entry.end),exportNumber(agendaHours(entry)),exportNumber(entryHours),exportNumber(rate),exportNumber(entryHours*rate)]);
    }
    lines.push([month(invoice.period),'Mathieu · Gimi','Suivi divers','Forfait mensuel','—','—','—',exportNumber(diverseHours),exportNumber(rate),exportNumber(diverseHours*rate)]);
    lines.push([month(invoice.period),'Toutes prestations','Total du mois','—','—','—','—',exportNumber(monthlyHours),'—',exportNumber(monthlyHours*rate)]);
    totalHours+=monthlyHours;
  }
  lines.push(['Total prévisionnel','Toutes prestations','—','—','—','—','—',exportNumber(totalHours),'—',exportNumber(totalHours*rate)]);
  const csv=`\uFEFF${lines.map(row=>row.map(csvCell).join(';')).join('\n')}`;
  const link=document.createElement('a');
  link.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  link.download=`equinoxe-facturation-mensuelle-${new Date().toISOString().slice(0,10)}.csv`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
}

export function TimeTracking(){
  const {me}=useOutletContext<{me:PublicUser}>(),queryClient=useQueryClient(),fileInput=useRef<HTMLInputElement>(null);
  const [tab,setTab]=useState<Tab>('billing'),[rate,setRate]=useState(90),[diverseHours,setDiverseHours]=useState(8),[feedback,setFeedback]=useState(''),[importError,setImportError]=useState('');
  const query=useQuery({queryKey:['time-entries'],queryFn:api.timeEntries}),settings=useQuery({queryKey:['billing-settings'],queryFn:api.billingSettings});
  useEffect(()=>{if(settings.data){setRate(settings.data.hourlyRate);setDiverseHours(settings.data.diverseHours)}},[settings.data]);
  const saveSettings=useMutation({mutationFn:()=>api.saveBillingSettings({hourlyRate:rate,diverseHours}),onSuccess:saved=>{queryClient.setQueryData(['billing-settings'],saved);setFeedback('Paramètres de facturation enregistrés dans la base partagée.');setImportError('')}});
  const importEntries=useMutation({mutationFn:api.importTimeEntries,onSuccess:result=>{queryClient.invalidateQueries({queryKey:['time-entries']});setFeedback(`${result.createdCount} rendez-vous ajoutés, ${result.updatedCount} actualisés. ${result.preservedManualCorrections} corrections manuelles préservées.`);setImportError('')}});
  const importFile=async(file:File|undefined)=>{if(!file)return;setFeedback('');setImportError('');try{const parsed=JSON.parse(await file.text()),entries=Array.isArray(parsed)?parsed:parsed?.entries;if(!Array.isArray(entries))throw new Error('format');await importEntries.mutateAsync(entries);}catch(error){setImportError(error instanceof SyntaxError?'Le fichier JSON ne peut pas être lu.':'Le fichier ne contient pas une liste de rendez-vous valide.');}finally{if(fileInput.current)fileInput.current.value=''}};
  const billable=useMemo(()=>query.data?.filter((entry):entry is TimeEntry&{client:Exclude<HoursClient,null>}=>billableClients.includes(entry.client as typeof billableClients[number]))??[],[query.data]);
  const totals=useMemo(()=>Object.fromEntries(billableClients.map(name=>[name,billable.filter(entry=>entry.client===name).reduce((sum,entry)=>sum+correctedHours(entry),0)])) as Record<typeof billableClients[number],number>,[billable]);
  const invoices=useMemo(()=>[...new Set(billable.map(entry=>monthKey(entry.start)))].sort().map(period=>({period,meetings:billable.filter(entry=>monthKey(entry.start)===period)})),[billable]);
  const rows=tab==='all'?query.data??[]:tab==='billing'?[]:billable.filter(entry=>entry.client===tab);
  if(query.isLoading||settings.isLoading)return <LoadingState/>;
  if(query.error)return <ErrorState message="Impossible de charger les rendez-vous importés."/>;
  return <><PageHeader title="Facturation"><p className="breadcrumb">Prestations de Mathieu · Gimi et Eurodrill · depuis janvier 2026</p>{me.role==='admin'&&<div className="time-import"><input ref={fileInput} hidden type="file" accept="application/json,.json" onChange={event=>importFile(event.target.files?.[0])}/><Button variant="secondary" onClick={()=>fileInput.current?.click()} disabled={importEntries.isPending}><Upload size={16}/>{importEntries.isPending?'Importation…':'Importer les rendez-vous'}</Button><small>Import manuel d’un export JSON, sans doublons.</small></div>}</PageHeader>{(feedback||importError||saveSettings.error)&&<div className={importError||saveSettings.error?'time-feedback error':'time-feedback success'}>{importError||(saveSettings.error?'Enregistrement impossible. Réessayez.':feedback)}</div>}<div className="hours-kpis"><Card><span>Mathieu · Gimi</span><strong>{hours(totals.Gimi)} h</strong></Card><Card><span>Mathieu · Eurodrill</span><strong>{hours(totals.Eurodrill)} h</strong></Card><Card><span>Rendez-vous Mathieu</span><strong>{query.data?.length??0}</strong></Card></div><nav className="time-tabs" aria-label="Vues de la facturation"><button className={tab==='billing'?'active':''} onClick={()=>setTab('billing')}>Facturation mensuelle</button><button className={tab==='all'?'active':''} onClick={()=>setTab('all')}>Mathieu · tous les rendez-vous</button><button className={tab==='Gimi'?'active':''} onClick={()=>setTab('Gimi')}>Mathieu · Gimi</button><button className={tab==='Eurodrill'?'active':''} onClick={()=>setTab('Eurodrill')}>Mathieu · Eurodrill</button></nav>{tab==='billing'?<Billing invoices={invoices} rate={rate} diverseHours={diverseHours} setRate={setRate} setDiverseHours={setDiverseHours} save={()=>saveSettings.mutate()} saving={saveSettings.isPending}/>:<Card className="hours-card"><div className="hours-head"><div><p className="eyebrow">Détails des rendez-vous</p><h2>{tab==='all'?'Tous les rendez-vous':'Rendez-vous suivis · '+tab}</h2><p>Les titres contenant <code>run</code> ou <code>VA</code> ne sont jamais associés à Gimi.</p></div></div><Appointments entries={rows}/></Card>}</>;
}

function Billing({invoices,rate,diverseHours,setRate,setDiverseHours,save,saving}:{invoices:InvoiceMonth[];rate:number;diverseHours:number;setRate:(value:number)=>void;setDiverseHours:(value:number)=>void;save:()=>void;saving:boolean}){
  const queryClient=useQueryClient();
  const saveHours=useMutation({mutationFn:({id,value}:{id:string;value:number})=>api.updateTimeEntry(id,value),onSuccess:entry=>queryClient.setQueryData<TimeEntry[]>(['time-entries'],current=>current?.map(item=>item.id===entry.id?entry:item))});
  const totalHours=invoices.reduce((sum,row)=>sum+row.meetings.reduce((inner,entry)=>inner+correctedHours(entry),0)+diverseHours,0);
  return <Card className="invoice-card"><div className="invoice-head"><div><p className="eyebrow">Facturation prévisionnelle</p><h2>Facturation mensuelle · Mathieu · Gimi & Eurodrill</h2><p>Toutes les prestations de Mathieu sont réunies dans un même tableau mensuel. L’origine de chaque rendez-vous reste visible et les heures corrigées remplacent les heures agenda dès qu’elles sont adaptées.</p></div><div className="invoice-controls"><div className="invoice-settings"><label>Taux horaire <input type="number" min="0" step="1" value={rate} onChange={event=>setRate(Number(event.target.value))}/><span>€/h</span></label><label>Suivi divers / mois <input type="number" min="0" step="0.5" value={diverseHours} onChange={event=>setDiverseHours(Number(event.target.value))}/><span>h</span></label></div><div className="invoice-actions"><Button onClick={save} disabled={saving}><Save size={16}/>{saving?'Enregistrement…':'Enregistrer pour tous'}</Button><Button variant="secondary" onClick={()=>exportBilling(invoices,rate,diverseHours)}><Download size={16}/>Exporter Excel / Google Sheets</Button></div></div></div><div className="invoice-table"><table><thead><tr><th>Mois</th><th>Client</th><th>Prestation</th><th>Heures agenda</th><th>Heures corrigées</th><th>Prix</th></tr></thead><tbody>{invoices.flatMap(row=>{const meetingsHours=row.meetings.reduce((sum,entry)=>sum+correctedHours(entry),0),total=meetingsHours+diverseHours;return [<tr className="invoice-total" key={`${row.period}-total`}><td>{month(row.period)}</td><td><span className="client-tag gimi">Toutes prestations</span></td><td><strong>Total du mois</strong></td><td></td><td><strong>{hours(total)} h</strong></td><td><strong>{amount(total*rate)}</strong></td></tr>,...row.meetings.map(entry=><tr className="invoice-detail" key={entry.id}><td></td><td><span className={`client-tag ${entry.client?.toLowerCase()}`}>Mathieu · {entry.client}</span></td><td>{entry.title}<small>{date(entry.start)} · {time(entry.start)}–{time(entry.end)}</small></td><td>{hours(agendaHours(entry))} h</td><td><input className="corrected-hours" type="number" min="0" step="0.25" defaultValue={correctedHours(entry)} onBlur={event=>{const value=Number(event.currentTarget.value);if(Number.isFinite(value)&&value>=0&&value!==correctedHours(entry))saveHours.mutate({id:entry.id,value})}} disabled={saveHours.isPending}/><span> h</span></td><td>{amount(correctedHours(entry)*rate)}</td></tr>),<tr className="invoice-detail diverse" key={`${row.period}-diverse`}><td></td><td><span className="client-tag gimi">Mathieu · Gimi</span></td><td>Suivi divers<small>Forfait mensuel</small></td><td>—</td><td>{hours(diverseHours)} h</td><td>{amount(diverseHours*rate)}</td></tr>]})}</tbody><tfoot><tr><td colSpan={4}>Total prévisionnel · Mathieu</td><td>{hours(totalHours)} h</td><td>{amount(totalHours*rate)}</td></tr></tfoot></table></div></Card>;
}

function Appointments({entries}:{entries:TimeEntry[]}){return entries.length?<div className="hours-table"><table><thead><tr><th>Rendez-vous</th><th>Date</th><th>Début</th><th>Fin</th><th>Durée</th><th>Membres présents</th><th>Client</th></tr></thead><tbody>{entries.map(entry=><tr key={entry.id}><td><strong>{entry.title}</strong><small>{entry.sourceCalendar}</small></td><td>{date(entry.start)}</td><td>{time(entry.start)}</td><td>{time(entry.end)}</td><td>{hours(agendaHours(entry))} h</td><td>{entry.attendees.length?entry.attendees.map(attendee=>attendee.name).join(', '):'—'}</td><td>{entry.client?<span className={`client-tag ${entry.client.toLowerCase()}`}>{entry.client}</span>:'—'}</td></tr>)}</tbody></table></div>:<p className="hours-empty">Aucun rendez-vous ne correspond à cet onglet.</p>}
