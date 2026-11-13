import type { ProfitLossLine } from '@equinoxe/shared';
import { gimiBudget2026 } from './gimi-budget';

export const analysisLabels=['Chiffre d’affaires','Marchandises','Marge brute','Sous-traitance','Services et biens divers','Personnel','EBITDA'] as const;
export const normalizeLabel=(label:string)=>label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’']/g,'').toLowerCase().trim();
export function findLine(lines:ProfitLossLine[],label:string){return lines.find(l=>normalizeLabel(l.label)===normalizeLabel(label));}
export const relativeChange=(actual:number|null,previous:number|null)=>actual===null||previous===null||previous===0?null:(actual-previous)/Math.abs(previous);
export function analysisRows(lines:ProfitLossLine[],current:string,previous:string,year:number,months:number,mode:'ytd'|'ltm'){
  return analysisLabels.map(label=>{
    const line=findLine(lines,label),actual=line?.values[current]??null,prior=line?.values[previous]??null;
    const annual=year===2026?gimiBudget2026[label]:undefined;
    const budget=annual===undefined?null:annual*(mode==='ytd'?months/12:1);
    return {label,line,actual,prior,budget,delta:actual===null||prior===null?null:actual-prior,change:relativeChange(actual,prior),budgetDelta:actual===null||budget===null?null:actual-budget,budgetChange:relativeChange(actual,budget)};
  });
}

/** Account deltas use source values, including positive releases and credits. */
export function accountMovements(line:ProfitLossLine|undefined,current:string,previous:string){
  return (line?.accounts??[]).filter(a=>a.values[current]!==undefined||a.values[previous]!==undefined)
    .map(a=>({...a,actual:a.values[current]??0,prior:a.values[previous]??0,delta:(a.values[current]??0)-(a.values[previous]??0)}))
    .filter(a=>Math.abs(a.delta)>0.005).sort((a,b)=>Math.abs(b.delta)-Math.abs(a.delta));
}
