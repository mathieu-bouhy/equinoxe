import { describe, expect, test } from 'bun:test';
import type { AccountAnalyticAllocation, ProfitLossSection } from '@equinoxe/shared';
import { accountSection, sortAccountAllocations, suggestAccountDepartment, suggestEmployeeDepartment } from '../services/analytic-allocation';

describe('Première répartition Gimi', () => {
  test('distingue maintenance et installation incendie, LED et intrusion', () => {
    expect(suggestAccountDepartment('700007', 'CONTRAT MAINTENANCE INCENDIE')).toBe('fireMaintenance');
    expect(suggestAccountDepartment('700001', 'INSTAL & MES INCENDIE')).toBe('fireInstallation');
    expect(suggestAccountDepartment('600101', 'RÉPARATION MATÉRIEL INCENDIE')).toBe('fireMaintenance');
    expect(suggestAccountDepartment('717000', 'VAR STOCKS TRAVAUX EN COURS INCENDIE')).toBe('fireInstallation');
    expect(suggestAccountDepartment('600840', 'ACHATS LED (JM)')).toBe('led');
    expect(suggestAccountDepartment('609411', 'VARIATION STOCK INTRUSION')).toBe('intrusion');
  });
  test('ne force pas les comptes ambigus ni les autres charges', () => {
    expect(suggestAccountDepartment('700000', 'VENTES')).toBeNull();
    expect(suggestAccountDepartment('700001', 'INCENDIE ET INTRUSION')).toBeNull();
    expect(suggestAccountDepartment('600600', 'MATERIEL CAMERA')).toBeNull();
    expect(suggestAccountDepartment('603000', 'SOUS-TRAITANCES INCENDIE')).toBeNull();
    expect(suggestAccountDepartment('610000', 'LOYER LED')).toBeNull();
  });
  test('applique les fonctions demandées sans inventer les fonctions manquantes', () => {
    expect(suggestEmployeeDepartment('Manager SAV')).toBe('fireMaintenance');
    expect(suggestEmployeeDepartment('Technico-commercial')).toBe('fireInstallation');
    expect(suggestEmployeeDepartment('Électricien')).toBe('fireInstallation');
    expect(suggestEmployeeDepartment('Commercial LED')).toBe('led');
    expect(suggestEmployeeDepartment(null)).toBeNull();
    expect(suggestEmployeeDepartment('HR & Admin Manager')).toBeNull();
  });
});

describe('Ordre des rubriques', () => {
  const sections = [
    {id: 'sales', kind: 'accounts', order: 0, prefixes: ['70', '71']},
    {id: 'goods', kind: 'accounts', order: 1, prefixes: ['60']},
    {id: 'subcontract', kind: 'accounts', order: 3, prefixes: ['603']},
  ] as ProfitLossSection[];
  test('retient le préfixe le plus précis', () => {
    expect(accountSection('603000', sections)?.id).toBe('subcontract');
    expect(accountSection('600100', sections)?.id).toBe('goods');
    expect(accountSection('799999', sections)).toBeUndefined();
  });
  test('ventes avant achats, codes croissants, non classés à la fin, ordre configurable', () => {
    const rows = [
      {accountCode: '600100', profitLossSectionId: 'goods'},
      {accountCode: '610000', profitLossSectionId: null},
      {accountCode: '700007', profitLossSectionId: 'sales'},
      {accountCode: '700001', profitLossSectionId: 'sales'},
    ] as AccountAnalyticAllocation[];
    expect(sortAccountAllocations(rows, sections).map(row => row.accountCode)).toEqual(['700001', '700007', '600100', '610000']);
    expect(rows[0]?.accountCode).toBe('600100');
    expect(sortAccountAllocations(rows, sections.map(section => ({...section, order: section.id === 'goods' ? -1 : section.order})))[0]?.accountCode).toBe('600100');
  });
});
