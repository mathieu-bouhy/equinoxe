import { buildingAnnualRent, gimiBudgetYears, type GimiBudgetPlan, type GimiBudgetProjection, type GimiBudgetProjectionLine, type ProfitLossReport } from '@equinoxe/shared';

type PrivateCompensationPoint={ebitda:number;compensation:number};

// Donnée confidentielle : elle reste volontairement côté API et n'est jamais
// renvoyée au navigateur, même dans la réponse détaillée du budget.
const privateCompensationSchedule:PrivateCompensationPoint[]=[
  [0,140000],[100000,140000],[200000,140000],[300000,140000],[400000,140000],[500000,140000],[600000,140000],
  [700000,147857],[800000,155714],[900000,163571],[1000000,171429],[1100000,179286],[1200000,187143],[1300000,195000],
  [1400000,202857],[1500000,210714],[1600000,218571],[1700000,226429],[1800000,234286],[1900000,242143],[2000000,250000],
  [2100000,257857],[2200000,265714],[2300000,273571],[2400000,281429],[2500000,289286],[2600000,297143],[2700000,305000],
].map(([ebitda,compensation])=>({ebitda,compensation}));

export interface GimiBudgetProjectionBaseline {
  revenue:number;merchandise:number;subcontracting:number;servicesExcludingBuildingAndPrivateFlow:number;
  building:number;privateFlow:number;payroll:number;operatingNet:number;depreciation:number;financial:number;
}

const reference2026:GimiBudgetProjectionBaseline={
  revenue:8_012_000,merchandise:-2_724_000,subcontracting:-400_000,
  servicesExcludingBuildingAndPrivateFlow:-622_000,building:-145_000,privateFlow:-265_000,
  payroll:-2_125_000,operatingNet:160_000,depreciation:-190_000,financial:38_000,
};

export function gimiBudgetBaselineFromProfitLoss(report:ProfitLossReport):GimiBudgetProjectionBaseline|null{
  const value=(label:string)=>report.lines.find(line=>line.label===label)?.values['2026'];
  const revenue=value("Chiffre d’affaires"),merchandise=value('Marchandises'),subcontracting=value('Sous-traitance'),services=value('Services et biens divers'),payroll=value('Personnel'),charges=value("Charges d’exploitation"),products=value("Produits d’exploitation"),depreciation=value('Amortissements'),financial=value('Financier');
  if([revenue,merchandise,subcontracting,services,payroll,charges,products,depreciation,financial].some(item=>item===undefined))return null;
  return {revenue:revenue!,merchandise:merchandise!,subcontracting:subcontracting!,servicesExcludingBuildingAndPrivateFlow:services!-reference2026.building-reference2026.privateFlow,building:reference2026.building,privateFlow:reference2026.privateFlow,payroll:payroll!,operatingNet:charges!+products!,depreciation:depreciation!,financial:financial!};
}

const privateCompensation=(ebitda:number)=>{
  const points=privateCompensationSchedule;
  if(ebitda<=points[0].ebitda)return points[0].compensation;
  const last=points[points.length-1];if(ebitda>=last.ebitda)return last.compensation;
  const upper=points.find(point=>point.ebitda>=ebitda)!,lower=points[points.indexOf(upper)-1];
  const fraction=(ebitda-lower.ebitda)/(upper.ebitda-lower.ebitda);
  return lower.compensation+(upper.compensation-lower.compensation)*fraction;
};

const line=(key:string,label:string,kind:GimiBudgetProjectionLine['kind']='amount',emphasis?:GimiBudgetProjectionLine['emphasis']):GimiBudgetProjectionLine=>({key,label,kind,emphasis,values:{}});

