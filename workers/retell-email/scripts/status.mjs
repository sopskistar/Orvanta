import { neonSql } from '../src/store.ts';
import { extractFields } from '../src/payload.ts';
import { ID, INITIAL_RECIPIENT, loadConfig } from '../src/config.ts';

try {
  const callId = process.argv[2];
  if (!callId || !ID.test(callId)) throw new Error('Supply the real web call ID: npm run status -- call_ID');
  const config = loadConfig(process.env);
  const sql = neonSql(process.env.DATABASE_URL);
  const [row] = await sql(`SELECT e.fields, e.agent_id, n.id, n.state, n.attempts,
    n.provider_message_id, n.provider_accepted_at, n.last_error, n.delivery_status
    FROM orvanta_workflow.enquiries e JOIN orvanta_workflow.notification_outbox n ON n.enquiry_id = e.id
    WHERE e.event_type = 'call_analyzed' AND e.call_id = $1`, [callId]);
  if (!row) throw new Error('No durable enquiry/outbox found for this call.');
  const retell = await fetch(`https://api.retellai.com/v2/get-call/${encodeURIComponent(callId)}`, {
    headers: { Authorization: `Bearer ${process.env.RETELL_API_KEY}` }, signal: AbortSignal.timeout(10_000),
  });
  if (!retell.ok) throw new Error('Cannot verify completed Retell extraction.');
  const call = await retell.json();
  const extracted = extractFields(call);
  const matches = Object.keys(extracted).every(key => extracted[key] === row.fields[key]);
  const result = { callId, webCall: call.call_type === 'web_call', extractionPresent: !!call.call_analysis?.custom_analysis_data,
    allowedAgent: config.routes.has(call.agent_id) && call.agent_id === row.agent_id,
    storedFieldsMatch: matches, outboxState: row.state, attempts: row.attempts,
    providerAccepted: !!row.provider_message_id && !!row.provider_accepted_at, providerEvent: null,
    inboxReceiptVerified: false, operational: false };
  if (row.provider_message_id) {
    const response = await fetch(`https://api.resend.com/emails/${encodeURIComponent(row.provider_message_id)}`, {
      headers: { Authorization: `Bearer ${process.env.RESEND_SETUP_API_KEY || process.env.RESEND_API_KEY}` }, signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error('Cannot read Resend status; use a private setup/read key.');
    const email = await response.json();
    if (email.id !== row.provider_message_id || !Array.isArray(email.to) || email.to.length !== 1 || email.to[0] !== INITIAL_RECIPIENT) throw new Error('Provider recipient mismatch.');
    result.providerEvent = email.last_event;
    const known = ['sent', 'delivered', 'delivery_delayed', 'bounced', 'complained', 'failed', 'opened', 'clicked'];
    if (known.includes(email.last_event)) await sql(`UPDATE orvanta_workflow.notification_outbox SET delivery_status = $2,
      delivery_observed_at = now() WHERE id = $1::uuid AND state = 'accepted'`, [row.id, email.last_event]);
  }
  console.log(JSON.stringify(result, null, 2));
  console.log('Provider acceptance/delivery events do not verify inbox receipt. Check the actual test inbox for this call ID.');
} catch { console.error('Call verification incomplete. Check the call ID, completed extraction, durable rows and private provider credentials. No enquiry fields or secrets are logged.'); process.exitCode = 1; }
