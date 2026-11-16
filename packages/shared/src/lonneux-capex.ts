export type LonneuxCapexYear = 2024 | 2025;

export interface LonneuxCapexAccount {
  code:string;
  label:string;
  category:string;
  kind:'gross'|'accumulated';
  values:Partial<Record<LonneuxCapexYear,number>>;
  sourceFile:string;
}

export interface LonneuxCapexCategory {
  key:string;
  label:string;
  gross:Record<LonneuxCapexYear,number>;
  accumulated:Record<LonneuxCapexYear,number>;
  net:Record<LonneuxCapexYear,number>;
}

export interface LonneuxCapexPeriod {
  year:LonneuxCapexYear;
  through:string;
  status:'available'|'unavailable';
  gross:number|null;
  accumulated:number|null;
  net:number|null;
  depreciation:number|null;
  grossChange:number|null;
  accumulatedChange:number|null;
  netChange:number|null;
  otherAccumulatedImpact:number|null;
  bridgeDifference:number|null;
}

export interface LonneuxCapexReport {
  years:LonneuxCapexYear[];
  generatedAt:string;
  sourceFiles:string[];
  periods:LonneuxCapexPeriod[];
  categories:LonneuxCapexCategory[];
  accounts:LonneuxCapexAccount[];
  warnings:string[];
  scope:string;
}
