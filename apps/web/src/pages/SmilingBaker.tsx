import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useOutletContext } from 'react-router-dom';
import { AlertTriangle, ExternalLink, FileText, ShieldCheck, Sigma, TrendingDown } from 'lucide-react';
import type { PublicUser } from '@equinoxe/shared';
import { Card, PageHeader } from '../components/ui';
import { api } from '../services/api';
import { buildSmilingBakerForecast, coreWorkingCapital, indicativeNetCash, reconstructedEbitda, smilingBakerValuation } from '../services/smiling-baker-analysis';
import { SmilingBakerDossierAnalysis } from './SmilingBakerAnalysis';
import './finance.css';
import './smiling-baker.css';

type ActualYear = 2022 | 2023 | 2024 | 2025;
type Tab = 'pnl' | 'balance' | 'bfr' | 'plan' | 'valuation' | 'analysis' | 'sources';
type ActualValues = Record<ActualYear, number | null>;
type Row = { label: string; values: ActualValues; calculation?: boolean };

const years: ActualYear[] = [2022, 2023, 2024, 2025];
const values = (y22:number|null,y23:number|null,y24:number|null,y25:number|null):ActualValues => ({2022:y22,2023:y23,2024:y24,2025:y25});
const amount = (value:number|null) => value===null?'—':new Intl.NumberFormat('fr-BE',{maximumFractionDigits:0}).format(value/1000);
const euro = (value:number) => new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);
const ratio = (value:number) => new Intl.NumberFormat('fr-BE',{style:'percent',maximumFractionDigits:1}).format(value);

const pnl:Row[] = [
  {label:"Chiffre d’affaires",values:values(null,null,15755767,12476464)},
  {label:'Marge brute / marge après achats et services',values:values(3203600,5054489,5409967,5328967),calculation:true},
  {label:'Rémunérations et charges sociales',values:values(-930070,-1123449,-1222041,-1462103)},
  {label:'EBITDA reconstitué',values:values(reconstructedEbitda(526958,1739385),reconstructedEbitda(2089060,1832352),reconstructedEbitda(2794444,1381209),reconstructedEbitda(2412235,1443476)),calculation:true},
  {label:'Amortissements et réductions de valeur',values:values(-1739385,-1832352,-1381209,-1443476)},
  {label:"Autres charges d’exploitation",values:values(-7187,-9628,-12273,-11153)},
  {label:"Résultat d’exploitation (EBIT)",values:values(526958,2089060,2794444,2412235),calculation:true},
  {label:'Résultat financier',values:values(168226,231308,282387,263132)},
  {label:'Résultat avant impôts',values:values(695184,2320367,3076831,2675367),calculation:true},
  {label:'Impôts sur le résultat',values:values(-185916,-63718,-587782,-642200)},
  {label:"Résultat de l’exercice",values:values(509268,2256649,2489049,2033167),calculation:true},
];

const balanceAssets:Row[] = [
  {label:'Actifs immobilisés',values:values(6153494,5363339,4768760,4257467)},
  {label:'Stocks',values:values(1558336,2678420,823621,1397435)},
  {label:'Créances commerciales',values:values(1505500,1665356,2135358,1968015)},
  {label:'Autres créances',values:values(287190,529580,493467,99984)},
  {label:'Trésorerie et placements',values:values(442813,445077,144893,2020118)},
  {label:'Comptes de régularisation',values:values(0,381212,15865,24002)},
  {label:"Total de l’actif",values:values(9947333,11062985,8381963,9767021),calculation:true},
];
const balanceLiabilities:Row[] = [
  {label:'Capitaux propres',values:values(2746894,2763943,4941391,6775958)},
  {label:"Dettes à plus d’un an",values:values(3768582,2709880,1655401,764544)},
  {label:"Dettes à plus d’un an échéant dans l’année",values:values(1985885,1299416,904487,890865)},
  {label:'Dettes commerciales',values:values(1039228,1403973,661401,782189)},
  {label:'Dettes fiscales, salariales et sociales',values:values(116745,150774,213833,541416)},
  {label:'Autres dettes',values:values(290000,2735000,5450,12050)},
  {label:'Total du passif',values:values(9947333,11062985,8381963,9767021),calculation:true},
];
const bfrRows:Row[] = [
  {label:'+ Stocks',values:values(1558336,2678420,823621,1397435)},
  {label:'+ Créances commerciales',values:values(1505500,1665356,2135358,1968015)},
  {label:'− Dettes commerciales',values:values(-1039228,-1403973,-661401,-782189)},
  {label:'BFR cœur',values:values(coreWorkingCapital(1558336,1505500,1039228),coreWorkingCapital(2678420,1665356,1403973),coreWorkingCapital(823621,2135358,661401),coreWorkingCapital(1397435,1968015,782189)),calculation:true},
];

