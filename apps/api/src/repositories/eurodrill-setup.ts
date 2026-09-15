import type { Sql } from 'postgres';
import { prepareEurodrill, type ReportingDocuments } from '../services/eurodrill-setup';

export const reportingKeys = { companies: 'companies.json', dashboards: 'dashboards.json', sections: 'profit-loss-sections.json', settings: 'report-settings.json' } as const;

/** Configuration writes target Equinoxe only; this module has no Odoo client. */
export async function stageEurodrill(sql: Sql, lastClosedMonth: string) {
  return sql.begin(async transaction => {
    const rows = await transaction<{ key: string; data: unknown }[]>`
      SELECT key, data FROM equinoxe_documents WHERE key IN ${transaction(Object.values(reportingKeys))} ORDER BY key FOR UPDATE
    `;
    if (rows.length !== Object.keys(reportingKeys).length) throw new Error('Documents Equinoxe manquants : aucune initialisation implicite autorisée.');
    const before = Object.fromEntries(rows.map(row => [row.key, row.data]));
    const documents = Object.fromEntries(Object.entries(reportingKeys).map(([field, key]) => [field, before[key]])) as ReportingDocuments;
    const result = prepareEurodrill(documents, lastClosedMonth);
    if (!result.created) return { company: result.company, created: false, archiveKey: null };
    const archiveKey = `configuration-archive:eurodrill:${result.company.id}`;
    await transaction`INSERT INTO equinoxe_documents (key, data) VALUES (${archiveKey}, ${transaction.json({ operation: 'prepare-eurodrill-inactive', createdAt: result.company.createdAt, before } as never)})`;
    for (const [field, key] of Object.entries(reportingKeys)) {
      await transaction`UPDATE equinoxe_documents SET data = ${transaction.json(result.documents[field as keyof ReportingDocuments] as never)}, updated_at = NOW() WHERE key = ${key}`;
    }
    return { company: result.company, created: true, archiveKey };
  });
}
