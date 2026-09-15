import type { Company, DashboardDefinition, ProfitLossSection, ReportSettings } from '@equinoxe/shared';

export type ReportingDocuments = {
  companies: Company[];
  dashboards: DashboardDefinition[];
  sections: ProfitLossSection[];
  settings: ReportSettings[];
};

/** Explicit, one-time provisioning. Never called during application startup. */
export function prepareEurodrill(source: ReportingDocuments, lastClosedMonth: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(lastClosedMonth)) throw new Error('Mois de clôture invalide.');
  const existing = source.companies.find(company => company.slug === 'eurodrill');
  if (existing) return { documents: source, company: existing, created: false };
  const gimi = source.companies.find(company => company.slug === 'gimi');
  const template = source.sections.filter(section => section.companyId === gimi?.id);
  if (!gimi || !template.length) throw new Error('Configuration du compte de résultat Gimi absente.');
  const now = new Date().toISOString();
  // Keep inactive until every shared server supports the explicit connector.
  const company: Company = { id: crypto.randomUUID(), slug: 'eurodrill', name: 'Eurodrill', connectorType: 'odoo', status: 'inactive', createdAt: now, updatedAt: now };
  const ids = new Map(template.map(section => [section.id, crypto.randomUUID()]));
  const sections = template.map(section => ({
    ...structuredClone(section), id: ids.get(section.id)!, companyId: company.id, createdAt: now, updatedAt: now,
    formula: section.formula.map(term => {
      const sectionId = ids.get(term.sectionId);
      if (!sectionId) throw new Error('Une formule du modèle référence une autre société.');
      return { ...term, sectionId };
    }),
  }));
  // Sector-specific Gimi subsections and analytic assignments are not templates.
  const dashboards: DashboardDefinition[] = [
    ['compte-resultat', 'Compte de résultat'],
    ['compte-resultat-ltm', 'Compte de résultat LTM'],
    ['compte-resultat-extrapole', 'Compte de résultat extrapolé'],
  ].map(([slug, label], order) => ({ id: crypto.randomUUID(), companyId: company.id, slug, label, order, status: 'active' }));
  return { created: true, company, documents: {
    companies: [...source.companies, company], dashboards: [...source.dashboards, ...dashboards],
    sections: [...source.sections, ...sections], settings: [...source.settings, { companyId: company.id, lastClosedMonth, updatedAt: now }],
  } };
}
