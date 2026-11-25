import fs from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {neonSql} from '../src/store.ts';
import {loadConfig} from '../src/config.ts';
import {retellClient} from './retell-client.mjs';
import {GREETING} from './calcom-agent-config.mjs';
let stage='acceptance_gate';
try {
 const review=JSON.parse(await fs.readFile(new URL('../.private/calcom-agent-review.json',import.meta.url),'utf8'));
 const acceptance=JSON.parse(await fs.readFile(new URL('../.private/calcom-acceptance.json',import.meta.url),'utf8'));
 const hash=createHash('sha256').update(JSON.stringify({prompt:review.llm.general_prompt,tools:review.llm.general_tools})).digest('hex');
 if(acceptance.version!==review.draft.version||acceptance.configurationHash!==hash||acceptance.operationalAccepted!==true||!acceptance.calls?.length)throw new Error('verified_acceptance_required');
 const config=loadConfig(process.env),sql=neonSql(process.env.DATABASE_URL),types=new Set();
 for(const c of acceptance.calls){
  if(!c.callId||!c.gmailMessageId||!c.cronExecutionVerified||!c.calendarEvents?.length)throw new Error('actual_calendar_inbox_and_cron_required');
  const rows=await sql(`SELECT b.booking_type,b.provider_booking_id,n.state,n.payload FROM orvanta_workflow.calcom_booking_evidence b
   JOIN orvanta_workflow.enquiries e ON e.id=b.enquiry_id JOIN orvanta_workflow.notification_outbox n ON n.enquiry_id=e.id
   WHERE e.workspace_id=$1 AND e.call_id=$2 AND b.status='confirmed'`,[config.workspaceId,c.callId]);
  for(const r of rows){if(r.state!=='accepted'||!isDeepStrictEqual(r.payload.to,['julianahonour@gmail.com'])||!c.calendarEvents.some(e=>e.providerBookingId===r.provider_booking_id&&e.googleEventId))throw new Error('receipt_evidence_mismatch');types.add(r.booking_type);}
 }
 if(!types.has('callback')||!types.has('cleaning_visit'))throw new Error('both_types_must_pass');
 const api=retellClient(),draft=await api(`get-agent/${review.id}?version=${review.draft.version}`),llm=await api(`get-retell-llm/${draft.response_engine.llm_id}?version=${draft.response_engine.version}`);
 if(llm.begin_message!==GREETING||llm.start_speaker!=='agent'||llm.general_prompt!==review.llm.general_prompt||!isDeepStrictEqual(llm.general_tools,review.llm.general_tools)||!isDeepStrictEqual(draft.post_call_analysis_data,review.base.post_call_analysis_data)||draft.webhook_url!==review.base.webhook_url||!isDeepStrictEqual(draft.webhook_events,review.base.webhook_events))throw new Error('reviewed_draft_changed');
 const versions=await api(`list-agent-versions/${review.id}?limit=100&sort_order=descending`),latest=versions.items.filter(v=>v.is_published).sort((a,b)=>b.version-a.version)[0];
 if(versions.has_more||latest.version!==(draft.is_published?draft.version:5))throw new Error('newer_published_work_preserved');
 const numbers=await api('v2/list-phone-numbers?limit=100'),matches=numbers.items.filter(n=>n.phone_number.endsWith('6003'));
 if(numbers.has_more||matches.length!==1)throw new Error('number_ambiguous');
 const path=encodeURIComponent(matches[0].phone_number),before=await api('get-phone-number/'+path);
 if(before.inbound_agents?.length!==1||before.inbound_agents[0].agent_id!==review.id||![5,draft.version].includes(before.inbound_agents[0].agent_version))throw new Error('number_binding_changed');
 stage='publish_accepted_version';
 if(!draft.is_published)await api(`publish-agent-version/${review.id}`,'POST',{version:draft.version});
 const published=await api(`get-agent/${review.id}?version=${draft.version}`);if(!published.is_published)throw new Error('publication_not_verified');
 const inbound=before.inbound_agents.map(a=>({...a,agent_version:draft.version}));
 await api('update-phone-number/'+path,'PATCH',{inbound_agents:inbound});
 const after=await api('get-phone-number/'+path);
 if(!isDeepStrictEqual(after.inbound_agents,inbound)||Object.keys({...before,...after}).some(k=>!['inbound_agents','last_modification_timestamp'].includes(k)&&!isDeepStrictEqual(before[k]??null,after[k]??null)))throw new Error('number_readback_mismatch');
 console.log(JSON.stringify({publishedVersion:published.version,numberSuffix:'6003',assignedVersion:after.inbound_agents[0].agent_version,greetingPreserved:true,webhookAndExtractionPreserved:true,acceptanceEvidenceVerified:true}));
}catch{console.error(JSON.stringify({releaseIncomplete:true,stage,requirement:'Actual browser-call calendar, enquiry, Gmail and scheduled-processing evidence is required before publication; newer configuration is preserved.',secretsPrinted:false}));process.exitCode=1;}
