import postgres from 'postgres';
import type { ZodType } from 'zod';
import { JsonFile } from './json-file';
import type { Collection } from './collection';

/**
 * Persistance PostgreSQL volontairement générique : chaque collection métier
 * reste pilotée par son repository et est stockée dans un document JSONB validé.
 * Cela permet une migration sans exposer ou modifier les secrets Odoo.
 */
export class PostgresDatabase {
  private readonly sql: ReturnType<typeof postgres>;
  private initialized?: Promise<void>;

  constructor(connectionString: string) {
    this.sql = postgres(connectionString, { max: 10, connect_timeout: 15, idle_timeout: 20 });
  }

  async bootstrap(): Promise<void> {
    this.initialized ??= this.sql`
      CREATE TABLE IF NOT EXISTS equinoxe_documents (
        key TEXT PRIMARY KEY,
        data JSONB NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `.then(() => undefined);
    return this.initialized;
  }

  async read<T>(key: string, schema: ZodType<T[]>, legacy: JsonFile<T>): Promise<T[]> {
    await this.bootstrap();
    const rows = await this.sql<{ data: unknown }[]>`SELECT data FROM equinoxe_documents WHERE key = ${key}`;
    if (rows[0]) return schema.parse(rows[0].data);

    // Première connexion : importer les données JSON de l'environnement courant
    // seulement si PostgreSQL est vide. On ne remplace jamais une donnée centrale.
    const values = await legacy.read();
    await this.write(key, values);
    return values;
  }

  async write<T>(key: string, values: T[]): Promise<void> {
    await this.bootstrap();
    await this.sql`
      INSERT INTO equinoxe_documents (key, data, updated_at)
      VALUES (${key}, ${this.sql.json(values as never)}, NOW())
      ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
    `;
  }
}

export class PostgresFile<T> implements Collection<T> {
  private readonly legacy: JsonFile<T>;

  constructor(database: PostgresDatabase, dir: string, name: string, schema: ZodType<T[]>, seed: () => T[]) {
    this.database = database;
    this.name = name;
    this.schema = schema;
    this.legacy = new JsonFile<T>(dir, name, schema, seed);
  }

  private readonly database: PostgresDatabase;
  private readonly name: string;
  private readonly schema: ZodType<T[]>;

  read(): Promise<T[]> {
    return this.database.read(this.name, this.schema, this.legacy);
  }

  write(values: T[]): Promise<void> {
    return this.database.write(this.name, values);
  }
}
