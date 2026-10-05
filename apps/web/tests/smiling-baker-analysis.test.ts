import { expect, test } from 'bun:test';
import { buildSmilingBakerForecast, coreWorkingCapital, indicativeNetCash, reconstructedEbitda, smilingBakerValuation } from '../src/services/smiling-baker-analysis';

test('Smiling Baker : rapproche les agrégats 2025 publiés',()=>{
  expect(reconstructedEbitda(2412235,1443476)).toBe(3855711);
  expect(coreWorkingCapital(1397435,1968015,782189)).toBe(2583261);
  expect(indicativeNetCash(2020118,764544,890865)).toBe(364709);
});

test('Smiling Baker : le scénario projette sans modifier la base historique',()=>{
  const baseRevenue=12476464;
  const rows=buildSmilingBakerForecast(baseRevenue,{growth:5,ebitdaMargin:28.7,depreciationRate:10,taxRate:25,bfrRate:17.7,multiple:5.5});
  expect(baseRevenue).toBe(12476464);
  expect(rows).toHaveLength(3);
  expect(rows[0].year).toBe(2026);
  expect(rows[0].revenue).toBeCloseTo(13100287.2,1);
  expect(rows[0].bfrChange).toBeLessThan(0);
  expect(rows[0].freeCash).toBe(rows[0].net+rows[0].bfrChange);
});

test('Smiling Baker : la valeur des titres ajoute la trésorerie nette une seule fois',()=>{
  expect(smilingBakerValuation(4015682,5.5,364709)).toEqual({enterpriseValue:22086251,equityValue:22450960});
});
