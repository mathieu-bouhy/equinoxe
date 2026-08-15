export type Role = 'admin' | 'viewer';
export type Status = 'active' | 'inactive';
export interface Company { id:string; slug:string; name:string; status:Status; connectorType:'odoo'|'rest'|'none'; createdAt:string; updatedAt:string }
export interface User { id:string; name:string; email:string; role:Role; status:Status; analysisAccess:string[]; passwordHash:string; passwordSalt:string; createdAt:string; updatedAt:string; lastLoginAt:string|null }
export interface CompanyAccess { userId:string; companyId:string; createdAt:string }
export interface DashboardDefinition { id:string; companyId:string; slug:string; label:string; order:number; status:Status }
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
export interface PublicUser { id:string; name:string; email:string; role:Role; status:Status; analysisAccess:string[]; createdAt:string; updatedAt:string; lastLoginAt:string|null }
export const toPublicUser = ({passwordHash:_hash,passwordSalt:_salt,...user}:User):PublicUser => user;
export type ApiResponse<T>={data:T}|{error:{code:string;message:string}};
