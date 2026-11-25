import { neonSql } from '../src/store.ts';
try {
  const sql = neonSql(process.env.DATABASE_URL);
  const [result] = await sql('SELECT 1 AS connected');
  if (result.connected !== 1) throw new Error('unexpected_response');
  console.log('Neon connection verified. No connection string or password was printed.');
  if (process.argv.includes('--schema')) {
    const tables = await sql("SELECT table_name FROM information_schema.tables WHERE table_schema='orvanta_workflow' AND table_type='BASE TABLE'");
    const names = new Set(tables.map(row => row.table_name));
    const expected = ['enquiries', 'notification_outbox', 'notification_attempts', 'schema_migrations'];
    if (!expected.every(name => names.has(name))) throw new Error('workflow_tables_missing');
    const constraints = await sql("SELECT contype, pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('orvanta_workflow.enquiries'::regclass,'orvanta_workflow.notification_outbox'::regclass)");
    if (!constraints.some(row => row.contype === 'u' && row.definition === 'UNIQUE (event_type, call_id)')) throw new Error('deduplication_constraint_missing');
    if (!constraints.some(row => row.contype === 'f' && row.definition.includes('REFERENCES orvanta_workflow.enquiries(id)'))) throw new Error('outbox_foreign_key_missing');
    const migration = await sql('SELECT name FROM orvanta_workflow.schema_migrations WHERE name=$1', ['001_enquiries_outbox.sql']);
    if (migration.length !== 1) throw new Error('migration_record_missing');
    console.log('Verified all four workflow tables, event/call deduplication, outbox foreign key and recorded initial migration. No private records were read.');
  }
} catch (error) {
  const sqlState = /^[0-9A-Z]{5}$/.test(error.code || '') ? error.code : null;
  const transportCodes = ['ENOTFOUND', 'ETIMEDOUT', 'ENETUNREACH', 'EAI_AGAIN', 'ECONNRESET', 'EPERM'];
  const cause = error.sourceError || error.cause;
  const transportCode = transportCodes.includes(cause?.cause?.code) ? cause.cause.code : transportCodes.includes(cause?.code) ? cause.code : null;
  const httpStatus = /^Server error \(HTTP status (\d{3})\):/.exec(error.message || '')?.[1] || null;
  const configurationCode = /^(unexpected_response|workflow_tables_missing|deduplication_constraint_missing|outbox_foreign_key_missing|migration_record_missing)$/.test(error.message || '') ? error.message : null;
  console.error(JSON.stringify({ checkFailed: true, sqlState, transportCode, httpStatus, configurationCode }));
  console.error('Neon check incomplete. Credentials, exception messages and private records are not printed.');
  process.exitCode = 1;
}