function Matrix({title,eyebrow,description,rows,note}:{title:string;eyebrow:string;description:string;rows:Row[];note?:string}){
  return <Card className="profit-loss smiling-matrix"><div className="profit-loss-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div><div className="unit-note"><Sigma size={17}/><span>milliers d’euros</span></div></div><div className="report-table"><table className="report-matrix"><thead><tr><th>Rubrique</th>{years.map(year=><th key={year}>{year}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.label} className={row.calculation?'calculation-row key-calculation':''}><td>{row.label}</td>{years.map(year=><td key={year}>{amount(row.values[year])}</td>)}</tr>)}</tbody></table></div>{note&&<p className="report-note">{note}</p>}</Card>;
}

function ProfitLoss(){
  return <div className="smiling-stack"><div className="smiling-kpis"><Card><span>CA 2025</span><strong>12,48 M€</strong><small>−20,8 % vs 2024</small></Card><Card><span>EBITDA 2025</span><strong>3,86 M€</strong><small>30,9 % du CA</small></Card><Card><span>Résultat net 2025</span><strong>2,03 M€</strong><small>16,3 % du CA</small></Card><Card><span>Effectif moyen 2025</span><strong>32 ETP</strong><small>24,5 ETP en 2024</small></Card></div><Matrix eyebrow="Comptes annuels BNB" title="Compte de résultat" description="Lecture statutaire 2022–2025. Les charges sont affichées en négatif." rows={pnl} note="Les schémas abrégés 2022–2023 ne publient pas le chiffre d’affaires ni le détail achats/services. Leur marge brute est donc publiée telle quelle. Pour 2024–2025, la marge est recalculée après achats et services. L’EBITDA est reconstitué comme EBIT + amortissements, faute de compte détaillé. Le dépôt 2024 reprend l’EBIT comparatif 2023 avec un écart de reclassement de 3 k€ ; le montant du dépôt propre à 2023 est conservé."/><Card className="smiling-callout"><TrendingDown/><div><strong>Le signal central est la baisse du chiffre d’affaires 2025.</strong><p>Le CA recule de 3,28 M€ alors que l’EBITDA ne baisse que de 320 k€. La marge EBITDA passe de 26,5 % à 30,9 %, soutenue notamment par la variation de stocks. Cette résilience doit être validée sur comptes détaillés et données mensuelles avant d’être normalisée.</p></div></Card></div>;
}

function Balance(){
  const metrics=[['Solvabilité',.276,.250,.590,.694],['Liquidité générale',1.105,1.020,2.024,2.475],['Liquidité réduite',.651,.541,1.563,1.847]] as const;
  return <div className="smiling-stack"><Matrix eyebrow="Comptes annuels BNB" title="Bilan — actif" description="Composition de l’actif statutaire." rows={balanceAssets}/><Matrix eyebrow="Comptes annuels BNB" title="Bilan — passif" description="Financement de l’entreprise et échéances publiées." rows={balanceLiabilities}/><Card className="profit-loss"><div className="profit-loss-heading"><div><p className="eyebrow">Ratios de structure</p><h2>Solidité financière</h2><p>Ratios calculés directement sur les bilans déposés.</p></div></div><div className="report-table"><table className="report-matrix"><thead><tr><th>Ratio</th>{years.map(year=><th key={year}>{year}</th>)}</tr></thead><tbody>{metrics.map(([label,...row])=><tr key={label}><td>{label}</td>{row.map((value,index)=><td key={years[index]}>{label==='Solvabilité'?ratio(value):`${value.toFixed(2)}×`}</td>)}</tr>)}</tbody></table></div></Card><Card className="smiling-callout positive"><ShieldCheck/><div><strong>Le désendettement est très marqué.</strong><p>La dette financière nette indicative passe d’environ 5,31 M€ en 2022 à une trésorerie nette de 0,36 M€ en 2025. Les capitaux propres atteignent 69,4 % du bilan. À vérifier : propriété économique des 2,0 M€ de placements et restrictions éventuelles sur cette trésorerie.</p></div></Card></div>;
}