export function buildGimiBudgetProjection(plan:GimiBudgetPlan,options?:{baseline?:GimiBudgetProjectionBaseline;source?:GimiBudgetProjection['source']}):GimiBudgetProjection{
  const base=options?.baseline??reference2026,source=options?.source??'budget2026Reference';
  const years=[2026,...gimiBudgetYears],scenario=plan.scenarios[plan.selectedScenario],lines=[
    line('revenue',"Chiffre d'affaires",'amount','total'),
    line('purchases','Marchandises et achats','amount','subtotal'),
    line('merchandise','Marchandises'),line('subcontracting','Sous-traitance'),
    line('grossMargin','Marge brute','amount','total'),line('grossMarginRate','% marge brute','percentage'),
    line('services','Services et biens divers hors bâtiment'),line('building','Frais bâtiment'),
    line('payroll','Rémunérations, charges sociales et pensions'),line('operatingNet','Produits - charges d’exploitation'),
    line('ebitda','EBITDA','amount','result'),line('ebitdaRate','% EBITDA','percentage'),
    line('depreciation','Amortissements'),line('operatingResult','Résultat d’exploitation','amount','subtotal'),
    line('financial','Produits - charges financières'),line('preTax','Résultat net avant impôts','amount','total'),
    line('tax','Impôts (25 %)'),line('netResult','Résultat net après impôts','amount','result'),
    line('operatingCashFlow','Cash-flow opérationnel avant BFR','amount','total'),
  ];
  const values=(key:string)=>lines.find(item=>item.key===key)!.values;
  const set=(key:string,year:number,value:number)=>{values(key)[String(year)]=value;};
  const basePurchases=base.merchandise+base.subcontracting,baseGross=base.revenue+basePurchases;
  const baseEbitda=baseGross+base.servicesExcludingBuildingAndPrivateFlow+base.building+base.privateFlow+base.payroll+base.operatingNet;
  const baseOperating=baseEbitda+base.depreciation,basePreTax=baseOperating+base.financial,baseTax=-Math.max(0,basePreTax)*.25,baseNet=basePreTax+baseTax;
  const baseValues:Record<string,number>={revenue:base.revenue,purchases:basePurchases,merchandise:base.merchandise,subcontracting:base.subcontracting,grossMargin:baseGross,grossMarginRate:baseGross/base.revenue,services:base.servicesExcludingBuildingAndPrivateFlow+base.privateFlow,building:base.building,payroll:base.payroll,operatingNet:base.operatingNet,ebitda:baseEbitda,ebitdaRate:baseEbitda/base.revenue,depreciation:base.depreciation,operatingResult:baseOperating,financial:base.financial,preTax:basePreTax,tax:baseTax,netResult:baseNet,operatingCashFlow:baseNet-base.depreciation};
  for(const [key,value] of Object.entries(baseValues))set(key,2026,value);

  let previousRevenue=base.revenue;
  for(const year of gimiBudgetYears){
    const growth=scenario.values.growth[year]??0,revenue=previousRevenue*(1+growth),merchandise=-revenue*(scenario.values.purchasesRate[year]??0);
    const subcontracting=-revenue*Math.abs(base.subcontracting/base.revenue),servicesBeforePrivate=-revenue*Math.abs(base.servicesExcludingBuildingAndPrivateFlow/base.revenue),building=-buildingAnnualRent(plan.building,year),payroll=-revenue*(scenario.values.payrollRate[year]??0),operatingNet=base.operatingNet*Math.pow(1.02,year-2026);
    const ebitdaBeforePrivate=revenue+merchandise+subcontracting+servicesBeforePrivate+building+payroll+operatingNet;
    let confidentialCharge=privateCompensation(ebitdaBeforePrivate);
    for(let iteration=0;iteration<8;iteration++)confidentialCharge=privateCompensation(ebitdaBeforePrivate-confidentialCharge);
    const services=servicesBeforePrivate-confidentialCharge,purchases=merchandise+subcontracting,grossMargin=revenue+purchases,ebitda=grossMargin+services+building+payroll+operatingNet;
    const depreciation=base.depreciation*(revenue/base.revenue),operatingResult=ebitda+depreciation,financial=base.financial,preTax=operatingResult+financial,tax=-Math.max(0,preTax)*.25,netResult=preTax+tax;
    const projected:Record<string,number>={revenue,purchases,merchandise,subcontracting,grossMargin,grossMarginRate:grossMargin/revenue,services,building,payroll,operatingNet,ebitda,ebitdaRate:ebitda/revenue,depreciation,operatingResult,financial,preTax,tax,netResult,operatingCashFlow:netResult-depreciation};
    for(const [key,value] of Object.entries(projected))set(key,year,value);
    previousRevenue=revenue;
  }
  return {scenario:plan.selectedScenario,baseDate:plan.baseDate,source,sourceNote:source==='interimAnnualized'?`Situation comptable au ${plan.baseDate.split('-').reverse().join('/')} annualisée sur douze mois.`:'Référence Budget 2026 utilisée provisoirement : la situation intermédiaire Odoo n’est pas disponible dans cet environnement.',years,lines,generatedAt:new Date().toISOString()};
}

