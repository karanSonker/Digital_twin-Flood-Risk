import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;

export const hasDatabase = () => Boolean(connectionString);

export const pool = connectionString
  ? new Pool({ connectionString })
  : ({
      async query() {
        return { rows: [], rowCount: 0 };
      },
      async end() {
        return undefined;
      },
    } as unknown as Pool);