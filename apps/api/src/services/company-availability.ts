import type { Company } from '@equinoxe/shared';

/** Local review of the staged company; never changes its persisted status. */
export function companyAvailable(company: Company, localEurodrill: boolean, production: boolean) {
  return company.status === 'active' || (!production && localEurodrill && company.slug === 'eurodrill' && company.connectorType === 'odoo');
}
