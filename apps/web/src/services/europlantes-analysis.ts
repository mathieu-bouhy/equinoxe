export type EuroplantesForecastAssumptions = {
  growth: number;
  ebitdaMargin: number;
  depreciationRate: number;
  taxRate: number;
  bfrRate: number;
  capex: number;
};

export type EuroplantesForecastRow = {
  year: number;
  revenue: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  tax: number;
  net: number;
  bfr: number;
  bfrChange: number;
  capex: number;
  freeCash: number;
};

export const reconstructedEbitda = (ebit:number,depreciation:number,impairments:number) =>
  ebit+depreciation+impairments;

export const coreWorkingCapital = (stock:number,tradeReceivables:number,tradePayables:number) =>
  stock+tradeReceivables-tradePayables;

export const indicativeNetCash = (cash:number,longTermFinancialDebt:number,currentMaturities:number) =>
  cash-longTermFinancialDebt-currentMaturities;

export const adjustedEbitda = (base:number,adjustments:number[]) =>
  adjustments.reduce((total,item)=>total+item,base);

export function buildEuroplantesForecast(
  baseRevenue:number,
  baseBfr:number,
  assumptions:EuroplantesForecastAssumptions,
  firstYearRevenue=7_500_000,
  firstYearEbitda=1_000_000,
):EuroplantesForecastRow[]{
  const rows:EuroplantesForecastRow[]=[];
  let previousRevenue=baseRevenue,previousBfr=baseBfr;
  for(const year of [2026,2027,2028,2029]){
    const revenue=year===2026?firstYearRevenue:previousRevenue*(1+assumptions.growth/100);
    const ebitda=year===2026?firstYearEbitda:revenue*assumptions.ebitdaMargin/100;
    const depreciation=revenue*assumptions.depreciationRate/100;
    const ebit=ebitda-depreciation;
    const tax=Math.max(0,ebit*assumptions.taxRate/100);
    const net=ebit-tax;
    const bfr=revenue*assumptions.bfrRate/100;
    const bfrChange=bfr-previousBfr;
    const capex=year===2026?Math.max(assumptions.capex,300_000):assumptions.capex;
    rows.push({year,revenue,ebitda,depreciation:-depreciation,ebit,tax:-tax,net,bfr,bfrChange:-bfrChange,capex:-capex,freeCash:net-bfrChange-capex});
    previousRevenue=revenue;
    previousBfr=bfr;
  }
  return rows;
}

export function europlantesValuation(ebitda:number,multiple:number,netCash:number,propertyValue:number){
  const operatingEnterpriseValue=ebitda*multiple;
  return {operatingEnterpriseValue,equityValue:operatingEnterpriseValue+netCash+propertyValue};
}