function Bfr(){
  return <div className="smiling-stack"><Matrix eyebrow="Périmètre prudent" title="Besoin en fonds de roulement" description="BFR cœur limité aux postes identifiables sans ambiguïté dans les comptes BNB : stocks + clients − fournisseurs." rows={bfrRows} note="Les autres créances, dettes fiscales/sociales, autres dettes et régularisations sont volontairement exclus du BFR cœur : les comptes détaillés sont nécessaires pour distinguer l’exploitation, l’impôt sur les sociétés, les dividendes et les comptes liés."/><div className="smiling-kpis"><Card><span>BFR cœur 2025</span><strong>2,58 M€</strong><small>20,7 % du CA</small></Card><Card><span>Variation 2025</span><strong>+286 k€</strong><small>consommation de trésorerie</small></Card><Card><span>Stocks 2025</span><strong>1,40 M€</strong><small>+69,7 % vs 2024</small></Card><Card><span>Créances clients</span><strong>1,97 M€</strong><small>−7,8 % vs 2024</small></Card></div><Card className="smiling-callout warning"><AlertTriangle/><div><strong>Le BFR présenté est provisoire, pas un BFR transactionnel.</strong><p>La hausse 2025 provient surtout du réapprovisionnement des stocks. Sans balances âgées, détail des comptes 41/45/47/48 et données mensuelles, il est impossible de fixer un niveau normatif ou une cible de closing fiable.</p></div></Card></div>;
}

function BusinessPlan({onMultiple}:{onMultiple:(value:number)=>void}){
  const [assumptions,setAssumptions]=useState({growth:5,ebitdaMargin:28.7,depreciationRate:10,taxRate:25,bfrRate:17.7,multiple:5.5});
  const plan=useMemo(()=>buildSmilingBakerForecast(12476464,assumptions),[assumptions]);
  const update=(key:keyof typeof assumptions,value:number)=>{const next={...assumptions,[key]:value};setAssumptions(next);if(key==='multiple')onMultiple(value)};
  const planRows=[['Chiffre d’affaires','revenue'],['EBITDA','ebitda'],['Amortissements','depreciation'],['EBIT','ebit'],['Résultat après impôt indicatif (avant financement)','net'],['Variation du BFR cœur','bfrChange'],['Cash-flow avant CAPEX et financement','freeCash']] as const;
  return <div className="smiling-stack"><Card><div className="profit-loss-heading compact"><div><p className="eyebrow">Hypothèse : scénario mécanique</p><h2>Business plan 2026–2028</h2><p>Projection simple fondée sur les ratios publiés. Elle ne remplace pas un budget opérationnel par clients, produits, volumes et prix.</p></div></div><div className="smiling-assumptions">{([['growth','Croissance annuelle du CA'],['ebitdaMargin','Marge EBITDA'],['depreciationRate','Amortissements / CA'],['taxRate','Taux d’impôt'],['bfrRate','BFR cœur / CA'],['multiple','Multiple de valorisation']] as const).map(([key,label])=><label key={key}>{label}<span><input type="number" step="0.1" value={assumptions[key]} onChange={event=>update(key,Number(event.target.value))}/>{key==='multiple'?'×':'%'}</span></label>)}</div><div className="report-table"><table className="report-matrix"><thead><tr><th>Rubrique</th>{plan.map(row=><th key={row.year}>{row.year}</th>)}</tr></thead><tbody>{planRows.map(([label,key])=><tr key={key} className={/EBITDA|Cash-flow/.test(label)?'calculation-row':''}><td>{label}</td>{plan.map(row=><td key={row.year}>{amount(row[key])}</td>)}</tr>)}</tbody></table></div><p className="report-note">Hypothèse : croissance de 5 %, marge EBITDA normalisée à 28,7 % (moyenne 2024–2025), amortissements à 10 % du CA, impôt à 25 % et BFR cœur à 17,7 % du CA. Le cash-flow exclut CAPEX, dette d’acquisition, dividendes et éléments exceptionnels.</p></Card></div>;
}

