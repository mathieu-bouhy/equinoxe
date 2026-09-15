import postgres from 'postgres';
import { config } from '../src/config';
import { addEurodrillBfr } from '../src/repositories/eurodrill-bfr';

if (!config.databaseUrl) throw new Error('PostgreSQL requis.');
const sql = postgres(config.databaseUrl, { max: 1, ssl: 'require' });
try { console.log(JSON.stringify(await addEurodrillBfr(sql))); }
catch { console.error('Ajout de la configuration BFR Eurodrill échoué.'); process.exitCode = 1; }
finally { await sql.end(); }
