import type { BalanceReport, BfrReport, BfrSection, CashFlowLine, CashFlowReport, ProfitLossAccount, ProfitLossReport, ProfitLossSection } from '@equinoxe/shared';
import type { OdooConnector } from '../connectors/odoo';

type Audit = Awaited<ReturnType<OdooConnector['getCashAudit']>>;
type Inputs = { report:CashFlowReport; balance:BalanceReport; pnl:ProfitLossReport; bfr:BfrReport; extra:ProfitLossAccount[]; audit:Audit; through:string };
const codeOf = (line:Audit['lines'][number]) => line.account_id ? line.account_id[1].split(' ')[0] : '';
const auditedMoves = [73309,73459,101323,98058]; // GIMI only; read amounts afresh, never store balancing amounts.

export async function loadGimiCashFlow(connector:OdooConnector,years:number[],sections:ProfitLossSection[],through:string,bfrSections:BfrSection[]):Promise<CashFlowReport>{
  const balanceYears=[Math.min(...years)-1,...years];
  const [report,balance,pnl,bfr,accounts,audit]=await Promise.all([
    connector.getCashFlow(years,sections,through,bfrSections),connector.getBalance(balanceYears,through),
    connector.getProfitLoss(years,sections,[],false,through),connector.getBfr(balanceYears,bfrSections,through),
    connector.getProfitLossAccounts(),connector.getCashAudit([1249,1433,241],auditedMoves,through),
  ]);
  const covered=new Set(pnl.lines.flatMap(line=>line.accounts??[]).map(account=>account.id));
  const missing=accounts.filter(account=>/^(634|761)/.test(account.code)&&!covered.has(account.id));
  const months=await connector.getProfitLossAccountMonths(missing.map(account=>account.id),years,through);
  const extra=missing.map(account=>({...account,values:Object.fromEntries(years.map(year=>[String(year),Object.entries(months.find(row=>row.accountId===account.id)?.values??{}).filter(([month])=>month.startsWith(`${year}-`)).reduce((sum,[,amount])=>sum+amount,0)]))}));
  return buildGimiCashFlow({report,balance,pnl,bfr,extra,audit,through});
}

