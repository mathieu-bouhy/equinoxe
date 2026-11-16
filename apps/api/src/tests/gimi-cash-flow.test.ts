import { expect,test } from 'bun:test';
import { buildGimiCashFlow,loadGimiCashFlow } from '../services/gimi-cash-flow';
import type { BalanceReport, BfrReport, CashFlowReport, ProfitLossReport } from '@equinoxe/shared';
const values=(a:number,b=a,c=b)=>({'2024':a,'2025':b,'2026':c});
const account=(code:string,v:Record<string,number>)=>({id:code,code,label:code,values:v});
function fixture(){
 const report={years:[2024,2025,2026],openingCash:values(100,132,231),closingCash:values(132,231,258),source:'odoo',generatedAt:'2026-11-16',lines:[{key:'net-result',label:'Résultat après impôts',values:values(100)},{key:'depreciation',label:'Amortissements',values:values(-10)},{key:'nwc',label:'BFR',values:values(0)},{key:'capex',label:'CAPEX',values:values(-30)},{key:'cfads',label:'Ancien flux',values:values(60)},{key:'free-cash-flow',label:'Ancien flux libre',values:values(60)}],accountDetails:{distributions:[account('550002',values(-20,-20,-40))]},nonCashDetails:{capex:[account('241900',values(10))]}} as CashFlowReport;
 const balance={assets:[{key:'fixed-assets',accounts:[account('288100',{'2023':0,...values(3,5,6)}),account('291200',{'2023':0,...values(40,30,32)})]}],liabilities:[{key:'financial-debt',accounts:[account('173000',{'2023':200,...values(200,240,220)})]},{key:'equity',accounts:[account('151000',{'2023':-2,...values(-5)})]}]} as unknown as BalanceReport;
 const pnl={lines:[{label:'Amortissements',accounts:[account('630000',values(-10))]}]} as ProfitLossReport;
 const bfr={lines:[]} as unknown as BfrReport;
 const journal=(move:number,code:string,debit:number,credit:number,date:string)=>({id:move,date,name:'Justificatif',move_id:[move,'Pièce'] as [number,string],account_id:[Number(code),`${code} Compte`] as [number,string],company_id:[1,'Gimi'] as [number,string],journal_id:[1,'OD'] as [number,string],debit,credit});
 const audit={through:'2026-10-31',readAt:'2026-11-16',groups:[],moves:[],journals:[],lines:[journal(73309,'133000',0,20,'2024-01-01'),journal(73459,'471000',2,0,'2024-09-30'),journal(101323,'471000',4,0,'2025-06-30'),journal(98058,'550002',0,10,'2026-01-09'),journal(98058,'416850',10,0,'2026-01-09')]};
 return {report,balance,pnl,bfr,audit,extra:[account('634000',values(0,-5,0))],through:'2026-10-31'};
}
const residual=(r:CashFlowReport,y:number)=>(r.closingCash![y]-r.openingCash![y])-(r.lines.find(l=>l.key==='free-cash-flow')!.values[y])-(r.accountDetails!.distributions.reduce((s,a)=>s+(a.values[y]??0),0));
test('pont : signe amortissements, financements en hausse, compensations sans banque et comptes complémentaires',()=>{
 const r=buildGimiCashFlow(fixture());
 expect(r.lines.find(l=>l.key==='depreciation')!.values).toEqual(values(10));
 expect(r.lines.find(l=>l.key==='debt-repayment')!.values).toEqual(values(0,40,-20));
 expect(r.lines.find(l=>l.key==='free-cash-flow')!.values).toEqual(values(52,119,57));
 expect(r.accountDetails!.distributions[0].values).toEqual(values(-20,-20,-30));
 expect(r.years.map(y=>residual(r,y))).toEqual([0,0,0]);
});
test('aucun ajustement de bouclage : une nouvelle différence reste visible',()=>{
 const f=fixture();f.report.closingCash!['2026']+=17.25;
 expect(residual(buildGimiCashFlow(f),2026)).toBe(17.25);
});
test('preuve absente ou postérieure à la clôture : ne pas appliquer une neutralisation supposée',()=>{
 const f=fixture();f.audit.lines=f.audit.lines.filter(l=>l.move_id[0]!==73309);f.audit.lines.find(l=>l.move_id[0]===98058)!.date='2026-11-01';
 const r=buildGimiCashFlow(f);expect(r.lines.find(l=>l.key==='merger')!.values['2024']).toBe(0);expect(residual(r,2024)).toBe(20);expect(residual(r,2026)).toBe(10);
});
test('détail signé : chaque liste de comptes rejoint sa rubrique sans double reprise du 634',()=>{
 const r=buildGimiCashFlow(fixture());
 for(const key of ['depreciation','pnl-coverage','asset-adjustment','deposits','long-term-loans','debt-repayment','merger','capital-subsidies','dividend-offsets'])for(const year of r.years){
  expect(r.accountDetails![key].reduce((s,a)=>s+(a.values[year]??0),0)).toBeCloseTo(r.lines.find(l=>l.key===key)!.values[year],8);
 }
 expect(r.lines.find(l=>l.key==='pnl-coverage')!.values['2025']).toBe(-5);
});

test('rubriques modifiées : ne pas reprendre un compte 634 déjà couvert par le résultat',async()=>{
 const f=fixture();let requested:string[]=[];
 f.pnl.lines.push({key:'covered',label:'Provisions',values:values(1),accounts:[account('634100',values(1))]});
 const connector={getCashFlow:async()=>f.report,getBalance:async()=>f.balance,getProfitLoss:async()=>f.pnl,getBfr:async()=>f.bfr,getProfitLossAccounts:async()=>[account('634100',values(1)),account('761000',values(7))],getCashAudit:async()=>f.audit,getProfitLossAccountMonths:async(ids:string[])=>{requested=ids;return [{accountId:'761000',values:{'2024-01':7,'2026-11':99}}];}};
 const r=await loadGimiCashFlow(connector as never,[2024,2025,2026],[],f.through,[]);
 expect(requested).toEqual(['761000']);expect(r.accountDetails!['pnl-coverage'].map(a=>a.code)).toEqual(['761000']);expect(r.lines.find(l=>l.key==='pnl-coverage')!.values['2024']).toBe(7);
});
