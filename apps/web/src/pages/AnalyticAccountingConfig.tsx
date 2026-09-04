import { useState } from 'react';
import { Plus, Save, Trash2, UsersRound } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, useParams } from 'react-router-dom';
import type { AnalyticAllocationCode, Company, EmployeeAnalyticAllocation } from '@equinoxe/shared';
import { api } from '../services/api';
import { Button, Card, ErrorState, Input, LoadingState, PageHeader, Select } from '../components/ui';
import './analytic-accounting.css';

type Tab='codes'|'employees';
const blank=(companyId:string,order:number):AnalyticAllocationCode=>({id:crypto.randomUUID(),companyId,label:'Nouveau code analytique',intrusion:0,fireInstallation:0,fireMaintenance:0,led:0,order,createdAt:'',updatedAt:''});
const total=(row:AnalyticAllocationCode)=>row.intrusion+row.fireInstallation+row.fireMaintenance+row.led;
const fields=[{key:'intrusion',label:'Intrusion'},{key:'fireInstallation',label:'Incendie — installation'},{key:'fireMaintenance',label:'Incendie — maintenance'},{key:'led',label:'LED'}] as const;
const money=new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0});
const date=new Intl.DateTimeFormat('fr-BE',{day:'2-digit',month:'2-digit',year:'numeric'});