/** Method approved 16 November 2026. Residual is always computed by the UI, never plugged. */
export function buildGimiCashFlow({report,balance,pnl,bfr,extra,audit,through}:Inputs):CashFlowReport{
  const {years}=report;
  const values=(get:(year:number)=>number)=>Object.fromEntries(years.map(year=>[String(year),get(year)]));
  const all=balance.assets.concat(balance.liabilities).flatMap(line=>line.accounts);
  const delta=(account:ProfitLossAccount,year:number)=>(account.values[String(year)]??0)-(account.values[String(year-1)]??0);
  const source=(key:string)=>report.lines.find(line=>line.key===key)?.values??{};
  const sum=(rows:ProfitLossAccount[],year:number)=>rows.reduce((total,account)=>total+(account.values[String(year)]??0),0);
  const changes=(pattern:RegExp,sign=1)=>all.filter(account=>pattern.test(account.code)).map(account=>({...account,values:values(year=>sign*delta(account,year))}));
  const journalRows=(move:number,pattern:RegExp,sign:number):ProfitLossAccount[]=>{
    const grouped=new Map<string,ProfitLossAccount>();
    for(const entry of audit.lines){
      const code=codeOf(entry),year=Number(entry.date.slice(0,4));
      const end=year===Number(through.slice(0,4))?through:`${year}-12-31`;
      if(!entry.move_id||entry.move_id[0]!==move||!pattern.test(code)||!years.includes(year)||entry.date>end)continue;
      const id=String(entry.account_id&&entry.account_id[0]),row=grouped.get(id)??{id,code,label:entry.account_id?entry.account_id[1].slice(code.length+1):code,values:{}};
      row.values[String(year)]=(row.values[String(year)]??0)+sign*(entry.debit-entry.credit);grouped.set(id,row);
    }
    return [...grouped.values()];
  };
  // Only explicitly reviewed reclassifications are excluded from keyword-based distributions.
  // New/unreviewed postings remain in the computed residual rather than being swept away.
  const advance=journalRows(98058,/^5/,-1);
  const distributions=(report.accountDetails?.distributions??[]).map(account=>({...account,label:`Dividendes payés · ${account.code}`,values:values(year=>(account.values[String(year)]??0)+sum(advance.filter(row=>row.code===account.code),year))}));
  const depreciation=(pnl.lines.find(line=>line.label==='Amortissements')?.accounts??[]).map(account=>({...account,values:values(year=>-(account.values[String(year)]??0))}));
  const assetAdjust=(report.nonCashDetails?.capex??[]).map(account=>({...account,values:values(year=>account.values[String(year)]??0)}));
  // Sum of cumulative depreciation changes - current expense: removes non-cash
  // cancellations/imports from gross asset changes. It is not a list of cash invoices.
  const amortAccounts=new Map(depreciation.map(account=>[account.id,{...account,values:values(year=>-sum(depreciation.filter(row=>row.id===account.id),year))}]));
  const nonCashAssets=[...assetAdjust,...amortAccounts.values()];
  const deposits=changes(/^28/,-1),loans=changes(/^29/,-1),debt=changes(/^(17|42|43)/);
  const merger=journalRows(73309,/^(13|14)/,-1),subsidies=changes(/^151/);
  const offsetRows=[...journalRows(73459,/^471/,-1),...journalRows(101323,/^471/,-1)];
  const offsets=[...new Map(offsetRows.map(account=>[account.id,account])).values()].map(account=>({...account,values:values(year=>sum(offsetRows.filter(row=>row.id===account.id),year))}));
  const nwc=bfr.lines.flatMap(line=>line.accounts.map(account=>({...account,values:values(year=>-delta(account,year))})));
  const line=(key:string,label:string,amounts:Record<string,number>,detail:string):CashFlowLine=>({key,label,values:amounts,detail});
  const additions:CashFlowLine[]=[
    line('pnl-coverage','Comptes de résultat complémentaires',values(year=>sum(extra,year)),'Comptes 634 et 761 absents des rubriques du P&L, repris une seule fois. Le BFR reste net des réductions de valeur clients : aucune seconde réintégration du compte 634.'),
    line('asset-adjustment','Neutralisation des mouvements non monétaires sur immobilisations',values(year=>sum(nonCashAssets,year)),'Variation des amortissements cumulés moins dotation de l’année : cessions, reprises et imports de soldes, sans nouveau décaissement. BNB 2025, annexe 6.1.2 p. 10 : annulations de 114 831 euros arrondis.'),
    line('deposits','Cautions et immobilisations financières',values(year=>sum(deposits,year)),'Impact opposé à la variation des comptes 28. Cautions versées et restituées ; les variations bilantaires ne constituent pas seules une preuve de paiement.'),
    line('long-term-loans','Prêts et intérêts à long terme',values(year=>sum(loans,year)),'Impact opposé à la variation des comptes 29, y compris les intérêts capitalisés non encaissés. Lire avec les compensations de dividendes et la fusion : leurs montants ne sont pas des flux bancaires supplémentaires.'),
    line('merger','Fusion Dallemagne : neutralisation des capitaux propres repris',values(year=>sum(merger,year)),'ODVER/2024/0008 du 01/01/2024. Contrepartie des actifs, dettes et BFR repris dans le pont ; aucun apport bancaire de ce montant.'),
    line('capital-subsidies','Reprises de subsides en capital sans encaissement',values(year=>sum(subsidies,year)),'Variation du compte 151 : neutralise le produit déjà inclus dans le résultat.'),
    line('dividend-offsets','Compensations de dividendes sans banque',values(year=>sum(offsets,year)),'2024 : compensation 471 / 416850, sans encaissement du compte courant. 2025 : compensation 471 / 291200, sans remboursement bancaire du prêt. Neutralise leur effet dans le BFR ou les prêts.'),
  ];
  const before=values(year=>(source('net-result')[String(year)]??0)+sum(depreciation,year)+(source('nwc')[String(year)]??0)+(source('capex')[String(year)]??0)+additions.reduce((total,row)=>total+(row.values[String(year)]??0),0));
  const free=values(year=>before[String(year)]+sum(debt,year));
  const original=report.lines.filter(row=>!['depreciation','cfads','interest','debt-repayment','free-cash-flow'].includes(row.key)).map(row=>row.key==='capex'?{...row,label:'Investissements et cessions : variation brute',detail:'Variation opposée des soldes bruts 20 à 27. Les mouvements non monétaires sont neutralisés séparément ; ce montant n’est pas présenté comme une liste de factures payées.'}:row);
  original.splice(1,0,line('depreciation','+ Amortissements',values(year=>sum(depreciation,year)),'Les charges d’amortissement négatives du P&L sont réintégrées avec un signe positif.'));
  return {...report,through,lines:[...original,...additions,
    line('cfads','Flux comptable après intérêts, avant financement',before,'Résultat après impôts, amortissements, BFR configuré, immobilisations et ajustements documentés. Les intérêts sont déjà inclus : aucune seconde déduction.'),
    line('debt-repayment','Variation nette des financements',values(year=>sum(debt,year)),'Variation des soldes 17, 42 et 43, hausses comme diminutions. Ce montant net ne mesure pas les remboursements bruts de crédits.'),
    line('free-cash-flow','Flux net après financements, avant dividendes',free,'Pont comptable documenté avant dividendes payés. Le contrôle final compare toujours le montant calculé avec la variation de trésorerie réelle.')],
    accountDetails:{...report.accountDetails,distributions,depreciation,nwc,'pnl-coverage':extra,'asset-adjustment':nonCashAssets,capex:report.accountDetails?.capex??[],deposits,'long-term-loans':loans,'debt-repayment':debt,merger,'capital-subsidies':subsidies,'dividend-offsets':offsets,
      'cash-opening':all.filter(account=>/^5/.test(account.code)).map(account=>({...account,values:values(year=>account.values[String(year-1)]??0)})),
      'cash-ending':all.filter(account=>/^5/.test(account.code)),
    },
    explanations:[
      {title:'Amortissements et cessions',text:'Le rajout des amortissements est positif. Les sorties d’amortissements cumulés et reprises de soldes sont neutralisées séparément. Les annexes BNB documentent les acquisitions et cessions ; elles ne prouvent pas à elles seules les paiements.'},
      {title:'Dividendes et Bajoma',text:'Le montant décidé de 1,715 M en 2025 est distinct du montant payé. Les compensations de 2024 et 2025 n’ont pas de mouvement bancaire. L’avance du 09/01/2026 est comptabilisée en compte courant et reste dans le BFR : elle est exclue des dividendes pour éviter un double compte.',sources:[{label:'Avance Bajoma · Odoo',url:'https://odoo.gimi.be/web#id=98058&model=account.move&view_type=form'},{label:'Compensation 2025 · Odoo',url:'https://odoo.gimi.be/web#id=101323&model=account.move&view_type=form'}]},
      {title:'Fusion et autres opérations non monétaires',text:'La fusion Dallemagne importe des actifs, des dettes et des capitaux propres ; ceux-ci sont rapprochés ensemble. Les intérêts capitalisés sur les prêts et les reprises de subsides n’ajoutent pas de cash.',sources:[{label:'Fusion · Odoo',url:'https://odoo.gimi.be/web#id=73309&model=account.move&view_type=form'}]},
      {title:'Périmètre et contrôle',text:'Même BFR que l’onglet BFR, mêmes comptes de classe 5 que le bilan, écritures validées et dernier mois clôturé. Les années closes couvrent janvier à décembre. Le solde résiduel reste calculé : une nouvelle écriture non expliquée ne sera pas masquée. Rapprochement comptable, sans certification bancaire.'},
    ],
  };
}
