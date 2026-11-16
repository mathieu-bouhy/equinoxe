import type { BfrLine } from './index';
export interface CashOverviewMonth {date:string;cash:number;bfr:number;stocks:number;workInProgress:number;components:BfrLine[]}
export interface CashOverviewReport {through:string;generatedAt:string;months:CashOverviewMonth[];ebitda:number|null;ebitdaPeriod:string;cashScope:string}