export function AnalyticAccountingConfig(){
  const {companies}=useOutletContext<{companies:Company[]}>(),{companySlug}=useParams(),company=companies.find(item=>item.slug===companySlug),companyId=company?.id??'',enabled=company?.slug==='gimi',qc=useQueryClient();
  const [tab,setTab]=useState<Tab>('codes'),[codeDraft,setCodeDraft]=useState<AnalyticAllocationCode[]|null>(null),[employeeDraft,setEmployeeDraft]=useState<EmployeeAnalyticAllocation[]|null>(null);
  const codesQuery=useQuery({queryKey:['analytic-allocation-codes',companyId],queryFn:()=>api.analyticAllocationCodes(companyId),enabled});
  const employeesQuery=useQuery({queryKey:['employee-analytic-allocations',companyId],queryFn:()=>api.employeeAnalyticAllocations(companyId),enabled});
  const saveCodes=useMutation({mutationFn:(codes:AnalyticAllocationCode[])=>api.saveAnalyticAllocationCodes(companyId,codes),onSuccess:data=>{setCodeDraft(data);qc.invalidateQueries({queryKey:['analytic-allocation-codes',companyId]});}});
  const saveEmployees=useMutation({mutationFn:(employees:EmployeeAnalyticAllocation[])=>api.saveEmployeeAnalyticAllocations(companyId,employees.map(employee=>({employeeId:employee.id,analyticAllocationCodeId:employee.analyticAllocationCodeId}))),onSuccess:data=>{setEmployeeDraft(data);qc.invalidateQueries({queryKey:['employee-analytic-allocations',companyId]});}});
  if(!company)return <ErrorState message="Société de configuration introuvable."/>;
  if(!enabled)return <ErrorState message="La comptabilité analytique est disponible pour Jimmy uniquement."/>;
  const activeQuery=tab==='codes'?codesQuery:employeesQuery;
  if(activeQuery.isLoading)return <LoadingState/>;
  if(activeQuery.error)return <ErrorState message="Impossible de charger la configuration analytique."/>;
  const rows=codeDraft??codesQuery.data??[],employees=employeeDraft??employeesQuery.data??[],valid=rows.every(row=>Math.abs(total(row)-100)<0.001),saving=tab==='codes'?saveCodes.isPending:saveEmployees.isPending;
  const updateCode=(id:string,change:Partial<AnalyticAllocationCode>)=>setCodeDraft(rows.map(row=>row.id===id?{...row,...change}:row));
  const updateEmployee=(id:string,analyticAllocationCodeId:string|null)=>setEmployeeDraft(employees.map(employee=>employee.id===id?{...employee,analyticAllocationCodeId}:employee));
  const save=()=>tab==='codes'?saveCodes.mutate(rows.map((row,order)=>({...row,label:row.label.trim(),order}))):saveEmployees.mutate(employees);
  return <>
    <PageHeader title={`Comptabilité analytique · ${company.name}`}><Button onClick={save} disabled={saving||(tab==='codes'&&!valid)}><Save size={16}/>{saving?'Enregistrement…':'Enregistrer'}</Button></PageHeader>
    <div className="analytic-tabs" role="tablist" aria-label="Configuration de la comptabilité analytique"><button className={tab==='codes'?'active':''} type="button" role="tab" aria-selected={tab==='codes'} onClick={()=>setTab('codes')}>Codes analytiques</button><button className={tab==='employees'?'active':''} type="button" role="tab" aria-selected={tab==='employees'} onClick={()=>setTab('employees')}>Répartition employés</button></div>
    {tab==='codes'?<>
      <Card className="analytic-introduction"><div><p className="eyebrow">Répartition des frais</p><h2>Ventilation par département</h2><p>Pour chaque code analytique, définissez la part de frais attribuée à chacun des quatre départements. Chaque ligne doit totaliser 100&nbsp;%.</p></div><span>4 départements</span></Card>
      <Card className="analytic-table-card"><div className="analytic-table-wrap"><table className="analytic-table"><thead><tr><th scope="col">Code analytique</th>{fields.map(field=><th scope="col" key={field.key}>{field.label}</th>)}<th scope="col">Total</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead><tbody>{rows.map(row=>{const rowTotal=total(row),isValid=Math.abs(rowTotal-100)<0.001;return <tr key={row.id} className={isValid?'':'invalid'}><td><Input aria-label="Libellé du code analytique" value={row.label} onChange={event=>updateCode(row.id,{label:event.target.value})}/></td>{fields.map(field=><td key={field.key}><label className="allocation-input"><Input aria-label={`${field.label} pour ${row.label}`} type="number" min="0" max="100" step="0.01" value={row[field.key]} onChange={event=>updateCode(row.id,{[field.key]:Math.max(0,Math.min(100,Number(event.target.value)||0))})}/><span>%</span></label></td>)}<td><strong className={`allocation-total ${isValid?'valid':'invalid'}`}>{rowTotal.toFixed(2).replace(/\.00$/,'')} %</strong></td><td><button className="analytic-delete" type="button" onClick={()=>setCodeDraft(rows.filter(item=>item.id!==row.id))} aria-label={`Supprimer ${row.label}`}><Trash2 size={17}/></button></td></tr>})}</tbody></table></div>{!rows.length&&<div className="analytic-empty">Ajoutez votre premier code analytique pour commencer la répartition des frais.</div>}{!valid&&<p className="analytic-validation">Chaque ligne doit totaliser exactement 100&nbsp;% avant l’enregistrement.</p>}</Card>
      <div className="analytic-actions"><Button variant="secondary" onClick={()=>setCodeDraft([...rows,blank(company.id,rows.length)])}><Plus size={16}/>Ajouter un code analytique</Button></div>
    </>:<>
      <Card className="analytic-introduction"><div><p className="eyebrow">Équipe 2026</p><h2>Affectation des coûts par code analytique</h2><p>Les coûts proviennent du classeur importé. Le coût annuel voiture correspond à la différence entre le coût annuel total (AQ) et le coût annuel salaire (AR).</p></div><span>{employees.length} employés</span></Card>
      <Card className="analytic-table-card employee-table-card"><div className="analytic-table-wrap"><table className="analytic-table employee-table"><thead><tr><th scope="col">Prénom et nom</th><th scope="col">Date d’entrée</th><th scope="col">Fonction</th><th scope="col">Coût annuel salaire</th><th scope="col">Coût annuel voiture</th><th scope="col">Code analytique</th></tr></thead><tbody>{employees.map(employee=><tr key={employee.id}><td><span className="employee-name"><UsersRound size={17}/><strong>{employee.fullName}</strong></span></td><td>{employee.entryDate?date.format(new Date(employee.entryDate)):'—'}</td><td>{employee.function??'—'}</td><td className="employee-money">{employee.annualSalaryCost===null?'—':money.format(employee.annualSalaryCost)}</td><td className="employee-money">{employee.annualCarCost===null?'—':money.format(employee.annualCarCost)}</td><td><Select aria-label={`Code analytique de ${employee.fullName}`} value={employee.analyticAllocationCodeId??''} onChange={event=>updateEmployee(employee.id,event.target.value||null)}><option value="">Non affecté</option>{rows.map(code=><option key={code.id} value={code.id}>{code.label}</option>)}</Select></td></tr>)}</tbody></table></div>{!employees.length&&<div className="analytic-empty">Aucun employé n’a encore été importé.</div>}</Card>
    </>}
    {(saveCodes.error||saveEmployees.error)&&<ErrorState message="La sauvegarde a échoué. Vérifiez les données puis réessayez."/>}
    {(saveCodes.isSuccess||saveEmployees.isSuccess)&&<p className="analytic-success" role="status">Configuration enregistrée dans la base de données partagée.</p>}
  </>;
}
