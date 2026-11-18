export const gimiBudgetYears=[2027,2028,2029,2030,2031,2032,2033,2034,2035,2036] as const;
export type GimiBudgetYear=typeof gimiBudgetYears[number];
export type GimiBudgetScenarioName='best'|'neutral'|'worst';
export type GimiBudgetDepartment='fireInstallation'|'fireMaintenance'|'intrusion'|'led'|'shared';
export type GimiBudgetJointCommittee='cp200'|'cp14901';
export type GimiBudgetDecisionKey='growthTaper'|'revenueMix'|'recurringRevenue'|'priceVolume'|'backlog'|'churn'|'purchaseInflation'|'pricePassThrough'|'grossMarginDefinition'|'staffingModel'|'productivity'|'absenceOvertime'|'workingCapital'|'badDebt'|'inventoryWip'|'vehiclePlan'|'capexPlan'|'buildingTransition'|'financing'|'taxDividends'|'seasonality';
export type GimiBudgetCapexCategory='software'|'vehicles'|'it'|'tools'|'building'|'layout'|'leasing'|'progress'|'other';
export type GimiBudgetValues=Record<GimiBudgetYear,number|null>;
export type GimiBudgetDriver='growth'|'purchasesRate'|'servicesRate'|'payrollRate'|'workingCapitalRate';
export interface GimiBudgetScenario { name:GimiBudgetScenarioName; values:Record<GimiBudgetDriver,GimiBudgetValues> }
export interface GimiBudgetHiring {
  id:string;
  count:number;
  function:string;
  department:GimiBudgetDepartment;
  jointCommittee:GimiBudgetJointCommittee;
  startDate:string;
  annualSalary2026:number;
}
export interface GimiBudgetPlan {
  companyId:string;
  baseDate:string;
  useInterimBase:boolean;
  selectedScenario:GimiBudgetScenarioName;
  baseline2026:Record<GimiBudgetDriver,number|null>;
  scenarios:Record<GimiBudgetScenarioName,GimiBudgetScenario>;
  validation:Record<'interimBase'|'scenarios'|'hiring'|'indexation'|'building'|'bajoma',boolean>;
  salaryIndexation:Record<GimiBudgetJointCommittee,number|null>;
  decisions:Record<GimiBudgetDecisionKey,boolean>;
  hires:GimiBudgetHiring[];
  capexBudget:Record<GimiBudgetCapexCategory,GimiBudgetValues>;
  building:{startDate:string;currentAnnualRent:number;annualRent:number;annualIndexation:number};
  bajoma:{startDate:string;monthlyExclVat:number;vatRate:number};
  revision:number;
  updatedAt:string;
  updatedByUserId:string|null;
}

const years=(value:number|null):GimiBudgetValues=>Object.fromEntries(gimiBudgetYears.map(year=>[year,value])) as GimiBudgetValues;
const scenario=(name:GimiBudgetScenarioName,growth:number,purchasesRate:number,servicesRate:number,payrollRate:number):GimiBudgetScenario=>({
  name,values:{growth:years(growth),purchasesRate:years(purchasesRate),servicesRate:years(servicesRate),payrollRate:years(payrollRate),workingCapitalRate:years(null)},
});

export function gimiBudgetPlanDefaults(companyId:string):Omit<GimiBudgetPlan,'updatedAt'|'updatedByUserId'> {
  const neutral=scenario('neutral',.12,.34,.12,.30);neutral.values.payrollRate[2027]=.28;
  const decisionKeys:GimiBudgetDecisionKey[]=['growthTaper','revenueMix','recurringRevenue','priceVolume','backlog','churn','purchaseInflation','pricePassThrough','grossMarginDefinition','staffingModel','productivity','absenceOvertime','workingCapital','badDebt','inventoryWip','vehiclePlan','capexPlan','buildingTransition','financing','taxDividends','seasonality'];
  const capexCategories:GimiBudgetCapexCategory[]=['software','vehicles','it','tools','building','layout','leasing','progress','other'];
  return {
    companyId,baseDate:'2026-10-31',useInterimBase:true,selectedScenario:'neutral',
    baseline2026:{growth:.144,purchasesRate:.34,servicesRate:.12,payrollRate:.271,workingCapitalRate:null},
    scenarios:{best:scenario('best',.15,.28,.08,.24),neutral,worst:scenario('worst',.05,.40,.125,.32)},
    validation:{interimBase:false,scenarios:false,hiring:false,indexation:false,building:false,bajoma:false},
    salaryIndexation:{cp200:.0417,cp14901:null},decisions:Object.fromEntries(decisionKeys.map(key=>[key,false])) as Record<GimiBudgetDecisionKey,boolean>,hires:[],capexBudget:Object.fromEntries(capexCategories.map(key=>[key,years(null)])) as Record<GimiBudgetCapexCategory,GimiBudgetValues>,
    building:{startDate:'2028-05-01',currentAnnualRent:145000,annualRent:340000,annualIndexation:.015},
    bajoma:{startDate:'2027-01-01',monthlyExclVat:20804.03,vatRate:.21},
    revision:0,
  };
}

const dateFraction=(year:number,startDate:string)=>{
  const start=new Date(`${startDate}T00:00:00Z`),yearStart=new Date(Date.UTC(year,0,1)),yearEnd=new Date(Date.UTC(year+1,0,1));
  if(Number.isNaN(start.getTime())||start>=yearEnd)return 0;
  const effective=start>yearStart?start:yearStart;
  return Math.max(0,(yearEnd.getTime()-effective.getTime())/(yearEnd.getTime()-yearStart.getTime()));
};

export function hiringAnnualCost(hiring:GimiBudgetHiring,year:GimiBudgetYear,indexation:Record<GimiBudgetJointCommittee,number|null>){
  const rate=indexation[hiring.jointCommittee]??0,indexed=hiring.annualSalary2026*Math.pow(1+rate,year-2026);
  return Math.max(0,hiring.count)*indexed*dateFraction(year,hiring.startDate);
}

export function buildingAnnualRent(building:GimiBudgetPlan['building'],year:GimiBudgetYear){
  const start=new Date(`${building.startDate}T00:00:00Z`);if(Number.isNaN(start.getTime()))return 0;
  const startYear=start.getUTCFullYear(),startMonth=start.getUTCMonth();let total=0;
  for(let month=0;month<12;month++){
    if(year<startYear||(year===startYear&&month<startMonth)){total+=building.currentAnnualRent/12;continue;}
    const anniversaries=Math.max(0,year-startYear-(month<startMonth?1:0));
    total+=building.annualRent*Math.pow(1+building.annualIndexation,anniversaries)/12;
  }
  return total;
}

export function bajomaAnnualCharge(bajoma:GimiBudgetPlan['bajoma'],year:GimiBudgetYear){
  const start=new Date(`${bajoma.startDate}T00:00:00Z`);if(Number.isNaN(start.getTime()))return 0;
  const startYear=start.getUTCFullYear(),startMonth=start.getUTCMonth();
  const months=year<startYear?0:year>startYear?12:12-startMonth;
  return bajoma.monthlyExclVat*months;
}

export type GimiBudgetProjectionLineKind='amount'|'percentage';
export interface GimiBudgetProjectionLine { key:string; label:string; kind:GimiBudgetProjectionLineKind; emphasis?:'subtotal'|'total'|'result'; values:Record<string,number> }
export interface GimiBudgetProjection { scenario:GimiBudgetScenarioName; baseDate:string; source:'interimAnnualized'|'budget2026Reference'; sourceNote:string; years:number[]; lines:GimiBudgetProjectionLine[]; generatedAt:string }
