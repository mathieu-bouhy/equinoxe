export interface PartnerRankingRow {id:number;name:string;amount:number;share:number|null;url:string}
export interface PartnerRanking {accountingTotal:number;excluded:number;total:number;topTotal:number;share:number|null;other:number;unassigned:number;partnerCount:number;rows:PartnerRankingRow[]}
export interface PartnerRankingsReport {mode:'ytd'|'ltm';from:string;through:string;clients:PartnerRanking;suppliers:PartnerRanking;revenueDifference:number;generatedAt:string;scope:'company'}
