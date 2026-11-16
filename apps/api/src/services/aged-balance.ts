import type { AgedBalanceReport, AgedInvoice, AgingBucket, AgingTotals, TreasurySide } from '@equinoxe/shared';

export interface TreasuryLedger {
  through:string; readAt:string; baseUrl:string;
  accounts:Array<{id:number;code:string;name:string;side:TreasurySide}>;
  lines:Array<{id:number;date:string;dueDate:string|null;balance:number;accountId:number;partnerId:number|null;partner:string;moveId:number;residual:number}>;
  moves:Array<{id:number;name:string;ref:string;invoiceDate:string|null;type:string}>;
  matches:Array<{id:number;date:string;debitId:number;creditId:number;amount:number}>;
  controls:Array<{date:string;accountId:number;balance:number}>;
}
export function validTreasuryDate(value:string) {
  return /^20\d{2}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)===value;
}
export function treasuryMonthEnds(through:string, count=13) {
  if(!validTreasuryDate(through))throw new Error('Date invalide.');
  const year=Number(through.slice(0,4)),month=Number(through.slice(5,7));
  return Array.from({length:count},(_,index)=>new Date(Date.UTC(year,month-count+index+1,0)).toISOString().slice(0,10));
}
export function agingBucket(asOf:string,due:string|null):{bucket:AgingBucket;daysLate:number|null} {
  if(!due)return {bucket:'noDueDate',daysLate:null};
  const days=Math.round((Date.parse(asOf)-Date.parse(due))/86400000);
  return {bucket:days<=0?'notDue':days<=30?'days30':days<=60?'days60':days<=90?'days90':'over90',daysLate:Math.max(0,days)};
}
const emptyTotals=():AgingTotals=>({notDue:0,days30:0,days60:0,days90:0,over90:0,noDueDate:0,invoices:0,overdue:0,other:0,doubtful:0,ledger:0});

/** Rebuild a dated residual, never reuse today's residual for an earlier month. */
export function buildAgedBalance(ledger:TreasuryLedger,side:TreasurySide,asOf:string,closedThrough:string):AgedBalanceReport {
  if(!validTreasuryDate(asOf)||asOf>ledger.through||!validTreasuryDate(closedThrough))throw new Error('Date hors du périmètre importé.');
  const accounts=new Map(ledger.accounts.filter(a=>a.side===side).map(a=>[a.id,a]));
  const moves=new Map(ledger.moves.map(move=>[move.id,move]));
  const sign=side==='clients'?1:-1;
  const snapshot=(date:string,details:boolean)=>{
    const residual=new Map(ledger.lines.filter(line=>line.date<=date).map(line=>[line.id,line.residual]));
    for(const match of ledger.matches)if(match.date>date){
      if(residual.has(match.debitId))residual.set(match.debitId,residual.get(match.debitId)!+match.amount);
      if(residual.has(match.creditId))residual.set(match.creditId,residual.get(match.creditId)!-match.amount);
    }
    const totals=emptyTotals(),rows:AgedInvoice[]=[];
    for(const line of ledger.lines){
      const account=accounts.get(line.accountId),remaining=residual.get(line.id);
      if(!account||remaining===undefined||Math.abs(remaining)<.005)continue;
      const move=moves.get(line.moveId);
      if(!move)throw new Error('Pièce comptable manquante.');
      const amount=remaining*sign;
      const kind:AgedInvoice['kind']=/^407/.test(account.code)?'doubtful':move.type===(side==='clients'?'out_invoice':'in_invoice')?'invoice':move.type===(side==='clients'?'out_refund':'in_refund')?'credit':'other';
      const aging=agingBucket(date,line.dueDate);
      totals.ledger+=amount;
      if(kind==='other')totals.other+=amount;
      else if(kind==='doubtful')totals.doubtful+=amount;
      else {totals.invoices+=amount;totals[aging.bucket]+=amount;}
      if(details){
        const url=new URL(ledger.baseUrl);url.username='';url.password='';url.pathname='/web';url.search='';url.hash=`id=${move.id}&model=account.move&view_type=form`;
        rows.push({id:line.id,moveId:move.id,number:move.name,reference:move.ref,partnerId:line.partnerId,partner:line.partner,account:account.code,date:line.date,invoiceDate:move.invoiceDate,dueDate:line.dueDate,original:line.balance*sign,settled:(line.balance-remaining)*sign||0,residual:amount,...aging,kind,odooUrl:url.toString()});
      }
    }
    totals.overdue=totals.days30+totals.days60+totals.days90+totals.over90;
    const controls=ledger.controls.filter(row=>row.date===date&&accounts.has(row.accountId));
    if(controls.length!==accounts.size)throw new Error('Contrôle comptable incomplet.');
    const control=controls.reduce((sum,row)=>sum+row.balance*sign,0);
    return {totals,rows,control,difference:totals.ledger-control};
  };
  const current=snapshot(asOf,true);
  const history=treasuryMonthEnds(closedThrough).map(date=>{const item=snapshot(date,false);return {date,...item.totals,control:item.control,difference:item.difference};});
  const upcoming=Array.from({length:4},(_,i)=>({startDay:i*7+1,endDay:(i+1)*7,amount:0}));
  for(const row of current.rows)if((row.kind==='invoice'||row.kind==='credit')&&row.dueDate){
    const days=Math.round((Date.parse(row.dueDate)-Date.parse(asOf))/86400000);
    const week=upcoming.find(w=>days>=w.startDay&&days<=w.endDay);
    if(week)week.amount+=row.residual;
  }
  const warnings:string[]=[];
  if(current.rows.some(row=>row.dueDate===null&&['invoice','credit'].includes(row.kind)))warnings.push('Certaines factures n’ont pas de date d’échéance : elles restent dans « Sans échéance ».');
  if(Math.abs(current.difference)>.01||history.some(row=>Math.abs(row.difference)>.01))warnings.push('Écart avec la balance comptable : consultez le rapprochement avant d’utiliser les montants.');
  if(Math.abs(current.totals.other)>.005)warnings.push('Les autres écritures et paiements non lettrés sont isolés ; ils ne sont pas imputés arbitrairement aux factures.');
  return {side,asOf,closedThrough,readAt:ledger.readAt,currency:'EUR',...current,history,accounts:[...accounts.values()].map(a=>({code:a.code,label:a.name,balance:(ledger.controls.find(c=>c.date===asOf&&c.accountId===a.id)!.balance)*sign})),upcoming,warnings};
}
