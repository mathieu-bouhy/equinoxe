import type {HistoricalAccountBalance,LonneuxCapexAccount,LonneuxCapexCategory,LonneuxCapexPeriod,LonneuxCapexReport,LonneuxCapexYear} from '@equinoxe/shared';

const years:LonneuxCapexYear[]=[2024,2025];
const groups=[
  ['software','Logiciels et site internet'],
  ['building','Terrains et bâtiments'],
  ['tools','Matériel d’exploitation'],
  ['it','Mobilier, bureau et informatique'],
  ['vehicles','Véhicules'],
  ['layout','Aménagements'],
  ['other','Autres immobilisations'],
] as const;

const category=(code:string)=>code.startsWith('21')?'software':code.startsWith('22')?'building':code.startsWith('23')?'tools':code.startsWith('241')?'vehicles':code.startsWith('240')?'it':code.startsWith('26')?'layout':'other';
const isAccumulated=(row:Pick<HistoricalAccountBalance,'label'>)=>/AMORT|R[ÉE]DUCTION DE VALEUR/i.test(row.label);
const cleanLabel=(row:HistoricalAccountBalance)=>row.label.replace(new RegExp(`^${row.accountCode}\\s*`),'').trim();
const total=(rows:HistoricalAccountBalance[])=>rows.reduce((sum,row)=>sum+row.amount,0);

/** Historical-only CAPEX view. It never calls Odoo and never labels balance changes as paid acquisitions. */
export function buildLonneuxHistoricalCapex(history:HistoricalAccountBalance[],companyId:string):LonneuxCapexReport{
  const own=history.filter(row=>row.companyId===companyId&&years.includes(row.year as LonneuxCapexYear));
  const fixed=own.filter(row=>/^2[0-7]/.test(row.accountCode));
  const available=new Set(fixed.map(row=>row.year));
  const sourceFiles=[...new Set(own.map(row=>row.sourceFile).filter(Boolean))];
  const accounts:LonneuxCapexAccount[]=[...new Set(fixed.map(row=>row.accountCode))].sort().map(code=>{
    const rows=fixed.filter(row=>row.accountCode===code),sample=rows[0];
    return {code,label:cleanLabel(sample),category:category(code),kind:isAccumulated(sample)?'accumulated':'gross',values:Object.fromEntries(rows.map(row=>[row.year,row.amount])),sourceFile:sample.sourceFile};
  });
  const categories:LonneuxCapexCategory[]=groups.map(([key,label])=>{
    const rows=fixed.filter(row=>category(row.accountCode)===key);
    const gross=Object.fromEntries(years.map(year=>[year,total(rows.filter(row=>row.year===year&&!isAccumulated(row)))])) as Record<LonneuxCapexYear,number>;
    const accumulated=Object.fromEntries(years.map(year=>[year,-total(rows.filter(row=>row.year===year&&isAccumulated(row)))])) as Record<LonneuxCapexYear,number>;
    return {key,label,gross,accumulated,net:Object.fromEntries(years.map(year=>[year,gross[year]-accumulated[year]])) as Record<LonneuxCapexYear,number>};
  }).filter(group=>years.some(year=>Math.abs(group.gross[year])+Math.abs(group.accumulated[year])>.005));
  const periodTotals=(year:LonneuxCapexYear)=>{
    if(!available.has(year))return null;
    const gross=categories.reduce((sum,item)=>sum+item.gross[year],0),accumulated=categories.reduce((sum,item)=>sum+item.accumulated[year],0);
    return {gross,accumulated,net:gross-accumulated,depreciation:Math.abs(total(own.filter(row=>row.year===year&&/^630/.test(row.accountCode))))};
  };
  const totals2024=periodTotals(2024),totals2025=periodTotals(2025);
  const periods:LonneuxCapexPeriod[]=years.map(year=>{
    const values=year===2024?totals2024:totals2025;
    if(!values)return {year,through:`${year}-12-31`,status:'unavailable',gross:null,accumulated:null,net:null,depreciation:null,grossChange:null,accumulatedChange:null,netChange:null,otherAccumulatedImpact:null,bridgeDifference:null};
    if(year===2024||!totals2024)return {year,through:`${year}-12-31`,status:'available',...values,grossChange:null,accumulatedChange:null,netChange:null,otherAccumulatedImpact:null,bridgeDifference:null};
    const grossChange=values.gross-totals2024.gross,accumulatedChange=values.accumulated-totals2024.accumulated,netChange=values.net-totals2024.net;
    const otherAccumulatedImpact=values.depreciation-accumulatedChange;
    const bridgeDifference=values.net-(totals2024.net+grossChange-values.depreciation+otherAccumulatedImpact);
    return {year,through:`${year}-12-31`,status:'available',...values,grossChange,accumulatedChange,netChange,otherAccumulatedImpact,bridgeDifference};
  });
  const warnings=[
    '2024 : le solde au 31 décembre est disponible, mais l’ouverture 2023 manque ; aucun pont d’acquisitions ou de sorties 2024 n’est calculé.',
    '2025 : les historiques fournissent des soldes annuels, pas le journal des acquisitions, cessions ou paiements. Les variations brutes restent présentées comme variations de soldes.',
  ];
  if(periods.some(period=>period.status==='unavailable'))warnings.push('Une période historique est absente du jeu importé ; les valeurs correspondantes restent indisponibles.');
  return {years,generatedAt:new Date().toISOString(),sourceFiles,periods,categories,accounts,warnings,scope:'Comptes historiques 20 à 27 et dotations 630 importés depuis Excel dans PostgreSQL. Les comptes 28, les données Odoo 2025–2026 et tout budget sont exclus. Les soldes permettent de mesurer valeur brute, amortissements cumulés et VNC ; ils ne prouvent ni acquisitions brutes, ni cessions, ni paiements.'};
}

export async function loadLonneuxHistoricalCapex(readHistory:()=>Promise<HistoricalAccountBalance[]>,companyId:string){
  return buildLonneuxHistoricalCapex(await readHistory(),companyId);
}
