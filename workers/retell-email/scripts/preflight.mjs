import { neonSql } from '../src/store.ts';
import { loadConfig } from '../src/config.ts';
import { verifyAgentAccess } from './retell-access.mjs';
import { verifySender } from './sender-access.mjs';

export async function preflight(env = process.env) {
  loadConfig(env);
  for (const key of ['DATABASE_URL', 'RESEND_API_KEY', 'PROCESSING_TOKEN']) {
    if (!env[key] || /replace|YOUR-|USER:PASSWORD/.test(env[key])) throw new Error(`Configure ${key} privately in .env.local.`);
  }
  if (env.PROCESSING_TOKEN.length < 32) throw new Error('PROCESSING_TOKEN must have at least 32 characters.');
  const sql = neonSql(env.DATABASE_URL);
  const [schema] = await sql("SELECT to_regclass('orvanta_workflow.notification_outbox') IS NOT NULL AS ready");
  if (!schema.ready) throw new Error('Run npm run migrate first.');
  await verifyAgentAccess(env);
  await verifySender(env);
  return { database: 'schema_present', agents: 'allowed_agents_accessible', sender: 'verified', operational: false };
}

if (import.meta.url === new URL(process.argv[1], 'file:').href) {
  try { console.log(JSON.stringify(await preflight())); }
  catch { console.error('Preflight failed. Check private configuration, migrations, workspace agent access and sender verification; no deployment was attempted.'); process.exitCode = 1; }
}
