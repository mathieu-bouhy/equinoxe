import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Building2, ChevronDown, FileSearch, Grid2X2, LogOut, Menu, ReceiptText, Settings2, SlidersHorizontal, UserRound, Users, X } from 'lucide-react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { analysedFiles, canAccessEquinox } from '@equinoxe/shared';
import { api, ApiError } from '../services/api';
import { Button, ErrorState, LoadingState } from '../components/ui';
import './navigation.css';

function NavigationGroup({id,label,icon,active,children,count}:{id:string;label:string;icon:ReactNode;active:boolean;children:ReactNode;count?:number}){
  const [open,setOpen]=useState(active);
  useEffect(()=>{if(active)setOpen(true);},[active]);
  return <section className={`nav-group${active?' current':''}`}><button className="nav-group-toggle" type="button" aria-expanded={open} aria-controls={`nav-${id}`} onClick={()=>setOpen(!open)}>{icon}<span>{label}</span>{count!==undefined&&<small>{count}</small>}<ChevronDown size={15} className={open?'expanded':''}/></button><div id={`nav-${id}`} className="nav-group-content" hidden={!open}>{children}</div></section>;
}

export function Shell(){
  const location=useLocation(),navigate=useNavigate(),qc=useQueryClient(),{companySlug}=useParams();
  const sidebarRef=useRef<HTMLElement>(null),menuRef=useRef<HTMLButtonElement>(null);
  const [mobileOpen,setMobileOpen]=useState(false),[logoutError,setLogoutError]=useState('');
  const me=useQuery({queryKey:['me'],queryFn:api.me,refetchInterval:30_000});
  const companies=useQuery({queryKey:['companies',me.data?.id],queryFn:api.companies,enabled:Boolean(me.data),refetchInterval:30_000});
  const current=companies.data?.find(company=>company.slug===companySlug)??companies.data?.[0];
  useEffect(()=>{setMobileOpen(false);},[location.pathname]);
  useEffect(()=>{if(current&&companySlug)localStorage.setItem('equinoxe.lastCompany',current.slug);},[current?.slug,companySlug]);
  useEffect(()=>{
    if(!mobileOpen)return;
    const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
    const focusable=()=>Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('a[href],button:not(:disabled),summary')??[]).filter(element=>element.getClientRects().length>0);
    focusable()[0]?.focus();
    const close=(event:KeyboardEvent)=>{
      if(event.key==='Escape')setMobileOpen(false);
      if(event.key==='Tab'){
        const items=focusable(),first=items[0],last=items[items.length-1];
        if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
        else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
      }
    };
    const resize=()=>{if(window.innerWidth>800)setMobileOpen(false);};
    document.addEventListener('keydown',close);window.addEventListener('resize',resize);
    return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',close);window.removeEventListener('resize',resize);menuRef.current?.focus();};
  },[mobileOpen]);
  if(me.isLoading)return <LoadingState/>;
  if(me.error)return me.error instanceof ApiError&&me.error.status===401?<Navigate to="/connexion" replace/>:<ErrorState message="Impossible de vérifier votre session."/>;
  if(!me.data)return <Navigate to="/connexion" replace/>;
  if(companies.isLoading)return <LoadingState/>;
  if(companies.error||!companies.data)return <ErrorState message="Impossible de charger vos sociétés."/>;
  const user=me.data,isAdmin=user.role==='admin',path=location.pathname;
  const dossiers=analysedFiles.filter(file=>isAdmin||user.analysisAccess.includes(file.slug));
  const section=path.startsWith('/administration')?'configuration':path.startsWith('/dossiers-analyses')?'dossiers':path.startsWith('/suivi-des-heures')?'applications':path.startsWith('/societes')?'societes':'';
  const sectionLabel={configuration:'Configuration',dossiers:'Dossiers analysés',applications:'Applications Equinoxe',societes:'Reporting financier','':'Mon espace'}[section]??'Mon espace';
  const dossierSlug=path.startsWith('/dossiers-analyses/')?path.split('/')[2]:undefined;
  const denied=(section==='configuration'&&!isAdmin)||(section==='applications'&&!canAccessEquinox(user))||(dossierSlug&&!dossiers.some(file=>file.slug===dossierSlug))||(companySlug&&!companies.data.some(company=>company.slug===companySlug));
  return <div data-brand={companySlug??dossierSlug??'equinoxe'} className={`shell${mobileOpen?' navigation-open':''}`}>
    <a className="skip-navigation" href="#main-content">Aller au contenu</a>
    {mobileOpen&&<button className="navigation-overlay" aria-label="Fermer la navigation" onClick={()=>setMobileOpen(false)}/>}
    <aside ref={sidebarRef} className="sidebar" data-brand="equinoxe" id="main-navigation" aria-label="Navigation principale">
      <div className="sidebar-brand"><NavLink className="brand" to="/"><span className="brand-signature"><img src="/brand/equinoxe.svg" alt="Equinoxe"/><small>Espace de pilotage</small></span></NavLink><button className="navigation-close icon-button" aria-label="Fermer le menu" onClick={()=>setMobileOpen(false)}><X size={20}/></button></div>
      <nav className="workspace-navigation" aria-label="Espaces">
        {companies.data.length>0&&<NavigationGroup id="companies" label="Reporting financier" icon={<Building2 size={19}/>} active={section==='societes'} count={companies.data.length}>{companies.data.map(company=><NavLink key={company.id} data-brand={company.slug} className={section==='societes'&&company.slug===companySlug?'nav-child active':'nav-child'} to={`/societes/${company.slug}/tableaux-de-bord/compte-resultat`}><span className="nav-monogram" aria-hidden="true">{company.name.slice(0,1)}</span>{company.name}</NavLink>)}</NavigationGroup>}
        {canAccessEquinox(user)&&<NavigationGroup id="applications" label="Applications Equinoxe" icon={<Grid2X2 size={19}/>} active={section==='applications'}><NavLink className="nav-child" to="/suivi-des-heures"><ReceiptText size={16}/>Facturation</NavLink></NavigationGroup>}
        {dossiers.length>0&&<NavigationGroup id="dossiers" label="Dossiers analysés" icon={<FileSearch size={19}/>} active={section==='dossiers'} count={dossiers.length}>{dossiers.map(file=><NavLink key={file.slug} data-brand={file.slug} className="nav-child" to={`/dossiers-analyses/${file.slug}/compte-resultat`}><span className="nav-monogram" aria-hidden="true">{file.name.slice(0,1)}</span>{file.name}</NavLink>)}</NavigationGroup>}
        {isAdmin&&<NavigationGroup id="configuration" label="Configuration" icon={<Settings2 size={19}/>} active={section==='configuration'}><NavLink className="nav-child" to="/administration/utilisateurs"><Users size={16}/>Utilisateurs</NavLink><NavLink className="nav-child" to="/administration/integrations"><SlidersHorizontal size={16}/>Intégrations</NavLink><div className="nav-caption">Paramètres par société</div>{companies.data.map(company=><details className="nav-company-settings" data-brand={company.slug} key={company.id} open={section==='configuration'&&companySlug===company.slug||undefined}><summary>{company.name}<ChevronDown size={14}/></summary><NavLink className="nav-child" to={`/administration/configuration/${company.slug}/compte-resultat`}>Compte de résultat</NavLink>{['gimi','eurodrill'].includes(company.slug)&&<NavLink className="nav-child" to={`/administration/configuration/${company.slug}/bfr`}>BFR</NavLink>}{company.slug==='gimi'&&<NavLink className="nav-child" to={`/administration/configuration/${company.slug}/comptabilite-analytique`}>Comptabilité analytique</NavLink>}</details>)}</NavigationGroup>}
      </nav>
      <div className="sidebar-session"><NavLink className="account-link" to="/compte"><span className="user-avatar"><UserRound size={18}/></span><span><strong>{user.name}</strong><small>{isAdmin?'Administration':'Utilisateur'}</small></span></NavLink><Button variant="secondary" onClick={async()=>{try{await api.logout();qc.clear();navigate('/connexion');}catch{setLogoutError('Déconnexion impossible. Réessayez.');}}}><LogOut size={16}/>Déconnexion</Button>{logoutError&&<div role="alert" className="form-error">{logoutError}</div>}</div>
    </aside>
    <main className="main" id="main-content" tabIndex={-1}><div className="workspace-header"><button ref={menuRef} className="mobile-menu icon-button" aria-label="Ouvrir le menu" aria-expanded={mobileOpen} aria-controls="main-navigation" onClick={()=>setMobileOpen(!mobileOpen)}><Menu size={21}/></button><span>{sectionLabel}</span>{(companySlug||dossierSlug)&&<span className="workspace-context">{companySlug?current?.name:dossiers.find(file=>file.slug===dossierSlug)?.name}</span>}<span className="workspace-role">{isAdmin?'Administration':'Utilisateur'}</span></div>{denied?<ErrorState message="Vous n’avez pas accès à cet espace. Contactez une personne disposant d’un accès Administration."/>:<Outlet context={{me:user,companies:companies.data,current}}/>}</main>
  </div>;
}
