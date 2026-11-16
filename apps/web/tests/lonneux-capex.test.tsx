import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import type {LonneuxCapexReport} from '@equinoxe/shared';
import {LonneuxCapexContent} from '../src/pages/LonneuxCapex';

const report:LonneuxCapexReport={
 years:[2024,2025],generatedAt:'2026-11-16T12:00:00.000Z',sourceFiles:['LONNEUXM - Analyses financières.xlsx'],
 warnings:['2024 : ouverture 2023 manquante.','2025 : soldes annuels uniquement.'],
 scope:'Comptes historiques 20 à 27. Les soldes ne prouvent ni acquisitions brutes, ni cessions, ni paiements.',
 periods:[
  {year:2024,through:'2024-12-31',status:'available',gross:1000,accumulated:400,net:600,depreciation:100,grossChange:null,accumulatedChange:null,netChange:null,otherAccumulatedImpact:null,bridgeDifference:null},
  {year:2025,through:'2025-12-31',status:'available',gross:1100,accumulated:450,net:650,depreciation:80,grossChange:100,accumulatedChange:50,netChange:50,otherAccumulatedImpact:30,bridgeDifference:0},
 ],
 categories:[{key:'building',label:'Terrains et bâtiments',gross:{2024:1000,2025:1100},accumulated:{2024:400,2025:450},net:{2024:600,2025:650}}],
 accounts:[{code:'221000',label:'Bâtiment',category:'building',kind:'gross',values:{2024:1000,2025:1100},sourceFile:'LONNEUXM - Analyses financières.xlsx'},{code:'221900',label:'Amortissements bâtiment',category:'building',kind:'accumulated',values:{2024:-400,2025:-450},sourceFile:'LONNEUXM - Analyses financières.xlsx'}],
};

test('CAPEX Lonneux : historique 2024–2025, acquisitions absentes et pont VNC explicite',()=>{
 const html=renderToStaticMarkup(<LonneuxCapexContent report={report}/>);
 expect(html).toContain('LONNEUX · CAPEX HISTORIQUE');expect(html).toContain('Acquisitions documentées');expect(html).toContain('journal historique');
 expect(html).toContain('Variation brute des soldes');expect(html).toContain('Autres variations des amortissements');expect(html).toContain('Export');
 expect(html).toContain('ne certifie un paiement');expect(html).not.toContain('Registre des actifs');expect(html).not.toContain('Odoo · écritures validées');
});

test('CAPEX Lonneux : comptes et source historique consultables',()=>{
 const html=renderToStaticMarkup(<LonneuxCapexContent report={report}/>);
 expect(html).toContain('221000');expect(html).toContain('Bâtiment');expect(html).toContain('LONNEUXM - Analyses financières.xlsx');expect(html).toContain('31/12/2025');
});
