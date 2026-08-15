import { useState } from 'react';
import { GripVertical, Plus, Save, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, useParams } from 'react-router-dom';
import type { BfrSection, Company } from '@equinoxe/shared';
import { api } from '../services/api';
import { Button, Card, ErrorState, Input, LoadingState, PageHeader, Select } from '../components/ui';
import './pnl-config.css';

const blank=(companyId:string,order:number):BfrSection=>({id:crypto.randomUUID(),companyId,label:'Nouvelle rubrique BFR',sign:'add',prefixes:[],order,createdAt:'',updatedAt:''});

export function BfrConfig(){
  const {companies}=useOutletContext<{companies:Company[]}>(),{companySlug}=useParams(),company=companies.find(item=>item.slug===companySlug),qc=useQueryClient(),[draggedId,setDraggedId]=useState<string|null>(null);
  if(!company)return <ErrorState message="Société de configuration introuvable."/>;
  const query=useQuery({queryKey:['bfr-sections',company.id],queryFn:()=>api.bfrSections(company.id)}),[draft,setDraft]=useState<BfrSection[]|null>(null);
  const save=useMutation({mutationFn:(sections:BfrSection[])=>api.saveBfrSections(company.id,sections),onSuccess:data=>{setDraft(data);qc.invalidateQueries({queryKey:['bfr',company.id]})}});
  if(query.isLoading)return <LoadingState/>;
  if(query.error||!query.data)return <ErrorState message="Impossible de charger la configuration BFR."/>;
  const rows=draft??query.data,change=(id:string,value:Partial<BfrSection>)=>setDraft(rows.map(row=>row.id===id?{...row,...value}:row));
  const move=(targetId:string)=>{if(!draggedId||draggedId===targetId)return;const from=rows.findIndex(row=>row.id===draggedId),to=rows.findIndex(row=>row.id===targetId),next=[...rows],[item]=next.splice(from,1);next.splice(to,0,item);setDraft(next);setDraggedId(null)};
  const prefixes=(row:BfrSection)=><div className="prefixes">{row.prefixes.map((prefix,index)=><span key={`${prefix}-${index}`}><Input value={prefix} inputMode="numeric" aria-label="Préfixe de compte BFR" onChange={event=>change(row.id,{prefixes:row.prefixes.map((item,i)=>i===index?event.target.value.replace(/\D/g,''):item)})}/><button type="button" onClick={()=>change(row.id,{prefixes:row.prefixes.filter((_,i)=>i!==index)})} aria-label="Retirer le préfixe">×</button></span>)}<Button variant="secondary" type="button" onClick={()=>change(row.id,{prefixes:[...row.prefixes,'']})}>+ Compte</Button></div>;
  return <><PageHeader title={`Configuration BFR · ${company.name}`}><Button onClick={()=>save.mutate(rows.map((row,order)=>({...row,order,prefixes:row.prefixes.filter(Boolean)})))} disabled={save.isPending}><Save size={16}/>{save.isPending?'Enregistrement…':'Enregistrer'}</Button></PageHeader><p className="config-intro">Le BFR d’exploitation additionne les actifs opérationnels et soustrait les passifs opérationnels. Excluez trésorerie, dettes financières, capitaux propres, comptes courants et dividendes. Chaque préfixe ne peut appartenir qu’à une seule rubrique.</p><div className="config-list">{rows.map((row,index)=><Card className="section-card" key={row.id} draggable onDragStart={()=>setDraggedId(row.id)} onDragOver={event=>event.preventDefault()} onDrop={()=>move(row.id)}><button type="button" className="drag-handle" aria-label={`Déplacer ${row.label}`}><GripVertical size={19}/></button><div className="section-position">{index+1}</div><div className="section-content"><div className="section-title"><Input value={row.label} onChange={event=>change(row.id,{label:event.target.value})}/><button className="icon-button" type="button" onClick={()=>setDraft(rows.filter(item=>item.id!==row.id))} aria-label="Supprimer"><Trash2 size={17}/></button></div><Select value={row.sign} onChange={event=>change(row.id,{sign:event.target.value as BfrSection['sign']})}><option value="add">+ Actif opérationnel</option><option value="subtract">− Passif opérationnel</option></Select>{prefixes(row)}</div></Card>)}</div><div className="config-actions"><Button variant="secondary" onClick={()=>setDraft([...rows,blank(company.id,rows.length)])}><Plus size={16}/>Ajouter une rubrique</Button></div>{save.error&&<ErrorState message="La sauvegarde a échoué. Vérifiez les intitulés et les préfixes de comptes."/>}</>;
}
