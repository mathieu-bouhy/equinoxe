import { z } from 'zod';
import { sortEmployees } from '@equinoxe/shared';
import type { Store } from '../repositories/store';

const endDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const date=new Date(`${value}T00:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value;},'Date de fin invalide.').nullable();
export const employeeAssignmentsSchema=z.object({assignments:z.array(z.object({employeeId:z.string(),analyticAllocationCodeId:z.string().nullable().optional(),endDate:endDate.optional(),expectedUpdatedAt:z.string().optional()})).max(1000)});
export class EmployeeAssignmentError extends Error {constructor(message:string,public status=422){super(message);}}
export async function saveEmployeeAssignments(store:Store,companyId:string,input:z.infer<typeof employeeAssignmentsSchema>){
  const validKeys=new Set((await store.analyticAllocationCodes.read()).filter(key=>key.companyId===companyId).map(key=>key.id));
  const ids=new Set<string>();
  for(const item of input.assignments){
    if(ids.has(item.employeeId))throw new EmployeeAssignmentError('Un employé apparaît plusieurs fois.');ids.add(item.employeeId);
    if(item.analyticAllocationCodeId!==undefined&&item.analyticAllocationCodeId!==null&&!validKeys.has(item.analyticAllocationCodeId))throw new EmployeeAssignmentError('Clé inconnue. Les clés Salaire et Voiture sont réservées aux comptes, pas aux employés.');
  }
  return store.employeeAnalyticAllocations.mutate(employees=>{
    for(const item of input.assignments){
      const employee=employees.find(employee=>employee.id===item.employeeId&&employee.companyId===companyId);
      if(!employee)throw new EmployeeAssignmentError('Employé inconnu.');
      if(item.expectedUpdatedAt!==undefined&&item.expectedUpdatedAt!==employee.updatedAt)throw new EmployeeAssignmentError('Cet employé a été modifié ailleurs. Rechargez avant d’enregistrer.',409);
      if(item.endDate&&employee.entryDate&&item.endDate<employee.entryDate.slice(0,10))throw new EmployeeAssignmentError('La date de fin ne peut pas précéder la date d’entrée.');
    }
    const changes=new Map(input.assignments.map(item=>[item.employeeId,item])),now=new Date().toISOString();
    const values=employees.map(employee=>{const change=employee.companyId===companyId?changes.get(employee.id):undefined;if(!change)return employee;
      return {...employee,...(change.endDate!==undefined?{endDate:change.endDate}:{}),...(change.analyticAllocationCodeId!==undefined?{analyticAllocationCodeId:change.analyticAllocationCodeId}:{}),updatedAt:now};});
    return {values,result:sortEmployees(values.filter(employee=>employee.companyId===companyId))};
  });
}
