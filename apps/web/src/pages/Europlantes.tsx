import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useOutletContext } from 'react-router-dom';
import { AlertTriangle, Building2, FileText, Scale, ShieldCheck, Sigma, TrendingUp } from 'lucide-react';
import type { PublicUser } from '@equinoxe/shared';
import { Card, PageHeader } from '../components/ui';
import { api } from '../services/api';
import { adjustedEbitda, buildEuroplantesForecast, coreWorkingCapital, europlantesValuation, indicativeNetCash, reconstructedEbitda } from '../services/europlantes-analysis';
import { EuroplantesDossierAnalysis } from './EuroplantesAnalysis';
import './finance.css';
import './smiling-baker.css';
import './europlantes.css';
import './europlantes-layout.css';

type Year = 2022|2023|2024|2025;
type Values = Record<Year,number|null>;
type Row = {label:string;values:Values;calculation?:boolean;secondary?:boolean};
type Tab = 'pnl'|'balance'|'bfr'|'plan'|'valuation'|'building'|'adjustments'|'analysis'|'sources';

const years:Year[]=[2022,2023,2024,2025];
const values=(y22:number|null,y23:number|null,y24:number|null,y25:number|null):Values=>({2022:y22,2023:y23,2024:y24,2025:y25});
const amount=(value:number|null)=>value===null?'—':new Intl.NumberFormat('fr-BE',{maximumFractionDigits:0}).format(value/1000);
const euro=(value:number)=>new Intl.NumberFormat('fr-BE',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(value);
const percent=(value:number)=>new Intl.NumberFormat('fr-BE',{style:'percent',maximumFractionDigits:1}).format(value);

const ebitda=values(
  reconstructedEbitda(356321,112713,0),
  reconstructedEbitda(468616,135227,13354),
  reconstructedEbitda(539228,163832,-1727),
  reconstructedEbitda(919467,160526,4441),
);
const bfr=values(
  coreWorkingCapital(106946,486364,389852),
  coreWorkingCapital(136380,580794,244404),
  coreWorkingCapital(123903,608290,279911),
  coreWorkingCapital(178276,1139273,397882),
);
const netCash=values(
  indicativeNetCash(513229,208845,112786),
  indicativeNetCash(679366,257252,118392),
  indicativeNetCash(856100,325737,127844),
  indicativeNetCash(1056179,225432,100305),
);

const pnl:Row[]=[
  {label:"Chiffre d’affaires (données vendeur)",values:values(5013000,4922238,5903984,6907692),secondary:true},
  {label:'Marge brute statutaire',values:values(1244872,1555792,1744850,2215777),calculation:true},
  {label:'Rémunérations et charges sociales',values:values(-746087,-913954,-997344,-1061375)},
  {label:'EBITDA statutaire reconstitué',values:ebitda,calculation:true},
  {label:'Amortissements',values:values(-112713,-135227,-163832,-160526)},
  {label:'Réductions de valeur nettes',values:values(0,-13354,1727,-4441)},
  {label:"Autres charges d’exploitation",values:values(-29750,-24642,-46174,-69967)},
  {label:"Résultat d’exploitation (EBIT)",values:values(356321,468616,539228,919467),calculation:true},
  {label:'Résultat financier',values:values(-2268,-1782,-4448,-1138)},
  {label:'Résultat avant impôts',values:values(354052,466833,534779,918330),calculation:true},
  {label:'Impôts sur le résultat',values:values(-84947,-122887,-135542,-235183)},
  {label:"Résultat net de l’exercice",values:values(269588,344111,399237,683146),calculation:true},
];

const assets:Row[]=[
  {label:'Actifs immobilisés',values:values(558136,479484,619416,455309)},
  {label:'Terrains et constructions',values:values(226052,185280,164272,126067),secondary:true},
  {label:'Installations, machines et outillage',values:values(9878,16156,194064,168464),secondary:true},
  {label:'Mobilier et matériel roulant',values:values(175232,182508,205491,133364),secondary:true},
  {label:'Stocks',values:values(106946,136380,123903,178276)},
  {label:'Créances commerciales',values:values(486364,580794,608290,1139273)},
  {label:'Autres créances',values:values(222356,182551,209384,207432)},
  {label:'Trésorerie',values:values(513229,679366,856100,1056179)},
  {label:'Comptes de régularisation',values:values(9796,935,12839,14637)},
  {label:"Total de l’actif",values:values(1896827,2059510,2429932,3051107),calculation:true},
];
const liabilities:Row[]=[
  {label:'Capitaux propres',values:values(935500,1174235,1518097,1945868)},
  {label:"Dettes financières à plus d’un an",values:values(208845,257252,325737,225432)},
  {label:"Échéances financières à moins d’un an",values:values(112786,118392,127844,100305)},
  {label:'Dettes commerciales',values:values(389852,244404,279911,397882)},
  {label:'Dettes fiscales, salariales et sociales',values:values(119680,150226,156472,183649)},
  {label:'Autres dettes',values:values(130000,115000,15000,195000)},
  {label:'Comptes de régularisation',values:values(0,0,6871,2971)},
  {label:'Total du passif',values:values(1896827,2059510,2429932,3051107),calculation:true},
];

function Matrix({title,eyebrow,description,rows,note}:{title:string;eyebrow:string;description:string;rows:Row[];note?:string}){
  return <Card className="profit-loss smiling-matrix"><div className="profit-loss-heading"><div><p className="eyebrow">{eyebrow}</p><h2>{title}</h2><p>{description}</p></div><div className="unit-note"><Sigma size={17}/><span>milliers d’euros</span></div></div><div className="report-table"><table className="report-matrix"><thead><tr><th>Rubrique</th>{years.map(year=><th key={year}>{year}</th>)}</tr></thead><tbody>{rows.map(row=><tr key={row.label} className={`${row.calculation?'calculation-row key-calculation ':''}${row.secondary?'europlantes-secondary-row':''}`}><td>{row.label}</td>{years.map(year=><td key={year}>{amount(row.values[year])}</td>)}</tr>)}</tbody></table></div>{note&&<p className="report-note">{note}</p>}</Card>;
}

function ProfitLoss(){
  return <div className="smiling-stack"><div className="smiling-kpis"><Card><span>CA vendeur 2025</span><strong>6,91 M€</strong><small>+17,0 % vs 2024</small></Card><Card><span>EBITDA statutaire</span><strong>1,08 M€</strong><small>15,7 % du CA vendeur</small></Card><Card><span>Résultat net BNB</span><strong>683 k€</strong><small>9,9 % du CA vendeur</small></Card><Card><span>Effectif moyen</span><strong>25,1 ETP</strong><small>hors intérimaires</small></Card></div><Matrix eyebrow="BNB prioritaire · données vendeur signalées" title="Compte de résultat" description="Les agrégats statutaires proviennent des comptes déposés. Le chiffre d’affaires, non publié dans le schéma abrégé, vient du mémorandum." rows={pnl} note="Le chiffre d’affaires 2022 est une indication arrondie du mémorandum. Les charges sont affichées en négatif. L’EBITDA est reconstitué comme EBIT + amortissements + réductions de valeur nettes. Les retraitements vendeur sont isolés dans leur propre onglet."/><Card className="smiling-callout positive"><TrendingUp/><div><strong>Le levier opérationnel est réel, mais la base vendeur doit rester séparée.</strong><p>Entre 2022 et 2025, l’EBIT statutaire passe de 356 k€ à 919 k€ et le résultat net de 270 k€ à 683 k€. Le CA détaillé n’étant pas publié par la BNB, les marges rapportées au CA restent tributaires du mémorandum.</p></div></Card></div>;
}

function Balance(){
  const metrics=[['Solvabilité',.493,.570,.625,.638],['Liquidité générale',1.78,2.52,3.13,2.96],['Trésorerie nette / (dette nette)',191598,303722,402519,730442]] as const;
  return <div className="smiling-stack"><Matrix eyebrow="Comptes annuels BNB" title="Bilan — actif" description="Actifs déposés après répartition du résultat." rows={assets}/><Matrix eyebrow="Comptes annuels BNB" title="Bilan — passif" description="Structure financière statutaire après répartition." rows={liabilities}/><Card className="profit-loss"><div className="profit-loss-heading"><div><p className="eyebrow">Ratios de structure</p><h2>Solidité financière</h2><p>Calculs fondés exclusivement sur les bilans BNB.</p></div></div><div className="report-table"><table className="report-matrix"><thead><tr><th>Ratio</th>{years.map(year=><th key={year}>{year}</th>)}</tr></thead><tbody>{metrics.map(([label,...row])=><tr key={label}><td>{label}</td>{row.map((value,index)=><td key={years[index]}>{label==='Solvabilité'?percent(value):label==='Liquidité générale'?`${value.toFixed(2)}×`:amount(value)}</td>)}</tr>)}</tbody></table></div></Card><Card className="smiling-callout positive"><ShieldCheck/><div><strong>La structure financière s’est renforcée.</strong><p>Les capitaux propres représentent 63,8 % du total du bilan fin 2025 et la trésorerie nette indicative atteint 730 k€. Cette trésorerie doit encore être vérifiée au niveau de Flagship et dans le mécanisme de prix de la transaction.</p></div></Card></div>;
}

function Bfr(){
  const rows:Row[]=[{label:'+ Stocks',values:values(106946,136380,123903,178276)},{label:'+ Créances commerciales',values:values(486364,580794,608290,1139273)},{label:'− Dettes commerciales',values:values(-389852,-244404,-279911,-397882)},{label:'BFR cœur',values:bfr,calculation:true}];
  return <div className="smiling-stack"><Matrix eyebrow="Périmètre prudent" title="Besoin en fonds de roulement" description="BFR cœur = stocks + créances commerciales − dettes fournisseurs." rows={rows} note="Les autres créances sont exclues car elles comprennent notamment une avance récurrente de 162 k€ à Flagship et des postes fiscaux. Les dettes fiscales, sociales et diverses sont également isolées tant que leur détail opérationnel n’est pas disponible."/><div className="smiling-kpis"><Card><span>BFR cœur 2025</span><strong>920 k€</strong><small>13,3 % du CA vendeur</small></Card><Card><span>Variation 2025</span><strong>+467 k€</strong><small>consommation de trésorerie</small></Card><Card><span>Créances clients</span><strong>1,14 M€</strong><small>+87,3 % vs 2024</small></Card><Card><span>DSO indicatif</span><strong>60 jours</strong><small>38 jours en 2024</small></Card></div><Card className="smiling-callout warning"><AlertTriangle/><div><strong>Le BFR 2025 n’est pas normatif.</strong><p>Le mémorandum attribue la hausse des créances à des problèmes IT et organisationnels temporaires chez deux clients. Il faut une balance âgée, les encaissements post-clôture et un historique mensuel par magasin avant de fixer une cible de BFR au closing.</p></div></Card></div>;
}

const adjustmentRows:Array<[string,number,number,number]>=[
  ['Neutralisation d’autres produits d’exploitation',-98205,-13740,-41132],
  ['Loyer théorique de l’immeuble détenu',-87170,-87170,-87170],
  ['Normalisation du parc automobile en renting',-101219,-116813,-80845],
  ['Notes de crédit anciennes comptabilisées en 2025',0,0,76904],
  ['Rémunérations dirigeants ramenées à 120 k€ par dirigeant',141049,142795,163940],
  ['Charges exceptionnelles neutralisées',7140,33548,51265],
];

function SellerAdjustments(){
  const bnb=[617197,701333,1084434],seller=[478791,659953,1170936],reconciled=[2023,2024,2025].map((_,index)=>adjustedEbitda(bnb[index],adjustmentRows.map(row=>row[index+1] as number)));
  return <div className="smiling-stack"><Card className="europlantes-adjustment-hero"><p className="eyebrow">Rapprochement non audité</p><h2>Analyse des retraitements du vendeur</h2><p>Le mémorandum transforme l’EBITDA historique en EBITDA corrigé. Equinoxe conserve deux ponts : le pont publié par le vendeur et un pont recalé sur l’EBITDA BNB.</p></Card><Card className="profit-loss"><div className="profit-loss-heading"><div><p className="eyebrow">Pont EBITDA</p><h2>Retraitements détaillés</h2><p>Montants positifs : ajout à l’EBITDA. Montants négatifs : déduction.</p></div><div className="unit-note"><Scale size={17}/><span>milliers d’euros</span></div></div><div className="report-table"><table className="report-matrix"><thead><tr><th>Rubrique</th><th>2023</th><th>2024</th><th>2025</th></tr></thead><tbody><tr className="calculation-row"><td>EBITDA statutaire reconstitué BNB</td>{bnb.map((value,index)=><td key={index}>{amount(value)}</td>)}</tr>{adjustmentRows.map(row=><tr key={row[0]}><td>{row[0]}</td>{row.slice(1).map((value,index)=><td key={index}>{amount(Number(value))}</td>)}</tr>)}<tr className="calculation-row key-calculation"><td>EBITDA ajusté recalé sur BNB</td>{reconciled.map((value,index)=><td key={index}>{amount(value)}</td>)}</tr><tr><td>EBITDA corrigé publié par le vendeur</td>{seller.map((value,index)=><td key={index}>{amount(value)}</td>)}</tr></tbody></table></div><p className="report-note">L’écart 2023 de 1 € est un arrondi du mémorandum. En 2025, le point de départ vendeur dépasse la base BNB de 3 540 €. L’EBITDA ajusté recalé sur BNB ressort donc à 1 167 396 €, contre 1 170 936 € publié.</p></Card><Card className="profit-loss"><div className="profit-loss-heading"><div><p className="eyebrow">Contrôle 2025</p><h2>Écarts entre BNB et mémorandum</h2><p>Le bilan vendeur ne correspond pas au dépôt statutaire final.</p></div></div><div className="report-table"><table className="report-matrix"><thead><tr><th>Poste</th><th>BNB</th><th>Mémorandum</th><th>Écart vendeur − BNB</th></tr></thead><tbody>{[
    ['EBIT',919467,923006],['Impôts',235183,180307],['Résultat net',683146,741561],['Capitaux propres',1945868,2154283],['Dettes',1105239,896824],['Fournisseurs',397882,394343],['Dettes fiscales et sociales',183649,128772],['Autres dettes',195000,45000],
  ].map(([label,bnbValue,sellerValue])=><tr key={String(label)}><td>{label}</td><td>{amount(Number(bnbValue))}</td><td>{amount(Number(sellerValue))}</td><td>{amount(Number(sellerValue)-Number(bnbValue))}</td></tr>)}</tbody></table></div><p className="report-note">L’écart de bilan atteint 208 415 € : le mémorandum présente davantage de capitaux propres et moins de dettes que les comptes déposés. Aucune réconciliation justificative n’est fournie.</p></Card><div className="europlantes-adjustment-grid"><Card><h3>Retraitements défendables sous condition</h3><ul><li>Loyer théorique si l’immobilier est valorisé séparément.</li><li>Rémunérations des dirigeants si les packages de remplacement sont documentés.</li><li>Éléments réellement non récurrents avec factures et grand livre.</li></ul></Card><Card><h3>Retraitements à challenger</h3><ul><li>Produits d’exploitation retirés sans détail exhaustif.</li><li>Normalisation du parc automobile sans contrats ni CAPEX comparables.</li><li>Notes de crédit 2020–2021 sans pièces et traitement fiscal.</li><li>Charges FlowR ou Peppol pouvant être récurrentes dans une phase de croissance.</li></ul></Card></div><Card className="smiling-callout warning"><AlertTriangle/><div><strong>Base de valorisation recommandée à ce stade : sensibilité, pas montant unique.</strong><p>Afficher simultanément 1,084 M€ statutaire, 1,167 M€ ajusté recalé sur BNB et 1,171 M€ vendeur. Aucun de ces montants ne doit être présenté comme EBITDA normalisé définitif avant revue du grand livre et des pièces.</p></div></Card></div>;
}

function BusinessPlan(){
  const [assumptions,setAssumptions]=useState({growth:6,ebitdaMargin:14,depreciationRate:2.3,taxRate:25,bfrRate:13.3,capex:150000});
  const plan=useMemo(()=>buildEuroplantesForecast(6907692,919667,assumptions),[assumptions]);
  const rows=[['Chiffre d’affaires','revenue'],['EBITDA','ebitda'],['Amortissements','depreciation'],['EBIT','ebit'],['Impôts indicatifs','tax'],['Résultat après impôt avant financement','net'],['BFR cœur','bfr'],['Variation du BFR','bfrChange'],['CAPEX','capex'],['Cash-flow avant financement','freeCash']] as const;
  return <div className="smiling-stack"><Card><div className="profit-loss-heading compact"><div><p className="eyebrow">Hypothèses distinctes des historiques</p><h2>Business plan 2026–2029</h2><p>2026 reprend le cas vendeur de 7,5 M€ de CA et 1,0 M€ d’EBITDA. Les années suivantes sont mécaniques et éditables.</p></div></div><div className="smiling-assumptions">{([['growth','Croissance annuelle dès 2027','%'],['ebitdaMargin','Marge EBITDA dès 2027','%'],['depreciationRate','Amortissements / CA','%'],['taxRate','Taux d’impôt','%'],['bfrRate','BFR cœur / CA','%'],['capex','CAPEX annuel dès 2027','€']] as const).map(([key,label,unit])=><label key={key}>{label}<span><input type="number" step={key==='capex'?10000:.1} value={assumptions[key]} onChange={event=>setAssumptions({...assumptions,[key]:Number(event.target.value)})}/>{unit}</span></label>)}</div><div className="report-table"><table className="report-matrix"><thead><tr><th>Rubrique</th>{plan.map(row=><th key={row.year}>{row.year}</th>)}</tr></thead><tbody>{rows.map(([label,key])=><tr key={key} className={/EBITDA|Cash-flow/.test(label)?'calculation-row':''}><td>{label}</td>{plan.map(row=><td key={row.year}>{amount(row[key])}</td>)}</tr>)}</tbody></table></div><p className="report-note">Hypothèse : CAPEX 2026 minimal de 300 k€ pour la nouvelle ligne déjà commandée. Le scénario exclut prix d’acquisition, dette d’acquisition, dividendes, coûts de transaction et fiscalité de la holding.</p></Card></div>;
}

function Valuation(){
  const [multiple,setMultiple]=useState(5.5),[basis,setBasis]=useState<'bnb'|'reconciled'|'seller'>('reconciled');
  const bases={bnb:1084434,reconciled:1167396,seller:1170936},labels={bnb:'EBITDA BNB',reconciled:'EBITDA ajusté recalé BNB',seller:'EBITDA corrigé vendeur'},selected=bases[basis],valuation=europlantesValuation(selected,multiple,730442,1030000);
  return <div className="smiling-stack"><Card><div className="profit-loss-heading compact"><div><p className="eyebrow">Matrice indicative</p><h2>Paramètres de valorisation</h2><p>L’immobilier est ajouté séparément car les EBITDA corrigés intègrent un loyer théorique.</p></div></div><div className="europlantes-valuation-controls"><label>Base EBITDA<select value={basis} onChange={event=>setBasis(event.target.value as typeof basis)}><option value="bnb">EBITDA BNB — 1,084 M€</option><option value="reconciled">Ajusté recalé BNB — 1,167 M€</option><option value="seller">Corrigé vendeur — 1,171 M€</option></select></label><label>Multiple<span><input type="number" step="0.1" value={multiple} onChange={event=>setMultiple(Number(event.target.value))}/>×</span></label></div></Card><div className="smiling-kpis valuation"><Card><span>{labels[basis]}</span><strong>{euro(selected)}</strong><small>base sélectionnée</small></Card><Card><span>Valeur opérationnelle</span><strong>{euro(valuation.operatingEnterpriseValue)}</strong><small>{multiple.toFixed(1)}× EBITDA</small></Card><Card><span>Immobilier</span><strong>1,03 M€</strong><small>expertise janvier 2024</small></Card><Card><span>Valeur des titres EPL</span><strong>{euro(valuation.equityValue)}</strong><small>+ trésorerie nette 730 k€</small></Card></div><Card className="profit-loss"><div className="profit-loss-heading"><div><p className="eyebrow">Sensibilité</p><h2>Valeur indicative des titres Europlantes</h2><p>EBITDA × multiple + immobilier + trésorerie nette indicative.</p></div></div><div className="report-table"><table className="report-matrix"><thead><tr><th>Multiple</th><th>Valeur opérationnelle</th><th>+ Immobilier</th><th>+ Trésorerie nette</th><th>Valeur des titres</th></tr></thead><tbody>{[4,4.5,5,5.5,6,6.5,7].map(item=>{const row=europlantesValuation(selected,item,730442,1030000);return <tr key={item} className={item===multiple?'calculation-row key-calculation':''}><td>{item.toFixed(1)}×</td><td>{amount(row.operatingEnterpriseValue)}</td><td>1 030</td><td>730</td><td>{amount(row.equityValue)}</td></tr>})}</tbody></table></div></Card><Card className="smiling-callout warning"><AlertTriangle/><div><strong>Ce calcul ne valorise pas encore les actions de Flagship.</strong><p>La transaction porte sur Flagship, qui détient Europlantes. Il faut les comptes de la holding, sa dette, sa trésorerie, ses engagements et les conséquences fiscales avant de transformer cette valeur EPL en prix des actions Flagship.</p></div></Card></div>;
}

function Building(){return <div className="smiling-stack"><Card className="europlantes-building-hero"><p className="eyebrow">Cour Lemaire 17 · 4651 Herve/Battice</p><h2>Bâtiment et outil industriel</h2><p>Le site détenu par Europlantes est inclus dans le périmètre. Un bâtiment loué situé en face complète temporairement le stockage et les bureaux.</p></Card><div className="smiling-kpis"><Card><span>Valeur de marché annoncée</span><strong>1,03 M€</strong><small>expertise BNP PRE · janvier 2024</small></Card><Card><span>Terrain</span><strong>4 539 m²</strong><small>zone d’activité économique industrielle</small></Card><Card><span>VNC 2025</span><strong>126 k€</strong><small>terrains et constructions BNB</small></Card><Card><span>Nouvelle ligne</span><strong>300 k€</strong><small>commandée pour 2026</small></Card></div><div className="europlantes-building-grid"><Card><Building2/><h3>Site détenu</h3><ul><li>Hall industriel de plain-pied avec bureaux et chambres froides.</li><li>Ossature métallique ; bon état général selon le résumé vendeur.</li><li>Potentiel d’extension à l’arrière du bâtiment.</li><li>Immeuble largement amorti dans les comptes.</li></ul></Card><Card><Building2/><h3>Bâtiment loué</h3><ul><li>Bureaux administratifs.</li><li>Stockage du mobilier de corners et des plantes.</li><li>Occupation depuis fin 2024.</li><li>Solution présentée comme provisoire avant une stratégie logistique.</li></ul></Card><Card><Scale/><h3>Points de due diligence</h3><ul><li>Obtenir l’expertise BNP complète et actualiser la valeur.</li><li>Vérifier titre, urbanisme, sol, conformité incendie et installations frigorifiques.</li><li>Contrôler bail, indexation, charges et durée du bâtiment loué.</li><li>Chiffrer hubs Namur/Arlon, extension et CAPEX de maintien.</li></ul></Card></div><Card className="smiling-callout warning"><AlertTriangle/><div><strong>La valeur de 1,03 M€ n’est pas vérifiée dans les pièces reçues.</strong><p>Seul le résumé du mémorandum est disponible. L’expertise immobilière complète, les plans, certificats, contrôles techniques et informations environnementales restent à obtenir.</p></div></Card></div>}

function Sources(){const filings=[['2022','2023-00280233','25/07/2023'],['2023','2024-00069196','25/04/2024'],['2024','2025-00321092','29/07/2025'],['2025','2026-00148111','05/06/2026']];return <div className="smiling-stack"><Card><p className="eyebrow">Sources primaires</p><h2>Comptes annuels BNB</h2><div className="smiling-sources">{filings.map(([year,id,date])=><div key={id}><FileText/><span><strong>Exercice {year}</strong><small>Dépôt {id} · {date} · schéma abrégé</small></span></div>)}</div></Card><Card><p className="eyebrow">Source vendeur</p><h3>Mémorandum d’information — septembre 2026</h3><p>Utilisé pour le CA, le détail du compte de résultat 2023–2025, le réseau, l’exploitation, l’immobilier, les projections 2026 et les retraitements. Les divergences avec la BNB sont exposées, pas écrasées.</p></Card><Card><p className="eyebrow">Sources externes</p><h3>Marché et concurrents</h3><div className="europlantes-source-links"><a href="https://www.fiorelli.be/fr" target="_blank" rel="noreferrer">Fiorelli</a><a href="https://www.carryflor.be/nl/over-ons" target="_blank" rel="noreferrer">Carry Flor</a><a href="https://www.agreflor.com/" target="_blank" rel="noreferrer">Agreflor</a><a href="https://www.vlaanderen.be/vlam/bloemen-planten" target="_blank" rel="noreferrer">VLAM — fleurs et plantes</a></div></Card><Card className="smiling-callout warning"><AlertTriangle/><div><strong>Hiérarchie des sources.</strong><p>BNB pour les agrégats statutaires ; mémorandum pour la granularité absente et les assertions du vendeur ; sources publiques pour le positionnement externe. Une donnée indisponible n’est jamais remplacée par zéro.</p></div></Card></div>}

export function EuroplantesFile(){
  const {me}=useOutletContext<{me:PublicUser}>(),authorised=me.role==='admin'||me.analysisAccess.includes('europlantes');
  const access=useQuery({queryKey:['analysed-file','europlantes'],queryFn:()=>api.analysedFile('europlantes'),enabled:authorised});
  const [tab,setTab]=useState<Tab>('pnl');
  if(!authorised)return <Navigate to="/sans-acces" replace/>;if(access.isLoading)return <div className="state">Vérification de l’accès au dossier…</div>;if(access.error)return <Navigate to="/sans-acces" replace/>;
  const tabs:Array<[Tab,string]>=[['pnl','Compte de résultat'],['balance','Bilan'],['bfr','BFR'],['plan','Business plan'],['valuation','Valorisation'],['building','Bâtiment'],['adjustments','Retraitements vendeur'],['analysis','Analyse du dossier'],['sources','Sources']];
  return <div className="smiling-baker-file europlantes-file"><PageHeader title="Europlantes"><p className="breadcrumb">Dossiers analysés / Europlantes</p></PageHeader><div className="tabs" role="tablist">{tabs.map(([key,label])=><button key={key} className={tab===key?'analysis-tab active':'analysis-tab'} onClick={()=>setTab(key)}>{label}</button>)}</div>{tab==='pnl'?<ProfitLoss/>:tab==='balance'?<Balance/>:tab==='bfr'?<Bfr/>:tab==='plan'?<BusinessPlan/>:tab==='valuation'?<Valuation/>:tab==='building'?<Building/>:tab==='adjustments'?<SellerAdjustments/>:tab==='analysis'?<EuroplantesDossierAnalysis/>:<Sources/>}</div>;
}
