import { neon } from '@neondatabase/serverless';
import fs from 'node:fs/promises';
import { neonSql } from '../src/store.ts';

try {
  neonSql(process.env.DATABASE_URL); // Validate Neon host without printing URL.
  const sql = neon(process.env.DATABASE_URL);
  const directory = new URL('../migrations/', import.meta.url);
  for (const file of (await fs.readdir(directory)).filter(name => name.endsWith('.sql')).sort()) {
    const source = await fs.readFile(new URL(file, directory), 'utf8');
    const statements = source.split('-- statement-breakpoint').map(value => value.trim()).filter(Boolean);
    await sql.transaction([
      sql`SELECT pg_advisory_xact_lock(884419015)`,
      ...statements.map(statement => sql.query(statement)),
      sql`INSERT INTO orvanta_workflow.schema_migrations(name) VALUES (${file}) ON CONFLICT DO NOTHING`,
    ], { fetchOptions: { signal: AbortSignal.timeout(30_000) } });
    console.log(`Applied ${file}`);
  }
} catch { console.error('Migration failed. Check the private Neon connection and migration privileges. No connection string or query parameters are logged.'); process.exitCode = 1; }
