import { resolve } from 'node:path';
const number = (value:string|undefined, fallback:number) => { const parsed=Number(value); return Number.isFinite(parsed)&&parsed>0 ? parsed : fallback; };
const odooConnection=(prefix:'GIMI'|'LONNEUX')=>({baseUrl:process.env[`${prefix}_ODOO_BASE_URL`],database:process.env[`${prefix}_ODOO_DATABASE`],username:process.env[`${prefix}_ODOO_USERNAME`],apiKey:process.env[`${prefix}_ODOO_API_KEY`],timeoutMs:number(process.env.ODOO_RPC_TIMEOUT_MS,15000),retries:number(process.env.ODOO_RPC_RETRIES,1)});
export const config = {
  port:number(process.env.PORT, 3001), origin:process.env.APP_ORIGIN ?? 'http://localhost:5173',
  dataDir:resolve(process.cwd(), process.env.APP_DATA_DIR ?? '../../data'),
  authSecret:process.env.AUTH_SECRET ?? 'development-only-change-me', ttlHours:number(process.env.AUTH_TOKEN_TTL_HOURS,24),
  secureCookies:process.env.COOKIE_SECURE === 'true',
  admin:{email:(process.env.EQUINOXE_ADMIN_EMAIL ?? 'admin@equinoxe.local').toLowerCase(),password:process.env.EQUINOXE_ADMIN_PASSWORD ?? 'change-me-now',name:process.env.EQUINOXE_ADMIN_NAME ?? 'Administrateur Equinoxe'},
  odoo:{gimi:odooConnection('GIMI'),lonneux:odooConnection('LONNEUX')}
};
export type OdooConnection = typeof config.odoo.gimi;
