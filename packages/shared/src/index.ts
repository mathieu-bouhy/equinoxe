export type Role = 'admin' | 'viewer';
export type Status = 'active' | 'inactive';
/** Registre des dossiers analysés : l'administration s'adapte automatiquement à cette liste. */
export const analysedFiles = [{ slug: 'medipost', name: 'Medipost' }] as const;
export type AnalysedFileSlug = (typeof analysedFiles)[number]['slug'];
export interface Company { id:string; slug:string; name:string; status:Status; connectorType:'odoo'|'rest'|'none'; createdAt:string; updatedAt:string }
export interface User { id:string; name:string; email:string; role:Role; status:Status; analysisAccess:string[]; passwordHash:string; passwordSalt:string; createdAt:string; updatedAt:string; lastLoginAt:string|null }
export interface CompanyAccess { userId:string; companyId:string; createdAt:string }
export interface DashboardDefinition { id:string; companyId:string; slug:string; label:string; order:number; status:Status }
export type HoursClient = 'Gimi'|'Eurodrill'|null;
export interface TimeEntry { id:string; sourceCalendar:string; sourceEventId:string; title:string; start:string; end:string; attendees:Array<{name:string;email:string|null}>; client:HoursClient; correctedHours:number|null; importedAt:string }
export interface IntegrationMetadata { id:string; companyId:string; provider:'odoo'|'rest'; status:'connected'|'disconnected'|'not_configured'; baseUrl:string|null; database:string|null; lastTestAt:string|null; lastError:string|null; managedByEnvironment:boolean }
export interface ProfitLossAccount { id:string; code:string; label:string; values:Record<string,number>; source?:'odoo'|'history' }
export interface HistoricalAccountBalance { companyId:string; accountCode:string; label:string; year:number; amount:number; importedAt:string; sourceFile:string }
export interface AccountingEntry { id:string; date:string; label:string; partner:string|null; debit:number; credit:number; odooUrl:string|null }
export type ProfitLossSectionKind = 'accounts' | 'calculation';
export type ProfitLossFormulaOperator = 'add' | 'subtract';
export interface ProfitLossFormulaTerm { sectionId:string; operator:ProfitLossFormulaOperator }
/** A P&L line either groups account prefixes or calculates from other lines. */
export interface ProfitLossSection { id:string; companyId:string; label:string; kind:ProfitLossSectionKind; prefixes:string[]; formula:ProfitLossFormulaTerm[]; order:number; createdAt:string; updatedAt:string }
export interface ProfitLossSubsection { id:string; companyId:string; parentSectionId:string; label:string; prefixes:string[]; order:number; createdAt:string; updatedAt:string }
export interface ProfitLossSubsectionLine { id:string; label:string; values:Record<string,number>; accounts:ProfitLossAccount[] }
export interface ProfitLossLine { key:string; label:string; values:Record<string,number>; accounts?:ProfitLossAccount[]; subsections?:ProfitLossSubsectionLine[] }
export interface ProfitLossReport { years:number[]; lines:ProfitLossLine[]; generatedAt:string; source:'odoo' }
export interface ProfitLossMonthlyReport { year:number; months:string[]; lines:Array<{key:string;label:string;values:Record<string,number>}>; generatedAt:string; source:'odoo' }
export interface ReportSettings { companyId:string; lastClosedMonth:string; updatedAt:string }
export interface ProfitLossPeriod { key:string; label:string; start:string; end:string }
export interface ProfitLossLtmReport { periods:ProfitLossPeriod[]; lines:ProfitLossLine[]; generatedAt:string; source:'odoo' }
export interface BalanceAccount { id:string; code:string; label:string; values:Record<string,number> }
export interface BalanceLine { key:string; label:string; values:Record<string,number>; accounts:BalanceAccount[] }
export interface BalanceReport { years:number[]; assets:BalanceLine[]; liabilities:BalanceLine[]; generatedAt:string; source:'odoo' }
export type BfrSign = 'add'|'subtract';
/** Configurable operating working-capital grouping. `subtract` denotes an operating liability. */
export interface BfrSection { id:string; companyId:string; label:string; sign:BfrSign; prefixes:string[]; order:number; createdAt:string; updatedAt:string }
export interface BfrLine { id:string; label:string; sign:BfrSign; values:Record<string,number>; variations:Record<string,number|null>; accounts:BalanceAccount[] }
export interface BfrReport { years:number[]; lines:BfrLine[]; total:Record<string,number>; variation:Record<string,number|null>; generatedAt:string; source:'odoo' }
export interface CashFlowLine { key:string; label:string; values:Record<string,number>; detail?:string }
export interface CashFlowReport { years:number[]; lines:CashFlowLine[]; accountDetails?:Record<string,ProfitLossAccount[]>; nonCashDetails?:Record<string,ProfitLossAccount[]>; openingCash?:Record<string,number>; closingCash?:Record<string,number>; generatedAt:string; source:'odoo' }
export type MedipostForecastYear = 2026|2027|2028;
export type MedipostForecastValues = Record<MedipostForecastYear,number>;
/** Hypothèses globales du business plan Medipost, partagées par tous les environnements. */
export interface MedipostBusinessPlanAssumptions {
  growth:MedipostForecastValues;
  oldRent:number;
  newRent:number;
  salaryDifference:number;
  rentDifference:MedipostForecastValues;
  outgoingExecutiveSalary:MedipostForecastValues;
  incomingExecutiveSalary:MedipostForecastValues;
  companyValue:number;
  cashExtraction:number;
  loanAmount:number;
  loanYears:number;
  loanRate:number;
  workingCapitalRate:number;
  capex:MedipostForecastValues;
  rates:Record<string,MedipostForecastValues>;
  updatedAt:string;
  updatedByUserId:string|null;
}
export const medipostBusinessPlanDefaults=():Omit<MedipostBusinessPlanAssumptions,'updatedAt'|'updatedByUserId'>=>({
  growth:{2026:.05,2027:.05,2028:.05},
  oldRent:138000,newRent:208847,salaryDifference:-76000,
  rentDifference:{2026:0,2027:0,2028:0},
  outgoingExecutiveSalary:{2026:120000,2027:120000,2028:120000},
  incomingExecutiveSalary:{2026:120000,2027:120000,2028:120000},
  companyValue:4000000,cashExtraction:800000,loanAmount:3200000,loanYears:7,loanRate:.04,workingCapitalRate:.05,capex:{2026:284966,2027:299214,2028:314175},
  rates:{'Autres produits d’exploitation':{2026:165518/12403419,2027:165518/12403419,2028:165518/12403419},'Marchandises et approvisionnements':{2026:-7553179/12403419,2027:-7553179/12403419,2028:-7553179/12403419},'Services et biens divers':{2026:-1708634/12403419,2027:-1708634/12403419,2028:-1708634/12403419},'Frais de personnel':{2026:-2336496/12403419,2027:-2336496/12403419,2028:-2336496/12403419},'Autres charges d’exploitation':{2026:-119208/12403419,2027:-119208/12403419,2028:-119208/12403419},'Amortissements et réductions de valeur':{2026:-271396/12403419,2027:-271396/12403419,2028:-271396/12403419},'Produits financiers':{2026:15019/12403419,2027:15019/12403419,2028:15019/12403419},'Impôts sur le résultat':{2026:-142705/12403419,2027:-142705/12403419,2028:-142705/12403419}}
});
export interface PublicUser { id:string; name:string; email:string; role:Role; status:Status; analysisAccess:string[]; createdAt:string; updatedAt:string; lastLoginAt:string|null }
export const toPublicUser = ({passwordHash:_hash,passwordSalt:_salt,...user}:User):PublicUser => user;
export type ApiResponse<T>={data:T}|{error:{code:string;message:string}};
