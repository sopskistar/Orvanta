import { createHmac } from 'node:crypto';
import { neonSql } from '../src/store.ts';
import { loadConfig } from '../src/config.ts';

const checks = [];
const callId = 'call_synthetic_deploy_' + crypto.randomUUID().replaceAll('-', '');
let sql;
let cleanupRequired = false;
let stage = 'health';
try {
  const url = new URL(process.env.WORKER_URL);
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.workers.dev') || url.pathname !== '/') throw new Error('worker_url_invalid');
  const origin = url.origin;
  const config = loadConfig(process.env);
  const agentId = [...config.routes.keys()][0];
  const headers = { 'User-Agent': 'Orvanta-workflow-verification/1.0 (+https://getorvanta.xyz)' };
  const request = (route, options = {}) => fetch(origin + route, { ...options, headers: { ...headers, ...options.headers }, signal: AbortSignal.timeout(20_000) });
  const check = (name, value) => { if (!value) throw new Error(name); checks.push(name); console.log('PASS ' + name); };
  const health = await request('/health');
  check('deployed_worker_health', health.status === 200 && (await health.json()).code === 'worker_running_not_delivery_evidence');
  const invalid = await request('/webhooks/retell', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json', 'x-retell-signature': 'invalid' } });
  check('invalid_signature_rejected', invalid.status === 401);
  // Run only after Cloudflare's deployed binding was independently checked false.
  const admin = await request('/admin/process', { method: 'POST', headers: { Authorization: `Bearer ${process.env.PROCESSING_TOKEN}` } });
  check('authenticated_processing_disabled', admin.status === 409 && (await admin.json()).code === 'delivery_disabled');
  const signedRequest = (payload) => {
    const raw = JSON.stringify(payload), timestamp = Date.now();
    return request('/webhooks/retell', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-retell-signature': `v=${timestamp},d=${createHmac('sha256', process.env.RETELL_API_KEY).update(raw + timestamp).digest('hex')}` }, body: raw });
  };
  stage = 'signed_event_authentication';
  const ignored = await signedRequest({ event: 'call_ended', call: { call_id: callId, agent_id: agentId } });
  check('signed_ignored_event_authenticated', ignored.status === 204);
  const unknown = await signedRequest({ event: 'call_analyzed', call: { call_id: callId, agent_id: 'agent_synthetic_unknown_probe' } });
  check('signed_unknown_agent_rejected', unknown.status === 403 && (await unknown.json()).code === 'agent_not_allowed');
  const payload = { event: 'call_analyzed', call: { call_id: callId, agent_id: agentId, call_analysis: { custom_analysis_data: {
    customer_name: 'Synthetic deployment probe', callback_number: '+1 202-555-0143', service_requested: 'Synthetic test only', zip_code: '02108',
    property_details: null, preferred_date: null, cleaning_notes: 'Delivery disabled; remove this synthetic probe after verification.', callback_preference: null, follow_up_needed: null,
  } } } };
  const raw = JSON.stringify(payload), timestamp = Date.now();
  const signature = `v=${timestamp},d=${createHmac('sha256', process.env.RETELL_API_KEY).update(raw + timestamp).digest('hex')}`;
  const post = () => request('/webhooks/retell', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-retell-signature': signature }, body: raw });
  sql = neonSql(process.env.DATABASE_URL);
  cleanupRequired = true;
  stage = 'durable_webhook_acceptance';
  const responses = await Promise.all([post(), post()]);
  console.log(JSON.stringify({ syntheticWebhookHttpStatuses: responses.map(response => response.status) }));
  check('concurrent_signed_webhooks_durably_accepted', responses.every(response => response.status === 204));
  stage = 'stored_synthetic_record';
  const stored = await sql(`SELECT e.fields, n.state, n.provider_message_id, n.provider_accepted_at, n.payload
    FROM orvanta_workflow.enquiries e JOIN orvanta_workflow.notification_outbox n ON n.enquiry_id = e.id
    WHERE e.event_type = 'call_analyzed' AND e.call_id = $1`, [callId]);
  check('single_enquiry_and_outbox_for_duplicate_event', stored.length === 1);
  const row = stored[0];
  check('captured_strings_and_missing_values_preserved', row.fields.zip_code === '02108' && row.fields.callback_number === '+1 202-555-0143' && row.fields.preferred_date === null && row.fields.callback_preference === null);
  check('notification_pending_without_provider_send', row.state === 'pending' && row.provider_message_id === null && row.provider_accepted_at === null);
  check('notification_recipient_restricted', row.payload.to.length === 1 && row.payload.to[0] === 'julianahonour@gmail.com');
  console.log(JSON.stringify({ verifiedWebhookUrl: origin + '/webhooks/retell', deliveryDisabled: true, checksPassed: checks.length, operational: false }));
} catch (error) {
  const code = /^[a-z_]+$/.test(error.message || '') ? error.message : 'network_or_database_error';
  console.error(JSON.stringify({ verificationIncompleteAt: stage, code, secretValuesPrinted: false }));
  process.exitCode = 1;
} finally {
  if (sql && cleanupRequired) {
    try {
      await sql("DELETE FROM orvanta_workflow.enquiries WHERE event_type='call_analyzed' AND call_id=$1", [callId]);
      console.log('Removed only the generated synthetic deployment probe and its cascading outbox/attempt records.');
    } catch { console.error('Synthetic probe cleanup incomplete; keep delivery disabled until this probe is reconciled.'); process.exitCode = 1; }
  }
}
