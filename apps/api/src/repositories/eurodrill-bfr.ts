import type { Sql } from 'postgres';
import type { BfrSection, Company, DashboardDefinition } from '@equinoxe/shared';

export function prepareEurodrillBfr(companies: Company[], sections: BfrSection[], dashboards: DashboardDefinition[]) {
  const company = companies.find(row => row.slug === 'eurodrill');
  const gimi = companies.find(row => row.slug === 'gimi');
  const template = sections.filter(row => row.companyId === gimi?.id).sort((a, b) => a.order - b.order);
  if (!company || !gimi || !template.length) throw new Error('Sociétés ou configuration BFR Gimi absentes.');
  const now = new Date().toISOString();
  const additions = sections.some(row => row.companyId === company.id) ? [] : template.map(row => ({ ...structuredClone(row), id: crypto.randomUUID(), companyId: company.id, createdAt: now, updatedAt: now }));
  const boards: DashboardDefinition[] = dashboards.some(row => row.companyId === company.id && row.slug === 'bfr') ? [] : [{ id: crypto.randomUUID(), companyId: company.id, slug: 'bfr', label: 'BFR', status: 'active', order: Math.max(0, ...dashboards.filter(row => row.companyId === company.id).map(row => row.order)) + 1 }];
  return { companyId: company.id, sections: [...sections, ...additions], dashboards: [...dashboards, ...boards], addedSections: additions.length, addedDashboards: boards.length };
}

/** Explicit configuration operation, never called at startup. Odoo is not accessed. */
export async function addEurodrillBfr(sql: Sql) {
  return sql.begin(async tx => {
    const rows = await tx`SELECT key,data FROM equinoxe_documents WHERE key IN ('companies.json','bfr-sections.json','dashboards.json') ORDER BY key FOR UPDATE`;
    if (rows.length !== 3) throw new Error('Documents BFR absents.');
    const before = Object.fromEntries(rows.map(row => [row.key, row.data]));
    const result = prepareEurodrillBfr(before['companies.json'], before['bfr-sections.json'], before['dashboards.json']);
    let archiveKey: string | null = null;
    if (result.addedSections || result.addedDashboards) {
      archiveKey = `configuration-archive:eurodrill-bfr:${crypto.randomUUID()}`;
      await tx`INSERT INTO equinoxe_documents (key,data) VALUES (${archiveKey},${tx.json({ operation: 'add-eurodrill-bfr', at: new Date().toISOString(), before } as never)})`;
      if (result.addedSections) await tx`UPDATE equinoxe_documents SET data=${tx.json(result.sections as never)},updated_at=now() WHERE key='bfr-sections.json'`;
      if (result.addedDashboards) await tx`UPDATE equinoxe_documents SET data=${tx.json(result.dashboards as never)},updated_at=now() WHERE key='dashboards.json'`;
    }
    return { companyId: result.companyId, addedSections: result.addedSections, addedDashboards: result.addedDashboards, archiveKey };
  });
}
