import postgres from 'postgres';
import { config } from '../src/config';
import { stageEurodrill } from '../src/repositories/eurodrill-setup';

const month = process.argv[2];
if (!config.databaseUrl || !month) throw new Error('DATABASE_URL Equinoxe et mois YYYY-MM requis.');
const url = new URL(config.databaseUrl);
const sql = postgres(config.databaseUrl, { max: 1, ssl: url.searchParams.get('sslmode') === 'require' || url.hostname.endsWith('.render.com') ? 'require' : undefined });
try {
  const result = await stageEurodrill(sql, month);
  const rows = await sql`SELECT data FROM equinoxe_documents WHERE key = 'companies.json'`;
  const saved = rows[0].data.find((company: { id: string }) => company.id === result.company.id);
  if (!saved || saved.status !== result.company.status) throw new Error('Relecture de la société non conforme.');
  console.log(JSON.stringify({ ...result, reloaded: true }));
} catch {
  console.error('Préparation Eurodrill échouée. Aucun détail de connexion affiché.');
  process.exitCode = 1;
} finally {
  await sql.end();
}
