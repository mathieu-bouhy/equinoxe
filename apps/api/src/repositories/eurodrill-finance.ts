import type { Sql } from 'postgres';
import type { Company, DashboardDefinition } from '@equinoxe/shared';

/** Add only the two requested dashboards; preserve configuration and status. */
export async function addEurodrillFinance(sql: Sql) {
  return sql.begin(async tx => {
    const companies = await tx<{data: Company[]}[]>`SELECT data FROM equinoxe_documents WHERE key = 'companies.json' FOR UPDATE`;
    const company = companies[0]?.data.find(row => row.slug === 'eurodrill');
    if (!company) throw new Error('Eurodrill introuvable.');
    const documents = await tx<{data: DashboardDefinition[]}[]>`SELECT data FROM equinoxe_documents WHERE key = 'dashboards.json' FOR UPDATE`;
    if (!documents[0]) throw new Error('Registre des tableaux de bord absent.');
    const before = documents[0].data, rows = [...before];
    for (const [slug, label] of [['bilan','Bilan'], ['evolution-tresorerie','Évolution trésorerie']]) {
      if (!rows.some(row => row.companyId === company.id && row.slug === slug)) rows.push({ id: crypto.randomUUID(), companyId: company.id, slug, label, status: 'active', order: Math.max(0,...rows.filter(row=>row.companyId===company.id).map(row=>row.order))+1 });
    }
    if (rows.length !== before.length) {
      await tx`INSERT INTO equinoxe_documents (key,data) VALUES (${`configuration-archive:eurodrill-finance:${crypto.randomUUID()}`},${tx.json({operation:'add-eurodrill-balance-cash',before,at:new Date().toISOString()} as never)})`;
      await tx`UPDATE equinoxe_documents SET data=${tx.json(rows as never)},updated_at=now() WHERE key='dashboards.json'`;
    }
    return { companyId: company.id, added: rows.length-before.length };
  });
}
