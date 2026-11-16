import type { BalanceReport, CapexAsset, CapexCategory, CapexMovement, CapexPeriod, CapexReport } from '@equinoxe/shared';
import type { OdooConnector } from '../connectors/odoo';
import type { FixedAssetLedger, FixedAssetEntry } from '../connectors/odoo-fixed-assets';
const groups=[['software','Logiciels et développements'],['vehicles','Véhicules et aménagements'],['it','Informatique et mobilier'],['tools','Installations et outillage'],['building','Terrains et constructions'],['layout','Aménagements des locaux'],['leasing','Location-financement'],['progress','Immobilisations en cours'],['other','Autres immobilisations']] as const;
const category=(code:string)=>code.startsWith('21')?'software':code.startsWith('241')?'vehicles':code.startsWith('24')?'it':code.startsWith('23')?'tools':code.startsWith('22')?'building':code.startsWith('26')?'layout':code.startsWith('25')?'leasing':code.startsWith('27')?'progress':'other';
const bnb:Record<number,CapexPeriod['bnb']>={2024:{acquisitions:234878,net:421931,reference:'BNB 2024 · p. 4, 9 et 10 · montants arrondis'},2025:{acquisitions:369490,net:562496,reference:'BNB 2025 · p. 4, 9 et 10 · montants arrondis'}};
export async function loadGimiCapex(connector:OdooConnector,through:string):Promise<CapexReport>{
 const year=Number(through.slice(0,4)),years=[year-2,year-1,year];
 const [ledger,balance]=await Promise.all([connector.getFixedAssetLedger(`${years[0]}-01-01`,through),connector.getBalance([years[0]-1,...years],through)]);
 return buildGimiCapex(ledger,balance,years);
}
export function buildGimiCapex(ledger:FixedAssetLedger,balance:BalanceReport,years:number[]):CapexReport{
 const accountById=new Map(ledger.accounts.map(a=>[a.id,a])),moveById=new Map(ledger.moves.map(m=>[m.id,m]));
 const contraIds=new Set(ledger.assets.flatMap(a=>a.account_depreciation_id?[a.account_depreciation_id[0]]:[]));
 const isContra=(id:number)=>!accountById.get(id)?.code.startsWith('630')&&(contraIds.has(id)||/AMORT|R[ÉE]DUCT/i.test(accountById.get(id)?.name??''));
 const balanceAccounts=balance.assets.flatMap(l=>l.accounts).filter(a=>/^2[1-7]/.test(a.code));
 const url=(model:string,id:number)=>`${ledger.baseUrl.replace(/\/$/,'')}/web#id=${id}&model=${model}&view_type=form`;
 const amount=(e:FixedAssetEntry)=>e.debit-e.credit;
 const entryAccount=(e:FixedAssetEntry)=>e.account_id?accountById.get(e.account_id[0]):undefined;
 const warnings:string[]=[];
 const assets:CapexAsset[]=ledger.assets.filter(a=>a.account_asset_id&&/^2[1-7]/.test(accountById.get(a.account_asset_id[0])?.code??'')).map(a=>{
  const code=accountById.get((a.account_asset_id as [number,string])[0])!.code;
  return {id:String(a.id),name:a.name,date:a.acquisition_date||null,disposalDate:a.disposal_date||null,accountCode:code,category:category(code),originalValue:a.original_value,state:a.state,invoicePosted:a.original_move_line_ids.some(id=>ledger.entries.some(e=>e.id===id)),url:url('account.asset',a.id)};
 });
 if(assets.some(a=>!a.date))warnings.push('Certaines fiches n’ont pas de date d’acquisition ; elles restent exclues des comparaisons par année.');
 const periods:CapexPeriod[]=years.map(year=>{
  const through=year===Number(ledger.through.slice(0,4))?ledger.through:`${year}-12-31`,from=`${year}-01-01`;
  const entries=ledger.entries.filter(e=>e.date>=from&&e.date<=through),byMove=new Map<number,FixedAssetEntry[]>();
  for(const e of entries){const id=(e.move_id as [number,string])[0];byMove.set(id,[...(byMove.get(id)??[]),e]);}
  // Cancel only exact, same-year reversal pairs present at this cutoff.
  const reversed=new Set<number>();
  for(const move of ledger.moves.filter(m=>m.date>=from&&m.date<=through&&m.ref&&/^Extourne de\s*:/i.test(m.ref))){
   const original=ledger.moves.find(m=>m.name===String(move.ref).replace(/^Extourne de\s*:\s*/i,'')&&m.date>=from&&m.date<=through);if(!original)continue;
   const sums=new Map<number,number>();for(const e of [...(byMove.get(move.id)??[]),...(byMove.get(original.id)??[])]){const id=(e.account_id as [number,string])[0];sums.set(id,(sums.get(id)??0)+amount(e));}
   if(sums.size&&[...sums.values()].every(v=>Math.abs(v)<.005)){reversed.add(move.id);reversed.add(original.id);}
  }
  const categories:CapexCategory[]=groups.map(([key,label])=>({key,label,gross:0,accumulated:0,net:0,acquisitions:0,disposals:0,amortization:0,otherGross:0,accounts:[]}));
  const group=(code:string)=>categories.find(c=>c.key===category(code))!;
  let openingGross=0,openingAccumulated=0;
  for(const a of balanceAccounts){const end=a.values[String(year)]??0,begin=a.values[String(year-1)]??0,contra=isContra(Number(a.id)),c=group(a.code);if(contra){c.accumulated-=end;openingAccumulated-=begin;}else{c.gross+=end;openingGross+=begin;}c.accounts.push({code:a.code,label:a.label,gross:contra?0:end,accumulated:contra?-end:0,net:end});}
  const movements:CapexMovement[]=[];let grossDelta=0,cumulativeDelta=0,amortization=0;
  const monthly=Array.from({length:Number(through.slice(5,7))},(_,i)=>({month:`${year}-${String(i+1).padStart(2,'0')}`,acquisitions:0}));
  for(const e of entries){const a=entryAccount(e);if(!a)throw Error('Compte d’immobilisation absent.');const v=amount(e),move=moveById.get((e.move_id as [number,string])[0])!;
   if(a.code.startsWith('630')){amortization+=v;const counterparts=(byMove.get(move.id)??[]).filter(r=>r.account_id&&isContra((r.account_id as [number,string])[0]));const total=counterparts.reduce((s,r)=>s-amount(r),0);if(Math.abs(total)>.005){for(const r of counterparts)group(entryAccount(r)!.code).amortization+=v*(-amount(r))/total;}else if(Math.abs(v)>.005)warnings.push(`${year} : une dotation ne peut pas être ventilée par famille ; son total reste inclus.`);continue;}
   if(isContra(a.id)){cumulativeDelta-=v;continue;}grossDelta+=v;if(reversed.has(move.id)||Math.abs(v)<.005)continue;
   const c=group(a.code),yearAssets=assets.filter(asset=>asset.accountCode===a.code&&asset.date?.startsWith(String(year))),matchesAsset=yearAssets.some(asset=>Math.abs(asset.originalValue-v)<.011)||yearAssets.length>0&&Math.abs(yearAssets.reduce((sum,asset)=>sum+asset.originalValue,0)-v)<.011;
   const kind:CapexMovement['kind']=['in_invoice','in_refund'].includes(move.move_type)||v>0&&matchesAsset?'acquisition':v<0&&(move.asset_move_type==='sale'||move.asset_move_type==='disposal'||/vente|cession|fin du droit|désaffect/i.test(`${e.name} ${move.ref}`))?'disposal':'other';
   const contribution=kind==='disposal'?-v:v;
   if(kind==='acquisition'){c.acquisitions+=v;const month=monthly.find(m=>m.month===e.date.slice(0,7));if(month)month.acquisitions+=v;}else if(kind==='disposal')c.disposals-=v;else c.otherGross+=v;
   movements.push({id:String(e.id),date:e.date,label:ledger.assets.find(asset=>asset.original_move_line_ids.includes(e.id))?.name??(typeof e.name==='string'?e.name:move.name),accountCode:a.code,category:c.key,kind,amount:contribution,url:url('account.move',move.id)});
  }
  for(const c of categories){c.net=c.gross-c.accumulated;c.accounts=c.accounts.filter(a=>Math.abs(a.gross)+Math.abs(a.accumulated)>.005);}
  const total=(key:'gross'|'accumulated'|'net'|'acquisitions'|'disposals'|'otherGross')=>categories.reduce((s,c)=>s+c[key],0);
  const closingGross=total('gross'),closingAccumulated=total('accumulated'),grossDifference=closingGross-openingGross-grossDelta,netDifference=(closingGross-closingAccumulated)-(openingGross-openingAccumulated)-(grossDelta-cumulativeDelta);
  if(bnb[year]&&Math.abs((closingGross-closingAccumulated)-bnb[year]!.net)>2)warnings.push(`${year} : la VNC diffère des comptes annuels BNB au-delà des arrondis ; rapprochement à vérifier.`);
  if(Math.abs(grossDifference)>.011||Math.abs(netDifference)>.011)warnings.push(`${year} : un écart de rapprochement avec le bilan reste à analyser.`);
  return {year,from,through,openingGross,closingGross,openingAccumulated,closingAccumulated,openingNet:openingGross-openingAccumulated,closingNet:closingGross-closingAccumulated,acquisitions:total('acquisitions'),disposals:total('disposals'),amortization,otherGross:total('otherGross'),otherAmortization:cumulativeDelta-amortization,categories:categories.filter(c=>Math.abs(c.gross)+Math.abs(c.accumulated)+Math.abs(c.acquisitions)+Math.abs(c.disposals)+Math.abs(c.otherGross)>.005),grossDifference,netDifference,monthly,movements,bnb:bnb[year]??null};
 });
 return {through:ledger.through,generatedAt:new Date().toISOString(),currency:'EUR',periods,assets,warnings:[...new Set(warnings)],budget:null,scope:'Immobilisations incorporelles 21 et corporelles 22–27 ; écritures validées. Cautions et placements 28, prêts 29 exclus. Acquisitions identifiées : factures et capitalisations rattachées aux fiches ; apports et reclassements séparés. Les cessions sont en valeur brute comptable, sans assimilation au prix de vente ni aux décaissements.'};
}
