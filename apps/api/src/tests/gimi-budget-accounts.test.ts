import { expect, test } from 'bun:test';
import { gimiBudgetAccountPlanningDefaults, gimiBudgetAccountValue, type GimiBudgetAccountAssumption } from '@equinoxe/shared';
import type { OdooConnector } from '../connectors/odoo';
import { loadGimiBudgetAccounts, suggestGimiBudgetCategory, suggestGimiBudgetDepartment, suggestGimiBudgetSalesSubcategory } from '../services/gimi-budget-accounts';

test('le budget lit uniquement les comptes actifs avec les libellés français Odoo',async()=>{
  const calls:unknown[]=[];
  const connector={
    getProfitLossAccounts:async(options:unknown)=>{calls.push(options);return [
      {id:'60',code:'600100',label:'Matériel détection incendie'},
      {id:'70',code:'700008',label:'Contrat entretien incendie'},
      {id:'61',code:'610001',label:'Loyers immeubles'},
      {id:'618000',code:'618000',label:'Rémunérations des administrateurs et gérants'},
      {id:'62',code:'620200',label:'Rémunérations'},
    ];},
    getProfitLossAccountMonths:async(ids:string[],years:number[],through:string)=>{calls.push([ids,years,through]);return ids.map(id=>({accountId:id,values:id==='60'?{'2025-12':-900,'2026-10':-1000}:{'2025-12':1200,'2026-10':2000}}));},
  } as unknown as OdooConnector;
  const report=await loadGimiBudgetAccounts(connector,'2026-10','salesPurchases');
  expect(calls[0]).toEqual({activeOnly:true,language:'fr_BE'});
  expect(calls[1]).toEqual([['60','70'],[2025,2026],'2026-10-31']);
  expect(report.accounts.map(row=>[row.code,row.amount2025,row.amount2026])).toEqual([['700008',1200,2400],['600100',-900,-1200]]);
  expect(report.accounts[0].suggestedDepartment).toBe('fireMaintenance');
  const operating=await loadGimiBudgetAccounts(connector,'2026-10','operating');
  expect(operating.accounts.map(row=>row.code)).toEqual(['610001']);
  expect(calls[3]).toEqual([['61'],[2025,2026],'2026-10-31']);
});

test('les catégories fournies servent de suggestions modifiables',()=>{
  expect(suggestGimiBudgetDepartment('700052','Installation LED')).toBe('led');
  expect(suggestGimiBudgetDepartment('700039','Fourniture caméras')).toBe('intrusion');
  expect(suggestGimiBudgetSalesSubcategory('700008','Contrat entretien incendie')).toBe('contract');
  expect(suggestGimiBudgetSalesSubcategory('603001','Sous-traitance intrusion')).toBe('subcontracting');
  expect(suggestGimiBudgetCategory('610001','Loyers immeubles')).toBe('rent');
  expect(suggestGimiBudgetCategory('610022','Loyer BMW I4')).toBe('vehicles');
  expect(suggestGimiBudgetCategory('612000','Fournitures de bureau')).toBe('other');
  expect(suggestGimiBudgetCategory('613120','Assurance incendie')).toBe('insurance');
  expect(suggestGimiBudgetCategory('640100','Taxes communales')).toBe('taxes');
  expect(suggestGimiBudgetCategory('740000','Subsides d’exploitation')).toBe('subsidies');
});

test('le calcul 2027 conserve les signes et refuse les hypothèses incomplètes',()=>{
  const planning=gimiBudgetAccountPlanningDefaults(),base:GimiBudgetAccountAssumption={id:'1',sourceAccountId:'1',accountCode:'610001',accountLabel:'Loyer',group:'operating',department:'other',subcategory:'other',category:'rent',method:'indexation',indexationRate:.03,absolute2027:null,note:'',manual:false};
  expect(gimiBudgetAccountValue(base,-1000,planning)).toBe(-1030);
  expect(gimiBudgetAccountValue({...base,indexationRate:null},-1000,planning)).toBeNull();
  expect(gimiBudgetAccountValue({...base,method:'absolute',absolute2027:1200},-1000,planning)).toBe(-1200);
  expect(gimiBudgetAccountValue({...base,accountCode:'740000',method:'absolute',absolute2027:1200},1000,planning)).toBe(1200);
  expect(gimiBudgetAccountValue({...base,method:'notRenewed'},-1000,planning)).toBe(0);
  planning.categoryGrowthRates.rent=.08;
  expect(gimiBudgetAccountValue({...base,method:'growth',indexationRate:null},-1000,planning)).toBe(-1080);
  planning.departmentRates.fireInstallation=.12;
  expect(gimiBudgetAccountValue({...base,accountCode:'700001',group:'salesPurchases',department:'fireInstallation',method:'growth',indexationRate:null},1000,planning)).toBe(1120);
});