function Valuation({multiple}:{multiple:number}){
  const normalizedEbitda=(reconstructedEbitda(2794444,1381209)+reconstructedEbitda(2412235,1443476))/2,netCash=indicativeNetCash(2020118,764544,890865),{enterpriseValue,equityValue}=smilingBakerValuation(normalizedEbitda,multiple,netCash);
  return <div className="smiling-stack"><div className="smiling-kpis valuation"><Card><span>EBITDA normalisé</span><strong>{euro(normalizedEbitda)}</strong><small>moyenne 2024–2025</small></Card><Card><span>Valeur d’entreprise</span><strong>{euro(enterpriseValue)}</strong><small>{multiple.toFixed(1)}× EBITDA</small></Card><Card><span>Trésorerie nette indicative</span><strong>{euro(netCash)}</strong><small>au 31/12/2025</small></Card><Card><span>Valeur des titres</span><strong>{euro(equityValue)}</strong><small>avant ajustements DD</small></Card></div><Card className="profit-loss"><div className="profit-loss-heading"><div><p className="eyebrow">Fourchette indicative</p><h2>Sensibilité au multiple</h2><p>Valeur des titres = EBITDA normalisé × multiple + trésorerie nette indicative.</p></div></div><div className="report-table"><table className="report-matrix"><thead><tr><th>Multiple</th><th>Valeur d’entreprise</th><th>Valeur des titres</th></tr></thead><tbody>{[4,5,5.5,6,7].map(item=><tr key={item} className={item===multiple?'calculation-row key-calculation':''}><td>{item.toFixed(1)}×</td><td>{amount(normalizedEbitda*item)}</td><td>{amount(normalizedEbitda*item+netCash)}</td></tr>)}</tbody></table></div><p className="report-note">Cette fourchette n’est pas une recommandation de prix. Elle ignore notamment dette assimilée, cash excédentaire requis, normalisation des rémunérations, parties liées, fiscalité latente, CAPEX de maintien et concentration commerciale.</p></Card><Card className="smiling-callout warning"><AlertTriangle/><div><strong>À ne pas utiliser comme prix d’offre avant due diligence.</strong><p>L’EBITDA statutaire incorpore des effets de stocks et n’est pas normalisé compte par compte. Le multiple n’est pas étayé par une étude de transactions comparables. La valorisation sert uniquement de matrice de sensibilité.</p></div></Card></div>;
}

function Sources(){const filings=[['2022','2023-00423966','31/08/2023','Schéma abrégé'],['2023','2024-00194461','02/07/2024','Schéma abrégé'],['2024','2025-00354567','31/07/2025','Schéma complet'],['2025','2026-00224340','30/06/2026','Schéma complet']];return <div className="smiling-stack"><Card><p className="eyebrow">Traçabilité</p><h2>Documents utilisés</h2><div className="smiling-sources">{filings.map(([year,id,date,scheme])=><div key={id}><FileText/><span><strong>Comptes annuels {year}</strong><small>Dépôt BNB {id} · {date} · {scheme}</small></span></div>)}</div></Card><Card><p className="eyebrow">Source entreprise</p><h3>Présentation publique</h3><p>Le site de Smiling Baker est utilisé uniquement pour l’historique, le positionnement distributeurs/Horeca et la présence internationale annoncée.</p><a className="smiling-source-link" href="https://www.smilingbaker.be/fr/about-us" target="_blank" rel="noreferrer">Ouvrir le site Smiling Baker <ExternalLink size={15}/></a></Card><Card className="smiling-callout warning"><AlertTriangle/><div><strong>Limite documentaire.</strong><p>Les comptes statutaires ne donnent pas la granularité nécessaire pour normaliser l’EBITDA, établir un BFR transactionnel, reconstruire les flux de trésorerie ou conclure sur la valorisation. Les chiffres calculés sont identifiés comme tels.</p></div></Card></div>}

export function SmilingBakerFile(){
  const {me}=useOutletContext<{me:PublicUser}>(),authorised=me.role==='admin'||me.analysisAccess.includes('smiling-baker');
  const access=useQuery({queryKey:['analysed-file','smiling-baker'],queryFn:()=>api.analysedFile('smiling-baker'),enabled:authorised});
  const [tab,setTab]=useState<Tab>('pnl'),[multiple,setMultiple]=useState(5.5);
  if(!authorised)return <Navigate to="/sans-acces" replace/>;if(access.isLoading)return <div className="state">Vérification de l’accès au dossier…</div>;if(access.error)return <Navigate to="/sans-acces" replace/>;
  const tabs:Array<[Tab,string]>=[['pnl','Compte de résultat'],['balance','Bilan'],['bfr','BFR'],['plan','Business plan'],['valuation','Valorisation'],['analysis','Analyse du dossier'],['sources','Sources']];
  return <div className="smiling-baker-file"><PageHeader title="Smiling Baker"><p className="breadcrumb">Dossiers analysés / Smiling Baker</p></PageHeader><div className="tabs" role="tablist">{tabs.map(([key,label])=><button key={key} className={tab===key?'analysis-tab active':'analysis-tab'} onClick={()=>setTab(key)}>{label}</button>)}</div>{tab==='pnl'?<ProfitLoss/>:tab==='balance'?<Balance/>:tab==='bfr'?<Bfr/>:tab==='plan'?<BusinessPlan onMultiple={setMultiple}/>:tab==='valuation'?<Valuation multiple={multiple}/>:tab==='analysis'?<SmilingBakerDossierAnalysis/>:<Sources/>}</div>;
}
