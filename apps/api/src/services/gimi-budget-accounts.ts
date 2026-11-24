import type { GimiBudgetAccountDepartment, GimiBudgetAccountGroup, GimiBudgetAccountSourceReport, GimiBudgetOperatingCategory, GimiBudgetSalesSubcategory } from '@equinoxe/shared';
import type { OdooConnector } from '../connectors/odoo';
import { allocationAmountsCutoff, buildAccountAllocationAmounts } from './account-allocation-amounts';

const FIRE_MAINTENANCE_REVENUE=new Set(['700007','700008','700009','700012','700016','700054','700059','700080']);
const FIRE_REVENUE=new Set(['700001','700003','700005']);
const FIRE_COSTS=new Set(['600100','603000','603010','603200','609400']);
const INTRUSION_REVENUE=new Set(['700013','700014','700028','700029','700031','700032','700033','700036','700038','700039','700042','700057','700063','700069','700073','700079']);
const INTRUSION_COSTS=new Set(['600200','600500','600600','603001','603002','603003','609410','609411','609412']);
const LED_REVENUE=new Set(['700050','700052','700070','700090']);
const LED_COSTS=new Set(['600840','603006','609401']);
const isConfidentialManagementAccount=(code:string)=>/^(613208|618000|6183)/.test(code);

const normalize=(value:string)=>value.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('fr-BE');

/** Suggestions only: the user can override every line in the budget screen. */
export function suggestGimiBudgetDepartment(code:string,label:string):GimiBudgetAccountDepartment{
  if(FIRE_MAINTENANCE_REVENUE.has(code)||/contrat|entretien|maintenance|telesurveillance/.test(normalize(label))&&/incendie/.test(normalize(label)))return 'fireMaintenance';
  if(FIRE_REVENUE.has(code)||FIRE_COSTS.has(code)||/incendie/.test(normalize(label)))return 'fireInstallation';
  if(LED_REVENUE.has(code)||LED_COSTS.has(code)||/\bled\b|eclairage/.test(normalize(label)))return 'led';
  if(INTRUSION_REVENUE.has(code)||INTRUSION_COSTS.has(code)||/intrusion|camera|controle d.acces|videophonie/.test(normalize(label)))return 'intrusion';
  return 'other';
}

export function suggestGimiBudgetSalesSubcategory(code:string,label:string):GimiBudgetSalesSubcategory{
  const value=normalize(label);
  if(code.startsWith('71')||/variation.*stock|var.*stock/.test(value))return 'stockVariation';
  if(code.startsWith('603')||/sous.?trait/.test(value))return 'subcontracting';
  if(code.startsWith('604')||/transport|dedouan|frais de port|emballage/.test(value))return 'ancillary';
  if(code.startsWith('60'))return 'goods';
  if(/contrat|entretien|maintenance|location/.test(value))return 'contract';
  if(/instal|mise en service|\bmes\b/.test(value))return 'installation';
  if(/fourniture|vente materiel/.test(value))return 'supply';
  if(/depannage|reparation/.test(value))return 'repair';
  return 'other';
}

export function suggestGimiBudgetCategory(code:string,label:string):GimiBudgetOperatingCategory{
  const value=normalize(label);
  if(code.startsWith('74')){
    if(/recup|remboursement|indemnite/.test(value))return 'recoveries';
    if(/refactur/.test(value))return 'recharges';
    if(/avantage en nature|cotisation.*person|retenue|intervention salaire/.test(value))return 'employeeContributions';
    if(/subside|prime|cheque.*entreprise|cheque.*formation/.test(value))return 'subsidies';
    return 'operatingIncome';
  }
  if(code.startsWith('64')){
    if(/amende|penalite/.test(value))return 'penalties';
    if(/perte|moins.?value|reduction de valeur/.test(value))return 'losses';
    return 'taxes';
  }
  if(/vehicule|voiture|camionnette|carburant|parking|leasing|pneu|garage|controle technique/.test(value)||/^(61002[2-9]|61003[0-5]|610500|6112|611430|61218|61318)/.test(code))return 'vehicles';
  if(/loyer|location.*(immeuble|batiment|bureau|entrepot)|charge locative/.test(value))return 'rent';
  if(/assurance/.test(value))return 'insurance';
  if(/electricite|\bgaz\b|\beau\b|energie|chauffage/.test(value))return 'energy';
  if(/entret|reparation|maintenance|nettoyage/.test(value))return 'maintenance';
  if(/honoraire|consult|comptable|avocat|juridique|cotisation|redevance|agrement|secretariat social/.test(value))return 'fees';
  if(/ordinateur|informatique|logiciel|programme|telephone|internet|site web|abonnement.*(it|cloud)/.test(value))return 'itTelecom';
  if(/publicite|sponsoring|annonce|cadeau|marketing/.test(value))return 'marketing';
  if(/hotel|voyage|deplacement|peage|reception/.test(value))return 'travel';
  if(/interim/.test(value))return 'temporaryStaff';
  return 'other';
}

export async function loadGimiBudgetAccounts(connector:OdooConnector,lastClosedMonth:string,group:GimiBudgetAccountGroup):Promise<GimiBudgetAccountSourceReport>{
  const through=allocationAmountsCutoff(lastClosedMonth);
  const all=await connector.getProfitLossAccounts({activeOnly:true,language:'fr_BE'});
  const accounts=all.filter(account=>group==='salesPurchases'?/^(60|70|71)/.test(account.code):/^(61|64|74)/.test(account.code)&&!isConfidentialManagementAccount(account.code));
  const rows=through<'2025-01-01'?accounts.map(account=>({accountId:account.id,values:{}}))
    :await connector.getProfitLossAccountMonths(accounts.map(account=>account.id),[2025,2026],through);
  const amounts=buildAccountAllocationAmounts(rows,lastClosedMonth);
  const byId=new Map(amounts.accounts.map(account=>[account.accountId,account]));
  return {group,lastClosedMonth,through,generatedAt:amounts.generatedAt,accounts:accounts.map(account=>{
    const amount=byId.get(account.id);
    return {id:account.id,code:account.code,label:account.label,group,
      suggestedDepartment:suggestGimiBudgetDepartment(account.code,account.label),
      suggestedSubcategory:suggestGimiBudgetSalesSubcategory(account.code,account.label),
      suggestedCategory:suggestGimiBudgetCategory(account.code,account.label),
      amount2025:amount?.amount2025??null,amount2026:amount?.amount2026??null};
  }).sort((a,b)=>{
    if(group==='salesPurchases'){
      const classOrder=(code:string)=>/^(70|71)/.test(code)?0:1,departmentOrder:Record<GimiBudgetAccountDepartment,number>={fireInstallation:0,fireMaintenance:1,intrusion:2,led:3,other:4};
      return classOrder(a.code)-classOrder(b.code)||departmentOrder[a.suggestedDepartment]-departmentOrder[b.suggestedDepartment]||a.code.localeCompare(b.code,'fr-BE',{numeric:true});
    }
    return a.code.slice(0,2).localeCompare(b.code.slice(0,2),'fr-BE',{numeric:true})||a.suggestedCategory.localeCompare(b.suggestedCategory,'fr-BE')||a.code.localeCompare(b.code,'fr-BE',{numeric:true});
  })};
}
