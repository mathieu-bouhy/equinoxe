import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import type { AnalyticAllocationCode, EmployeeAnalyticAllocation, SpreadsheetSourceDocument } from '@equinoxe/shared';
import { config } from '../config';
import { Store } from '../repositories/store';

interface ImportedEmployee {
  sourceSheet:string;
  sourceRow:number;
  firstName:string;
  lastName:string;
  entryDate:string|null;
  function:string|null;
  annualSalaryCost:number|null;
  annualCarCost:number|null;
}

interface ImportPayload {
  sourceUrl:string;
  sheetNames:string[];
  sheets:SpreadsheetSourceDocument['sheets'];
  employees:ImportedEmployee[];
}

const [workbookPath,payloadPath]=process.argv.slice(2);
if(!workbookPath||!payloadPath)throw new Error('Usage : import-gimi-employees.ts <classeur.xlsx> <employes.json>');

const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/gi,' ').trim().toLocaleLowerCase('fr-BE');
const bytes=await readFile(workbookPath),payload=JSON.parse(await readFile(payloadPath,'utf8')) as ImportPayload;
const store=new Store(config.dataDir,config.databaseUrl);
await store.bootstrap();
const company=(await store.companies.read()).find(item=>item.slug==='gimi');
if(!company)throw new Error('La société Gimi est introuvable.');

const now=new Date().toISOString();
const codes=await store.analyticAllocationCodes.mutate(current=>{
  const companyCodes=current.filter(item=>item.companyId===company.id);
  const ensure=(label:string,values:Pick<AnalyticAllocationCode,'intrusion'|'fireInstallation'|'fireMaintenance'|'led'>)=>{
    const existing=companyCodes.find(item=>normalize(item.label)===normalize(label));
    if(existing)return existing;
    const created:AnalyticAllocationCode={id:crypto.randomUUID(),companyId:company.id,label,...values,order:companyCodes.length,createdAt:now,updatedAt:now};
    companyCodes.push(created);
    return created;
  };
  ensure('Incendie maintenance',{intrusion:0,fireInstallation:0,fireMaintenance:100,led:0});
  ensure('Incendie installation',{intrusion:0,fireInstallation:100,fireMaintenance:0,led:0});
  return {values:[...current.filter(item=>item.companyId!==company.id),...companyCodes],result:companyCodes};
});
const maintenanceCode=codes.find(item=>normalize(item.label).includes('incendie maintenance'))!;
const installationCode=codes.find(item=>normalize(item.label).includes('incendie installation'))!;

const workbookBase64=bytes.toString('base64'),sha256=new Bun.CryptoHasher('sha256').update(bytes).digest('hex');
const sourceDocument=await store.spreadsheetSourceDocuments.mutate(current=>{
  const previous=current.find(item=>item.companyId===company.id&&item.kind==='employee-workbook');
  const document:SpreadsheetSourceDocument={id:previous?.id??crypto.randomUUID(),companyId:company.id,kind:'employee-workbook',sourceUrl:payload.sourceUrl,fileName:basename(workbookPath),mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',contentBase64:workbookBase64,sha256,sheetNames:payload.sheetNames,sheets:payload.sheets,importedAt:now};
  return {values:[...current.filter(item=>!(item.companyId===company.id&&item.kind==='employee-workbook')),document],result:document};
});

const imported=await store.employeeAnalyticAllocations.mutate(current=>{
  const existingByName=new Map(current.filter(item=>item.companyId===company.id).map(item=>[normalize(`${item.firstName} ${item.lastName}`),item]));
  const validCodeIds=new Set(codes.map(item=>item.id));
  const employees=payload.employees.map(item=>{
    const existing=existingByName.get(normalize(`${item.firstName} ${item.lastName}`));
    let analyticAllocationCodeId=existing?.analyticAllocationCodeId&&validCodeIds.has(existing.analyticAllocationCodeId)?existing.analyticAllocationCodeId:null;
    const role=normalize(item.function??'');
    if(!analyticAllocationCodeId&&/(^| )electricien( |$)/.test(role))analyticAllocationCodeId=installationCode.id;
    else if(!analyticAllocationCodeId&&/(^| )technicien( |$)/.test(role))analyticAllocationCodeId=maintenanceCode.id;
    const employee:EmployeeAnalyticAllocation={id:existing?.id??crypto.randomUUID(),companyId:company.id,sourceDocumentId:sourceDocument.id,sourceSheet:item.sourceSheet,sourceRow:item.sourceRow,firstName:item.firstName.trim(),lastName:item.lastName.trim(),fullName:`${item.firstName.trim()} ${item.lastName.trim()}`.trim(),entryDate:item.entryDate,function:item.function?.trim()||null,annualSalaryCost:item.annualSalaryCost,annualCarCost:item.annualCarCost,analyticAllocationCodeId,createdAt:existing?.createdAt??now,updatedAt:now};
    return employee;
  });
  return {values:[...current.filter(item=>item.companyId!==company.id),...employees],result:employees};
});

console.log(JSON.stringify({company:company.name,sourceDocumentId:sourceDocument.id,sha256,employeeCount:imported.length,assignedCount:imported.filter(item=>item.analyticAllocationCodeId).length,sheetCount:payload.sheetNames.length,cellCount:payload.sheets.reduce((sum,sheet)=>sum+sheet.cells.length,0)}));
