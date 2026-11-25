import { neonSql } from '../src/store.ts';
try {
  if (process.env.DELIVERY_ENABLED !== 'false') throw new Error('Keep delivery disabled while reconciling deployment probes.');
  const sql = neonSql(process.env.DATABASE_URL);
  const rows = await sql(`DELETE FROM orvanta_workflow.enquiries
    WHERE call_id LIKE 'call_synthetic_deploy_%' AND event_type='call_analyzed'
      AND fields->>'customer_name'='Synthetic deployment probe'
      AND fields->>'cleaning_notes'='Delivery disabled; remove this synthetic probe after verification.'
      AND accepted_at > now() - interval '2 hours' RETURNING id`);
  console.log(JSON.stringify({ syntheticDeploymentProbesRemoved: rows.length, privateRecordsPrinted: false }));
} catch (error) {
  const sqlState = /^[0-9A-Z]{5}$/.test(error.code || '') ? error.code : null;
  const cause = error.sourceError || error.cause;
  const allowed = ['ENOTFOUND', 'ETIMEDOUT', 'ENETUNREACH', 'EAI_AGAIN', 'ECONNRESET'];
  const transportCode = allowed.includes(cause?.cause?.code) ? cause.cause.code : allowed.includes(cause?.code) ? cause.code : null;
  console.error(JSON.stringify({ syntheticCleanupIncomplete: true, sqlState, transportCode }));
  process.exitCode = 1;
}
