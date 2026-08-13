import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext } from 'react-router-dom';
import type { Company, PublicUser } from '@equinoxe/shared';
import { api } from '../services/api';
import { Badge, Button, Card, ErrorState, Input, LoadingState, PageHeader, Select } from '../components/ui';

export function Account(){
  const queryClient=useQueryClient(),{me}=useOutletContext<{me:PublicUser}>(),[form,setForm]=useState({name:me.name,email:me.email,password:''});
  useEffect(()=>setForm({name:me.name,email:me.email,password:''}),[me.name,me.email]);
  const save=useMutation({mutationFn:api.updateMe,onSuccess:()=>{queryClient.invalidateQueries({queryKey:['me']});setForm(current=>({...current,password:''}));}});
  return <><PageHeader title="Mon compte"/><Card className="account-card"><p className="eyebrow">Informations personnelles</p><h2>Modifier mon profil</h2><form onSubmit={event=>{event.preventDefault();save.mutate({name:form.name,email:form.email,...(form.password?{password:form.password}:{})});}}><label>Nom<Input required value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label><label>Email<Input type="email" required value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/></label><label>Nouveau mot de passe <small>(facultatif, 8 caractères minimum)</small><Input type="password" minLength={8} value={form.password} onChange={event=>setForm({...form,password:event.target.value})}/></label>{save.error&&<div className="form-error">La modification n’a pas pu être enregistrée.</div>}{save.isSuccess&&<div className="form-success">Profil mis à jour.</div>}<Button disabled={save.isPending}>{save.isPending?'Enregistrement…':'Enregistrer les modifications'}</Button></form></Card></>;
}

export function Users(){
  const queryClient=useQueryClient(),companies=useQuery({queryKey:['companies'],queryFn:api.companies}),users=useQuery({queryKey:['users'],queryFn:api.users}),[form,setForm]=useState({name:'',email:'',password:'',role:'viewer',analysisAccess:[] as string[]});
  const create=useMutation({mutationFn:api.createUser,onSuccess:()=>{queryClient.invalidateQueries({queryKey:['users']});setForm({name:'',email:'',password:'',role:'viewer',analysisAccess:[]});}});
  if(users.isLoading||companies.isLoading)return <LoadingState/>;
  if(users.error||companies.error||!users.data||!companies.data)return <ErrorState message="Impossible de charger les utilisateurs."/>;
  return <><PageHeader title="Utilisateurs"/><div className="admin-grid"><Card><h2>Créer un utilisateur</h2><form onSubmit={event=>{event.preventDefault();create.mutate({...form,status:'active'});}}><label>Nom<Input required value={form.name} onChange={event=>setForm({...form,name:event.target.value})}/></label><label>Email<Input type="email" required value={form.email} onChange={event=>setForm({...form,email:event.target.value})}/></label><label>Mot de passe<Input type="password" minLength={8} required value={form.password} onChange={event=>setForm({...form,password:event.target.value})}/></label><label>Rôle<Select value={form.role} onChange={event=>setForm({...form,role:event.target.value})}><option value="viewer">Lecteur</option><option value="admin">Administrateur</option></Select></label><label className="inline-check"><input type="checkbox" checked={form.analysisAccess.includes('medipost')} onChange={event=>setForm({...form,analysisAccess:event.target.checked?['medipost']:[]})}/>Accès au dossier analysé Medipost</label>{create.error&&<div className="form-error">Création impossible. Vérifiez notamment que l’adresse e-mail est unique.</div>}<Button disabled={create.isPending}>{create.isPending?'Création…':'Créer'}</Button></form></Card><Card><h2>Liste des utilisateurs</h2><p className="admin-note">Un administrateur accède à toutes les sociétés et à tous les dossiers analysés. Pour un lecteur, choisissez explicitement les sociétés et les dossiers autorisés.</p><div className="list">{users.data.map(user=><UserRow key={user.id} user={user} companies={companies.data}/>)}</div></Card></div></>;
}

function UserRow({user,companies}:{user:PublicUser;companies:Company[]}){
  const [open,setOpen]=useState(false),[selected,setSelected]=useState<string[]>([]),[analyses,setAnalyses]=useState<string[]>(user.analysisAccess??[]);
  const accessQuery=useQuery({queryKey:['user-companies',user.id],queryFn:()=>api.userCompanies(user.id),enabled:open});
  useEffect(()=>{if(accessQuery.data)setSelected(accessQuery.data);},[accessQuery.data]);
  useEffect(()=>setAnalyses(user.analysisAccess??[]),[user.analysisAccess]);
  const companiesMutation=useMutation({mutationFn:()=>api.access(user.id,selected)}),analysisMutation=useMutation({mutationFn:()=>api.analysisAccess(user.id,analyses),onSuccess:()=>setOpen(false)});
  const save=async()=>{await companiesMutation.mutateAsync();await analysisMutation.mutateAsync();};
  return <div className="user-row"><div><strong>{user.name}</strong><span>{user.email}</span></div><Badge tone={user.role==='admin'?'success':'neutral'}>{user.role==='admin'?'Administrateur':'Lecteur'}</Badge>{user.role==='viewer'&&<Button variant="secondary" onClick={()=>setOpen(value=>!value)}>Gérer les accès</Button>}{open&&<div className="access-panel">{accessQuery.isLoading?<LoadingState/>:<><strong>Sociétés existantes</strong>{companies.map(company=><label key={company.id}><input type="checkbox" checked={selected.includes(company.id)} onChange={event=>setSelected(event.target.checked?[...selected,company.id]:selected.filter(id=>id!==company.id))}/>{company.name}</label>)}<strong>Dossiers analysés</strong><label><input type="checkbox" checked={analyses.includes('medipost')} onChange={event=>setAnalyses(event.target.checked?['medipost']:[])}/>Medipost</label>{(companiesMutation.error||analysisMutation.error)&&<div className="form-error">Les accès n’ont pas pu être enregistrés.</div>}<Button onClick={save} disabled={companiesMutation.isPending||analysisMutation.isPending}>Enregistrer les accès</Button></>}</div>}</div>;
}

export function Integrations(){
  const {current}=useOutletContext<{current:Company}>(),queryClient=useQueryClient(),query=useQuery({queryKey:['integration',current.id],queryFn:()=>api.integration(current.id)}),test=useMutation({mutationFn:()=>api.testIntegration(current.id),onSuccess:()=>queryClient.invalidateQueries({queryKey:['integration',current.id]})});
  if(query.isLoading)return <LoadingState/>;
  if(query.error||!query.data)return <ErrorState message="Impossible de consulter l’intégration."/>;
  const integration=query.data;
  return <><PageHeader title="Intégrations"/><Card className="integration"><div><p className="eyebrow">{current.name}</p><h2>Odoo</h2><p>{integration.baseUrl??'Configuration absente'} · {integration.database??'Base non configurée'}</p></div><Badge tone={integration.status==='connected'?'success':integration.status==='not_configured'?'warning':'error'}>{integration.status==='connected'?'Connecté':integration.status==='not_configured'?'Non configuré':'Déconnecté'}</Badge><p>Dernier test : {integration.lastTestAt?new Date(integration.lastTestAt).toLocaleString('fr-BE'):'Jamais'}</p>{integration.lastError&&<div className="form-error">{integration.lastError}</div>}<Button onClick={()=>test.mutate()} disabled={test.isPending}>{test.isPending?'Test en cours…':'Tester la connexion'}</Button></Card></>;
}
