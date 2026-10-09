import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import { type Company, type PublicUser } from '@equinoxe/shared';
import { api } from '../services/api';
import { PasswordInput } from '../components/PasswordInput';
import { Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select } from '../components/ui';

export function Account(){
  const queryClient=useQueryClient(),{me}=useOutletContext<{me:PublicUser}>(),[form,setForm]=useState({name:me.name,email:me.email,password:''});
  useEffect(()=>setForm({name:me.name,email:me.email,password:''}),[me.name,me.email]);
  const save=useMutation({mutationFn:api.updateMe,onSuccess:()=>{queryClient.invalidateQueries({queryKey:['me']});setForm(current=>({...current,password:''}));}});
  return <><PageHeader title="Mon compte"/><Card className="account-card"><p className="eyebrow">Informations personnelles</p><h2>Modifier mon profil</h2><form onSubmit={event=>{event.preventDefault();save.mutate({name:form.name,email:form.email,...(form.password?{password:form.password}:{})});}}><label>Nom<Input required value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label><label>Email<Input type="email" required value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/></label><label>Nouveau mot de passe <small>(facultatif, 8 caractères minimum)</small><PasswordInput minLength={8} value={form.password} onChange={event=>setForm({...form,password:event.target.value})}/></label>{save.error&&<div className="form-error">La modification n’a pas pu être enregistrée.</div>}{save.isSuccess&&<div className="form-success">Profil mis à jour.</div>}<Button disabled={save.isPending}>{save.isPending?'Enregistrement…':'Enregistrer les modifications'}</Button></form></Card></>;
}

export { Users } from './Users';

export function Integrations(){
  const {companies}=useOutletContext<{companies:Company[]}>(),[selected,setSelected]=useState(''),current=companies.find(company=>company.id===selected)??companies[0];
  if(!current)return <ErrorState message="Aucune société disponible."/>;
  return <><PageHeader title="Intégrations"/><label className="integration-selector">Société<Select value={current.id} onChange={event=>setSelected(event.target.value)}>{companies.map(company=><option key={company.id} value={company.id}>{company.name}</option>)}</Select></label><CompanyIntegration key={current.id} current={current}/></>;
}
function CompanyIntegration({current}:{current:Company}){
  const queryClient=useQueryClient(),query=useQuery({queryKey:['integration',current.id],queryFn:()=>api.integration(current.id)}),test=useMutation({mutationFn:()=>api.testIntegration(current.id),onSuccess:()=>queryClient.invalidateQueries({queryKey:['integration',current.id]})});
  if(query.isLoading)return <LoadingState/>;
  if(query.error||!query.data)return <ErrorState message="Impossible de consulter l’intégration."/>;
  const integration=query.data;
  return <><Card className="integration"><div><p className="eyebrow">{current.name}</p><h2>Odoo</h2><p>{integration.baseUrl??'Configuration absente'} · {integration.database??'Base non configurée'}</p></div><Badge tone={integration.status==='connected'?'success':integration.status==='not_configured'?'warning':'error'}>{integration.status==='connected'?'Connecté':integration.status==='not_configured'?'Non configuré':'Déconnecté'}</Badge><p>Dernier test : {integration.lastTestAt?new Date(integration.lastTestAt).toLocaleString('fr-BE'):'Jamais'}</p>{integration.lastError&&<div className="form-error">{integration.lastError}</div>}<Button onClick={()=>test.mutate()} disabled={test.isPending}>{test.isPending?'Test en cours…':'Tester la connexion'}</Button></Card></>;
}
