export type GimiBudgetAccountGroup='salesPurchases'|'operating';
export type GimiBudgetAccountMethod='pending'|'growth'|'indexation'|'absolute'|'notRenewed';
export type GimiBudgetAccountDepartment='fireInstallation'|'fireMaintenance'|'intrusion'|'led'|'other';
export type GimiBudgetSalesSubcategory='installation'|'supply'|'repair'|'contract'|'goods'|'subcontracting'|'stockVariation'|'ancillary'|'other';
export type GimiBudgetOperatingCategory='rent'|'insurance'|'energy'|'maintenance'|'fees'|'vehicles'|'itTelecom'|'marketing'|'travel'|'temporaryStaff'|'taxes'|'losses'|'penalties'|'subsidies'|'recoveries'|'recharges'|'employeeContributions'|'operatingIncome'|'other';

export interface GimiBudgetAccountAssumption {
  id:string;
  sourceAccountId:string|null;
  accountCode:string;
  accountLabel:string;
  group:GimiBudgetAccountGroup;
  department:GimiBudgetAccountDepartment;
  subcategory:GimiBudgetSalesSubcategory;
  category:GimiBudgetOperatingCategory;
  method:GimiBudgetAccountMethod;
  indexationRate:number|null;
  absolute2027:number|null;
  note:string;
  manual:boolean;
}

export interface GimiBudgetAccountPlanning {
  departmentRates:Record<GimiBudgetAccountDepartment,number|null>;
  categoryRates:Record<GimiBudgetOperatingCategory,number|null>;
  categoryGrowthRates:Record<GimiBudgetOperatingCategory,number|null>;
  lines:GimiBudgetAccountAssumption[];
}

export interface GimiBudgetAccountSourceLine {
  id:string;
  code:string;
  label:string;
  group:GimiBudgetAccountGroup;
  suggestedDepartment:GimiBudgetAccountDepartment;
  suggestedSubcategory:GimiBudgetSalesSubcategory;
  suggestedCategory:GimiBudgetOperatingCategory;
  amount2025:number|null;
  amount2026:number|null;
}

export interface GimiBudgetAccountSourceReport {
  group:GimiBudgetAccountGroup;
  lastClosedMonth:string;
  through:string;
  generatedAt:string;
  accounts:GimiBudgetAccountSourceLine[];
}

export const gimiBudgetAccountPlanningDefaults=():GimiBudgetAccountPlanning=>({
  departmentRates:{fireInstallation:null,fireMaintenance:null,intrusion:null,led:null,other:null},
  categoryRates:{rent:null,insurance:null,energy:null,maintenance:null,fees:null,vehicles:null,itTelecom:null,marketing:null,travel:null,temporaryStaff:null,taxes:null,losses:null,penalties:null,subsidies:null,recoveries:null,recharges:null,employeeContributions:null,operatingIncome:null,other:null},
  categoryGrowthRates:{rent:null,insurance:null,energy:null,maintenance:null,fees:null,vehicles:null,itTelecom:null,marketing:null,travel:null,temporaryStaff:null,taxes:null,losses:null,penalties:null,subsidies:null,recoveries:null,recharges:null,employeeContributions:null,operatingIncome:null,other:null},
  lines:[],
});

export function gimiBudgetAccountValue(line:GimiBudgetAccountAssumption,amount2026:number|null,planning:GimiBudgetAccountPlanning){
  if(line.method==='pending')return null;
  if(line.method==='notRenewed')return 0;
  if(line.method==='absolute'){
    if(line.absolute2027===null)return null;
    const magnitude=Math.abs(line.absolute2027);
    return line.accountCode.startsWith('6')?-magnitude:magnitude;
  }
  if(amount2026===null)return null;
  const defaultRate=line.group==='salesPurchases'?planning.departmentRates[line.department]:line.method==='growth'?planning.categoryGrowthRates[line.category]:planning.categoryRates[line.category];
  const rate=line.indexationRate??defaultRate;
  return rate===null?null:amount2026*(1+rate);
}
