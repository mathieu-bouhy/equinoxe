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
export interface GimiBudgetDebtForecast {
  openingCash2027:number|null;
  useMbpGroupReference:boolean;
  cbc:GimiBudgetValues;
  mbp1:GimiBudgetValues;
  mbp2:GimiBudgetValues;
  mbpGroupReference:GimiBudgetValues;
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
  debtForecast:GimiBudgetDebtForecast;
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
  const cbc=years(0);cbc[2027]=330000;cbc[2028]=330000;cbc[2029]=330000;
  const mbpGroupReference=years(0);mbpGroupReference[2027]=149000;mbpGroupReference[2028]=149000;mbpGroupReference[2029]=149000;mbpGroupReference[2030]=149000;mbpGroupReference[2031]=149000;
  return {
    companyId,baseDate:'2026-10-31',useInterimBase:true,selectedScenario:'neutral',
    baseline2026:{growth:.144,purchasesRate:.34,servicesRate:.12,payrollRate:.271,workingCapitalRate:null},
    scenarios:{best:scenario('best',.15,.28,.08,.24),neutral,worst:scenario('worst',.05,.40,.125,.32)},
    validation:{interimBase:false,scenarios:false,hiring:false,indexation:false,building:false,bajoma:false},
    salaryIndexation:{cp200:.0417,cp14901:null},decisions:Object.fromEntries(decisionKeys.map(key=>[key,false])) as Record<GimiBudgetDecisionKey,boolean>,hires:[],capexBudget:Object.fromEntries(capexCategories.map(key=>[key,years(null)])) as Record<GimiBudgetCapexCategory,GimiBudgetValues>,debtForecast:{openingCash2027:null,useMbpGroupReference:true,cbc,mbp1:years(null),mbp2:years(null),mbpGroupReference},
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

export interface GimiBudgetProjectionIntegrity { ok:boolean; checkedYears:number[]; failures:string[] }

export function gimiBudgetProjectionIntegrity(projection:GimiBudgetProjection):GimiBudgetProjectionIntegrity{
  const values=new Map(projection.lines.map(line=>[line.key,line.values])),failures:string[]=[];
  const required=['revenue','purchases','merchandise','subcontracting','grossMargin','grossMarginRate','services','building','payroll','operatingNet','ebitda','ebitdaRate','depreciation','operatingResult','financial','preTax','tax','netResult','operatingCashFlow'];
  for(const key of required)if(!values.has(key))failures.push(`Rubrique manquante : ${key}`);
  const close=(actual:number|undefined,expected:number,label:string,year:number)=>{
    const tolerance=Math.max(1,Math.abs(expected)*1e-9);
    if(actual===undefined||!Number.isFinite(actual)||Math.abs(actual-expected)>tolerance)failures.push(`${label} ${year}`);
  };
  if(failures.length)return {ok:false,checkedYears:projection.years,failures};
  for(const year of projection.years){
    const key=String(year),get=(line:string)=>values.get(line)![key];
    const revenue=get('revenue'),purchases=get('purchases'),merchandise=get('merchandise'),subcontracting=get('subcontracting'),grossMargin=get('grossMargin'),services=get('services'),building=get('building'),payroll=get('payroll'),operatingNet=get('operatingNet'),ebitda=get('ebitda'),depreciation=get('depreciation'),operatingResult=get('operatingResult'),financial=get('financial'),preTax=get('preTax'),tax=get('tax'),netResult=get('netResult');
    close(purchases,merchandise+subcontracting,'Achats',year);
    close(grossMargin,revenue+purchases,'Marge brute',year);
    close(get('grossMarginRate'),revenue===0?0:grossMargin/revenue,'Taux de marge brute',year);
    close(ebitda,grossMargin+services+building+payroll+operatingNet,'EBITDA',year);
    close(get('ebitdaRate'),revenue===0?0:ebitda/revenue,'Taux EBITDA',year);
    close(operatingResult,ebitda+depreciation,'Résultat d’exploitation',year);
    close(preTax,operatingResult+financial,'Résultat avant impôts',year);
    close(netResult,preTax+tax,'Résultat net',year);
    close(get('operatingCashFlow'),netResult-depreciation,'Cash-flow opérationnel',year);
  }
  return {ok:failures.length===0,checkedYears:projection.years,failures};
}

export interface GimiBudgetCashForecastYear {
  year:GimiBudgetYear;
  netResult:number;
  depreciationAddBack:number;
  operatingCashFlow:number;
  workingCapitalImpact:number|null;
  capex:number|null;
  cbcRepayment:number|null;
  mbp1Repayment:number|null;
  mbp2Repayment:number|null;
  mbpReferenceRepayment:number|null;
  mbpRepayment:number|null;
  totalDebtRepayment:number|null;
  cashAfterDebt:number|null;
  freeCashFlow:number|null;
  openingCash:number|null;
  closingCash:number|null;
  capitalCoverage:number|null;
}

export function gimiBudgetCashForecast(plan:GimiBudgetPlan,projection:GimiBudgetProjection,actualWorkingCapital2026:number|null):GimiBudgetCashForecastYear[]{
  const line=(key:string)=>projection.lines.find(item=>item.key===key)?.values??{};
  const net=line('netResult'),depreciation=line('depreciation'),revenue=line('revenue'),scenario=plan.scenarios[plan.selectedScenario].values;
  let previousWorkingCapital=actualWorkingCapital2026,openingCash=plan.debtForecast.openingCash2027;
  return gimiBudgetYears.map(year=>{
    const yearKey=String(year),netResult=net[yearKey]??0,depreciationAddBack=-(depreciation[yearKey]??0),operatingCashFlow=netResult+depreciationAddBack;
    const workingCapitalRate=scenario.workingCapitalRate[year],workingCapital=workingCapitalRate===null?null:(revenue[yearKey]??0)*workingCapitalRate;
    const workingCapitalImpact=workingCapital===null||previousWorkingCapital===null?null:previousWorkingCapital-workingCapital;
    if(workingCapital!==null)previousWorkingCapital=workingCapital;else previousWorkingCapital=null;
    const capexValues=Object.values(plan.capexBudget).map(values=>values[year]),capex=capexValues.every(value=>value!==null)?capexValues.reduce<number>((sum,value)=>sum+(value??0),0):null;
    const cbcRepayment=plan.debtForecast.cbc[year],mbp1Repayment=plan.debtForecast.mbp1[year],mbp2Repayment=plan.debtForecast.mbp2[year],mbpReferenceRepayment=plan.debtForecast.mbpGroupReference[year];
    const mbpRepayment=plan.debtForecast.useMbpGroupReference?mbpReferenceRepayment:mbp1Repayment===null||mbp2Repayment===null?null:mbp1Repayment+mbp2Repayment;
    const totalDebtRepayment=cbcRepayment===null||mbpRepayment===null?null:cbcRepayment+mbpRepayment;
    const cashAfterDebt=totalDebtRepayment===null?null:operatingCashFlow-totalDebtRepayment;
    const freeCashFlow=workingCapitalImpact===null||capex===null||totalDebtRepayment===null?null:operatingCashFlow+workingCapitalImpact-capex-totalDebtRepayment;
    const currentOpeningCash=openingCash,closingCash=currentOpeningCash===null||freeCashFlow===null?null:currentOpeningCash+freeCashFlow;
    openingCash=closingCash;
    return {year,netResult,depreciationAddBack,operatingCashFlow,workingCapitalImpact,capex,cbcRepayment,mbp1Repayment,mbp2Repayment,mbpReferenceRepayment,mbpRepayment,totalDebtRepayment,cashAfterDebt,freeCashFlow,openingCash:currentOpeningCash,closingCash,capitalCoverage:totalDebtRepayment===null||totalDebtRepayment===0?null:operatingCashFlow/totalDebtRepayment};
  });
}
