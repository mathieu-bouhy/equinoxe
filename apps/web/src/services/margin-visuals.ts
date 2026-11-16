import type {MarginAnalysisReport} from '@equinoxe/shared';
export function marginVisualData(report:MarginAnalysisReport,year:number){
 const revenue=report.blocks.find(b=>b.key==='revenue'),margin=report.blocks.find(b=>b.key==='margin');
 const priorYear=report.years.includes(year-1)?year-1:null;
 const rate=(value:number|undefined,base:number|undefined)=>value===undefined||base===undefined||Math.abs(base)<.005?null:value/base*100;
 const rows=(margin?.rows??[]).map(row=>{const sales=revenue?.rows.find(r=>r.key===row.key),value=row.values[String(year)],prior=priorYear===null?undefined:row.values[String(priorYear)],ca=sales?.values[String(year)],priorCa=priorYear===null?undefined:sales?.values[String(priorYear)];return {key:row.key,label:row.label,margin:value??null,priorMargin:prior??null,revenue:ca??null,rate:rate(value,ca),priorRate:rate(prior,priorCa)};});
 const totalRevenue=revenue?.totals[String(year)],totalMargin=margin?.totals[String(year)];
 return {year,priorYear,rows:rows.filter(r=>r.key!=='other'||[r.margin,r.priorMargin,r.revenue].some(v=>v!==null&&Math.abs(v)>.005)),totalRevenue:totalRevenue??null,totalMargin:totalMargin??null,totalRate:rate(totalMargin,totalRevenue),other:rows.find(r=>r.key==='other')};
}
