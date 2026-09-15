import type { Company } from '@equinoxe/shared';
import { config } from '../config';
import { OdooConnector } from './odoo';

/** Explicit selection: an unknown company must never use Gimi's credentials. */
export function companyOdooResolver(gimi = new OdooConnector(config.odoo.gimi), fetcher: typeof fetch = fetch) {
  const connectors = new Map([
    ['gimi', gimi],
    ['lonneux', new OdooConnector(config.odoo.lonneux, fetcher)],
    ['eurodrill', new OdooConnector(config.odoo.eurodrill, fetcher)],
  ]);
  const unavailable = new OdooConnector({ baseUrl: undefined, database: undefined, username: undefined, apiKey: undefined, timeoutMs: 15000, retries: 0 }, fetcher);
  return (company: Company): OdooConnector => {
    const connector = company.connectorType === 'odoo' ? connectors.get(company.slug) : undefined;
    return connector ?? unavailable;
  };
}
