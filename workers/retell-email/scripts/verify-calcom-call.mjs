import fs from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {neonSql} from '../src/store.ts';
import {loadConfig,ID} from '../src/config.ts';
import {calcomConfig} from '../src/calcom-config.ts';
import {verifiedCalcomEvidence} from '../src/calcom-evidence.ts';
import {extractFields} from '../src/payload.ts';
import {retellClient} from './retell-client.mjs';
try {
 const callId=process.argv[2];if(!ID.test(callId||''))throw new Error('real_call_id_required');
 const c=calcomConfig(process.env),config=loadConfig(process.env),api=retellClient();
 const call=await api('v2/get-call/'+encodeURIComponent(callId));
 if(call.agent_id!==c.agentId||!config.routes.has(call.agent_id)||!c.versions.includes(call.agent_version))throw new Error('reviewed_call_required');
 const evidence=await verifiedCalcomEvidence(call,process.env);
 const sql=neonSql(process.env.DATABASE_URL);
 const rows=await sql(`SELECT e.id,e.fields,e.booking_evidence,n.state,n.attempts,n.provider_message_id,n.provider_accepted_at,n.payload,n.delivery_status
  FROM orvanta_workflow.enquiries e JOIN orvanta_workflow.notification_outbox n ON n.enquiry_id=e.id WHERE e.workspace_id=$1 AND e.call_id=$2 AND e.event_type='call_analyzed'`,[config.workspaceId,callId]);
 if(rows.length!==1)throw new Error('one_enquiry_notification_required');
 const row=rows[0];
 const receipts=await sql('SELECT booking_type,status,provider_booking_id FROM orvanta_workflow.calcom_booking_evidence WHERE enquiry_id=$1::uuid',[row.id]);
 const [unresolved]=await sql("SELECT count(*)::int AS count FROM orvanta_workflow.notification_outbox WHERE state<>'accepted'");
 const result={callId,version:call.agent_version,oneEnquiry:true,oneNotification:true,fieldsMatch:isDeepStrictEqual(row.fields,extractFields(call)),evidenceMatches:isDeepStrictEqual(row.booking_evidence,evidence),receiptCount:receipts.length,
  bookings:receipts,providerAccepted:row.state==='accepted'&&!!row.provider_message_id&&!!row.provider_accepted_at,attempts:row.attempts,recipientRestricted:isDeepStrictEqual(row.payload.to,['julianahonour@gmail.com']),unresolvedNotifications:unresolved.count,
  callStartedAt:call.start_timestamp,callEndedAt:call.end_timestamp,
  providerAcceptedAt:row.provider_accepted_at,notificationProviderId:row.provider_message_id,
  inboxReceiptVerified:false,actualCalendarEventsVerified:false,cronExecutionVerified:false,operational:false};
 const directory=new URL('../../../artifacts/booking-live/',import.meta.url);await fs.mkdir(directory,{recursive:true});
 await fs.writeFile(new URL(callId+'-verification.json',directory),JSON.stringify(result,null,2),{mode:0o600});
 console.log(JSON.stringify(result));
}catch{console.error('Call verification incomplete. Use the real V7 browser call ID; no enquiry details, transcripts or secrets are logged.');process.exitCode=1;}
