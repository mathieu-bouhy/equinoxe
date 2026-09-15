import { allocateAccountByMonthlyCost, effectiveAllocationKeys, isMonthlyCostKey, type AccountMonthlyAmounts } from '@equinoxe/shared';
import type { AccountAnalyticAllocation, AnalyticAllocationCode, EmployeeAnalyticAllocation, MarginAnalysisBlock, MarginAnalysisReport, ProfitLossAccount, ProfitLossReport, ProfitLossSection } from '@equinoxe/shared';
import { accountSection, normalizeAllocationLabel } from './analytic-allocation';

const departments = [
  {key:'fireInstallation', label:'Incendie installation'},
  {key:'fireMaintenance', label:'Incendie maintenance'},
  {key:'intrusion', label:'Intrusion'},
  {key:'led', label:'LED'},
] as const;
const headcountKey = (key:AnalyticAllocationCode) => {
  const label=normalizeAllocationLabel(key.label);
  return label.includes('nombre') && label.includes('employe');
};

/** Agrège les mêmes comptes et soldes signés que le compte de résultat.
 * Les charges sont négatives : marge = chiffre d'affaires + marchandises.
 * Une seule annualisation, sur les montants déjà bornés au mois clôturé par Odoo.
 */
export function buildMarginAnalysis(report:ProfitLossReport, sections:ProfitLossSection[], assignments:AccountAnalyticAllocation[], keys:AnalyticAllocationCode[], employees:EmployeeAnalyticAllocation[], lastClosedMonth:string,monthlyAccounts:AccountMonthlyAmounts[]=[]):MarginAnalysisReport {
  if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(lastClosedMonth)) throw new Error('Mois clôturé invalide.');
  const [year,month]=lastClosedMonth.split('-').map(Number), factor=12/month;
  const revenueSection=accountSection('700000',sections), purchasesSection=accountSection('600000',sections);
  if(!revenueSection||!purchasesSection||revenueSection.id===purchasesSection.id) throw new Error('Les rubriques de chiffre d’affaires et marchandises doivent être configurées séparément.');
  const resolved=new Map(effectiveAllocationKeys(keys,employees).map(key=>[key.id,key]));
  const assignmentById=new Map(assignments.map(row=>[row.odooAccountId,row])),assignmentByCode=new Map(assignments.map(row=>[row.accountCode,row]));
  const emptyValues=()=>Object.fromEntries(report.years.map(y=>[String(y),0]));
  const makeBlock=(key:'revenue'|'purchases',label:string,sectionId:string):MarginAnalysisBlock=>{
    const block:MarginAnalysisBlock={key,label,rows:[...departments,{key:'other',label:'Autres'}].map(d=>({...d,values:emptyValues(),accounts:[]})),totals:emptyValues()};
    for(const account of report.lines.find(line=>line.key===sectionId)?.accounts??[]){
      const assignment=assignmentById.get(account.id)??assignmentByCode.get(account.code),allocation=resolved.get(assignment?.analyticAllocationCodeId??'');
      let monthlyValues:ReturnType<typeof allocateAccountByMonthlyCost>|undefined;
      if(allocation&&isMonthlyCostKey(allocation)){
        const monthly=monthlyAccounts.find(row=>row.accountId===account.id);
        if(!monthly)throw new Error(`Le détail mensuel est nécessaire pour la clé ${allocation.label}.`);
        const inPeriod=Object.fromEntries(Object.entries(monthly.values).filter(([month])=>report.years.includes(Number(month.slice(0,4)))&&month<=lastClosedMonth));
        for(const y of report.years){const sum=Object.entries(inPeriod).filter(([month])=>month.startsWith(String(y))).reduce((sum,[,amount])=>sum+amount,0);if(Math.abs(sum-(account.values[y]??0))>.01)throw new Error(`Le détail mensuel ne correspond pas au total du compte affecté à ${allocation.label}.`);}
        monthlyValues=allocateAccountByMonthlyCost(inPeriod,employees,keys,allocation.basis);
      }
      const allocationTotal=allocation?departments.reduce((sum,d)=>sum+allocation[d.key],0):0;
      const valid=allocation&&departments.every(d=>Number.isFinite(allocation[d.key])&&allocation[d.key]>=0)&&Math.abs(allocationTotal-100)<0.001;
      for(const row of block.rows){
        const share=valid?(row.key==='other'?0:allocation[row.key as typeof departments[number]['key']]/allocationTotal):(row.key==='other'?1:0);
        if(!share&&!monthlyValues)continue;
        const detail:ProfitLossAccount={...account,values:Object.fromEntries(report.years.map(y=>[String(y),(monthlyValues?Object.entries(monthlyValues).filter(([month])=>month.startsWith(String(y))).reduce((sum,[,values])=>sum+values[row.key as keyof typeof values],0):(account.values[String(y)]??0)*share)*(y===year?factor:1)]))};
        for(const y of report.years){row.values[y]+=detail.values[y];block.totals[y]+=detail.values[y];}
        if(report.years.some(y=>Math.abs(detail.values[y])>=0.005))row.accounts.push(detail);
      }
    }
    for(const row of block.rows)row.accounts.sort((a,b)=>a.code.localeCompare(b.code,'fr-BE',{numeric:true}));
    // Échec explicite plutôt qu'un total silencieusement incomplet si le contrat
    // du connecteur venait à perdre le détail d'un compte.
    const source=report.lines.find(line=>line.key===sectionId);
    for(const y of report.years){
      const expected=(source?.values[y]??0)*(y===year?factor:1);
      if(Math.abs(block.totals[y]-expected)>0.01)throw new Error('Le détail des comptes ne correspond pas au total du compte de résultat.');
    }
    return block;
  };
  const revenue=makeBlock('revenue','Chiffre d’affaires',revenueSection.id),purchases=makeBlock('purchases','Marchandises',purchasesSection.id);
  const margin:MarginAnalysisBlock={key:'margin',label:'Marge brute',totals:emptyValues(),rows:revenue.rows.map((row,index)=>({...row,values:Object.fromEntries(report.years.map(y=>[String(y),row.values[y]+purchases.rows[index].values[y]])),accounts:[...row.accounts,...purchases.rows[index].accounts]}))};
  for(const y of report.years)margin.totals[y]=revenue.totals[y]+purchases.totals[y];
  return {years:report.years,lastClosedMonth,extrapolatedYear:year,factor,blocks:[revenue,purchases,margin],generatedAt:report.generatedAt};
}
