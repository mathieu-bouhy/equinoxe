import {expect,test} from 'bun:test';
import {buildGimiCapex} from '../services/gimi-capex';
import type {FixedAssetLedger,FixedAssetEntry,FixedAssetMove} from '../connectors/odoo-fixed-assets';
import type {BalanceReport} from '@equinoxe/shared';
function fixture(){
 const accounts=[{id:1,code:'211300',name:'Logiciels'},{id:2,code:'211390',name:'Amortissements logiciels'},{id:3,code:'630100',name:'Dotation amortissements'}];
 const move=(id:number,move_type='entry',ref:string|false=false):FixedAssetMove=>({id,date:'2025-06-30',name:`OD/${id}`,ref,move_type,asset_id:false,asset_move_type:false as never,depreciation_value:0});
 const row=(id:number,moveId:number,accountId:number,debit:number,credit=0):FixedAssetEntry=>({id,date:'2025-06-30',name:`Ligne ${id}`,account_id:[accountId,accounts.find(a=>a.id===accountId)!.name],move_id:[moveId,`OD/${moveId}`],debit,credit});
 const assets=[{id:101,name:'Nouveau logiciel',state:'draft',account_asset_id:[1,'Logiciels'],account_depreciation_id:[2,'Amortissements'],original_value:200,acquisition_date:'2025-06-30',disposal_date:false,original_move_line_ids:[1],already_depreciated_amount_import:0,salvage_value:0},{id:102,name:'Développement',state:'open',account_asset_id:[1,'Logiciels'],account_depreciation_id:[2,'Amortissements'],original_value:100,acquisition_date:'2025-06-30',disposal_date:false,original_move_line_ids:[],already_depreciated_amount_import:0,salvage_value:0}];
 const ledger:FixedAssetLedger={from:'2025-01-01',through:'2025-12-31',accounts,assets:assets as FixedAssetLedger['assets'],moves:[move(1,'in_invoice'),move(2),move(3),move(4),move(5),move(6),move(7,'entry','Extourne de : OD/6')],entries:[row(1,1,1,200),row(2,2,1,100),{...row(3,3,1,0,150),name:'Vente ancien logiciel'},row(4,3,2,60),row(5,4,3,80),row(6,4,2,0,80),row(7,5,1,50),row(8,5,2,0,20),{...row(9,6,1,0,20),name:'Cession provisoire'},row(10,6,2,8),row(11,7,1,20),row(12,7,2,0,8)],baseUrl:'https://odoo.example.test'};
 const balance={assets:[{accounts:[{id:'1',code:'211300',label:'Logiciels',values:{'2024':1000,'2025':1200}},{id:'2',code:'211390',label:'Amortissements',values:{'2024':-400,'2025':-440}}]}]} as unknown as BalanceReport;
 return {ledger,balance};
}
test('acquisitions, sorties et extournes : pas de doubles investissements ni de faux décaissements',()=>{
 const {ledger,balance}=fixture(),r=buildGimiCapex(ledger,balance,[2025]),p=r.periods[0];
 expect(p).toMatchObject({acquisitions:300,disposals:150,amortization:80,otherGross:50,otherAmortization:-40,openingNet:600,closingNet:760,grossDifference:0,netDifference:0});
 expect(p.movements.some(m=>['9','11'].includes(m.id))).toBe(false);expect(p.categories[0].amortization).toBe(80);expect(r.warnings.join(' ')).toContain('BNB');
 expect(p.openingNet+p.acquisitions-p.disposals-p.amortization+p.otherGross-p.otherAmortization).toBe(p.closingNet);
});
test('fiche en brouillon avec facture validée incluse, état et provenance visibles',()=>{
 const {ledger,balance}=fixture(),r=buildGimiCapex(ledger,balance,[2025]);expect(r.assets[0]).toMatchObject({state:'draft',invoicePosted:true,originalValue:200});expect(r.periods[0].acquisitions).toBe(300);expect(r.assets[0].url).toContain('model=account.asset');
});
test('écart avec le bilan conservé, jamais absorbé par autres mouvements',()=>{
 const {ledger,balance}=fixture();balance.assets[0].accounts[0].values['2025']+=17;const p=buildGimiCapex(ledger,balance,[2025]);expect(p.periods[0].netDifference).toBe(17);expect(p.periods[0].otherGross).toBe(50);expect(p.warnings.join(' ')).toContain('rapprochement');
});
test('nouvelle OD sans preuve de capitalisation : autres mouvements, pas acquisition inventée',()=>{
 const {ledger,balance}=fixture();ledger.assets=ledger.assets.filter(a=>a.id!==102);const p=buildGimiCapex(ledger,balance,[2025]).periods[0];expect(p.acquisitions).toBe(200);expect(p.otherGross).toBe(150);
});
test('les périodes et les mois sont bornés ; aucune valeur de fiche actuelle ne devient une VNC historique',()=>{
 const {ledger,balance}=fixture();ledger.through='2025-05-31';const p=buildGimiCapex(ledger,balance,[2025]).periods[0];expect(p.monthly).toHaveLength(5);expect(p.acquisitions).toBe(0);expect(p.closingNet).toBe(760);expect(p.netDifference).not.toBe(0);
});
