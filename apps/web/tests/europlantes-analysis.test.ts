import { expect, test } from 'bun:test';
import { adjustedEbitda, buildEuroplantesForecast, coreWorkingCapital, europlantesValuation, indicativeNetCash, reconstructedEbitda } from '../src/services/europlantes-analysis';

test('Europlantes : rapproche les agrégats statutaires 2025',()=>{
  expect(reconstructedEbitda(919467,160526,4441)).toBe(1084434);
  expect(coreWorkingCapital(178276,1139273,397882)).toBe(919667);
  expect(indicativeNetCash(1056179,225432,100305)).toBe(730442);
});

test('Europlantes : applique les retraitements vendeur sur la base BNB',()=>{
  const adjustments=[-41132,-87170,-80845,76904,163940,51265];
  expect(adjustedEbitda(1084434,adjustments)).toBe(1167396);
});

test('Europlantes : conserve le cas vendeur 2026 et projette ensuite',()=>{
  const rows=buildEuroplantesForecast(6907692,919667,{growth:6,ebitdaMargin:14,depreciationRate:2.3,taxRate:25,bfrRate:13.3,capex:150000});
  expect(rows).toHaveLength(4);
  expect(rows[0].revenue).toBe(7500000);
  expect(rows[0].ebitda).toBe(1000000);
  expect(rows[0].capex).toBe(-300000);
  expect(rows[1].revenue).toBe(7950000);
  expect(rows[1].freeCash).toBe(rows[1].net+rows[1].bfrChange+rows[1].capex);
});

test('Europlantes : ajoute immobilier et trésorerie nette une seule fois',()=>{
  expect(europlantesValuation(1167396,5.5,730442,1030000)).toEqual({operatingEnterpriseValue:6420678,equityValue:8181120});
});
