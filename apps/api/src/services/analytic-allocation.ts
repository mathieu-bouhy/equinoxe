import type { AccountAnalyticAllocation, ProfitLossSection } from '@equinoxe/shared';

export type Department = 'fireMaintenance' | 'fireInstallation' | 'led' | 'intrusion';
export const departmentLabels: Record<Department, string> = {
  fireMaintenance: 'Incendie maintenance', fireInstallation: 'Incendie installation',
  led: 'LED', intrusion: 'Intrusion',
};
export const normalizeAllocationLabel = (label: string) => label.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function accountSection(code: string, sections: ProfitLossSection[]) {
  return sections.filter(section => section.kind === 'accounts')
    .flatMap(section => section.prefixes.filter(prefix => code.startsWith(prefix)).map(prefix => ({section, length: prefix.length})))
    .sort((a, b) => b.length - a.length || a.section.order - b.section.order)[0]?.section;
}

export function sortAccountAllocations(rows: AccountAnalyticAllocation[], sections: ProfitLossSection[]) {
  const order = new Map(sections.map(section => [section.id, section.order]));
  return [...rows].sort((a, b) =>
    (order.get(a.profitLossSectionId ?? '') ?? Number.MAX_SAFE_INTEGER) -
    (order.get(b.profitLossSectionId ?? '') ?? Number.MAX_SAFE_INTEGER) ||
    (a.profitLossSectionId ?? '').localeCompare(b.profitLossSectionId ?? '') ||
    a.accountCode.localeCompare(b.accountCode, 'fr-BE', {numeric: true}));
}

/** Suggestions initiales uniquement : jamais exécutées au démarrage ou à la lecture. */
export function suggestAccountDepartment(code: string, label: string): Department | null {
  if (!/^(60|70|71)/.test(code) || code.startsWith('603')) return null;
  const text = normalizeAllocationLabel(label);
  const led = /\bled\b/.test(text), intrusion = /\bintrusion\b/.test(text);
  const fire = /\b(incendie|extincteurs?|devidoirs?)\b/.test(text);
  // Un compte qui mentionne plusieurs métiers nécessite un choix humain.
  if (Number(led) + Number(intrusion) + Number(fire) !== 1) return null;
  if (led) return 'led';
  if (intrusion) return 'intrusion';
  return /\b(contrat|maintenance|entretien|depannage|reparation|location)\b/.test(text)
    ? 'fireMaintenance' : 'fireInstallation';
}

export function suggestEmployeeDepartment(role: string | null): Department | null {
  const text = normalizeAllocationLabel(role ?? '');
  if (text === 'manager sav' || text === 'technicien') return 'fireMaintenance';
  if (/\btechnico commercial\b/.test(text) || /\belectricien(ne)?s?\b/.test(text)) return 'fireInstallation';
  if (text === 'commercial led') return 'led';
  return null;
}
