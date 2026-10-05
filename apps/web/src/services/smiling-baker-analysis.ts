export type SmilingBakerForecastAssumptions = {
  growth: number;
  ebitdaMargin: number;
  depreciationRate: number;
  taxRate: number;
  bfrRate: number;
  multiple: number;
};

export type SmilingBakerForecastRow = {
  year: number;
  revenue: number;
  ebitda: number;
  depreciation: number;
  ebit: number;
  net: number;
  bfrChange: number;
  freeCash: number;
};

export const reconstructedEbitda = (ebit:number,depreciation:number) => ebit+depreciation;

export const coreWorkingCapital = (stock:number,tradeReceivables:number,tradePayables:number) =>
  stock+tradeReceivables-tradePayables;

export const indicativeNetCash = (cashAndInvestments:number,longTermFinancialDebt:number,currentMaturities:number) =>
  cashAndInvestments-longTermFinancialDebt-currentMaturities;

export function buildSmilingBakerForecast(baseRevenue:number,assumptions:SmilingBakerForecastAssumptions):SmilingBakerForecastRow[]{
  const rows:SmilingBakerForecastRow[]=[];
  let revenue=baseRevenue,previousRevenue=baseRevenue;
  for(const year of [2026,2027,2028]){
    revenue*=1+assumptions.growth/100;
    const ebitda=revenue*assumptions.ebitdaMargin/100;
    const depreciation=revenue*assumptions.depreciationRate/100;
    const ebit=ebitda-depreciation;
    const profitBeforeTax=ebit;
    const tax=Math.max(0,profitBeforeTax*assumptions.taxRate/100);
    const net=profitBeforeTax-tax;
    const bfrIncrease=(revenue-previousRevenue)*assumptions.bfrRate/100;
    // Faute de plan de financement et de comptes détaillés, le résultat projeté
    // reste avant coûts financiers et le cash-flow avant CAPEX et financement.
    rows.push({year,revenue,ebitda,depreciation:-depreciation,ebit,net,bfrChange:-bfrIncrease,freeCash:net-bfrIncrease});
    previousRevenue=revenue;
  }
  return rows;
}

export function smilingBakerValuation(normalizedEbitda:number,multiple:number,netCash:number){
  const enterpriseValue=normalizedEbitda*multiple;
  return {enterpriseValue,equityValue:enterpriseValue+netCash};
}
