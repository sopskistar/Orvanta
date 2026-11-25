import {createHmac,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import {preflight} from './preflight.mjs';
import {loadConfig,INITIAL_RECIPIENT} from '../src/config.ts';
import {bookingConfig} from '../src/booking-config.ts';
import {GoogleCalendar} from '../src/booking-google.ts';
import {BookingStore} from '../src/booking-store.ts';
import {neonSql} from '../src/store.ts';
import assert from 'node:assert/strict';
// LIVE, bounded synthetic demo-calendar writes and four test-inbox notifications.
// Never runs from CI/npm test. Never invokes /admin/process.
let stage='preflight';
const report={operational:false,inboxReceiptVerified:false,checks:[],syntheticCalls:[]};
try {
 if(process.env.RUN_BOOKING_LIVE_TESTS!=='true'||process.env.BOOKING_ENABLED!=='true')throw new Error('explicit_live_test_opt_in_required');
 const date=process.argv[2];if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw new Error('explicit_test_date_required');
 await preflight();
 const config=loadConfig(process.env),calendar=bookingConfig(process.env),provider=new GoogleCalendar(calendar),store=BookingStore.connect(process.env.DATABASE_URL),sql=neonSql(process.env.DATABASE_URL);
 if(config.routes.size!==1)throw new Error('ambiguous_agent');
 const agentId=[...config.routes.keys()][0],origin=new URL(process.env.WORKER_URL).origin;
 const call=()=>`call_synthetic_booking_${randomUUID().replaceAll('-','')}`;
 const post=async(path,payload)=>{const raw=JSON.stringify(payload),t=Date.now(),digest=createHmac('sha256',process.env.RETELL_API_KEY).update(raw+t).digest('hex');
  const r=await fetch(origin+path,{method:'POST',headers:{'Content-Type':'application/json','x-retell-signature':`v=${t},d=${digest}`},body:raw,signal:AbortSignal.timeout(55000)});
  if(!r.ok)throw new Error('live_endpoint_failed');return r.status===204?null:r.json();};
 const tool=(name,args,callId)=>post('/tools/booking-'+name,{name:'synthetic_live_test',call:{call_id:callId,agent_id:agentId},args});
 const offers=async(type,callId,timeFrom='09:00')=>{const r=await tool('availability',{booking_type:type,date,time_zone:calendar.timeZone,time_from:timeFrom},callId);assert.equal(r.status,'available');assert.ok(r.offers?.length);return r.offers;};
 const confirm=(o,callId)=>tool('confirm',{confirmation_token:o.confirmation_token,caller_confirmed:true,confirmed_local_start:o.local_start,confirmed_time_zone:o.time_zone,customer_name:'Alex Example — synthetic booking test',callback_number:'+12025550143'},callId);
 const check=(name)=>{report.checks.push(name);console.log(JSON.stringify({passed:name}));};
 stage='successful_and_duplicate_bookings';
 const a=call(),[callback]=await offers('callback',a);
 const duplicates=await Promise.all(Array.from({length:5},()=>confirm(callback,a)));
 assert.ok(duplicates.some(r=>r.booked));const callbackReceipt=await confirm(callback,a);assert.equal(callbackReceipt.booked,true);
 assert.equal((await sql('SELECT id FROM orvanta_workflow.bookings WHERE call_id=$1 AND booking_type=$2',[a,'callback'])).length,1);check('duplicate confirmations produce one callback');
 const [visit]=await offers('cleaning_visit',a),visitReceipt=await confirm(visit,a);assert.equal(visitReceipt.booked,true);assert.notEqual(callbackReceipt.providerBookingId,visitReceipt.providerBookingId);check('callback and cleaning visit have separate receipts');
 stage='simultaneous_requests';
 const b=call(),c=call(),[bOffer]=await offers('callback',b,'14:00'),[cOffer]=await offers('cleaning_visit',c,'14:00');
 assert.equal(bOffer.start,cOffer.start);
 const race=await Promise.all([confirm(bOffer,b),confirm(cOffer,c)]);assert.equal(race.filter(r=>r.booked).length,1);assert.equal(race.filter(r=>r.status==='unavailable').length,1);check('simultaneous overlapping requests create one booking');
 const winner=race[0].booked?b:c;
 stage='unavailable_and_declined';
 const unavailable=call(),declined=call();
 const busy=await tool('availability',{booking_type:'callback',date,time_zone:calendar.timeZone,time_from:callback.local_start.slice(11),time_to:new Intl.DateTimeFormat('en-GB',{timeZone:calendar.timeZone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(callback.end))},unavailable);
 assert.equal(busy.status,'unavailable');assert.equal((await tool('decline',{booking_type:'cleaning_visit'},declined)).status,'declined');check('busy and declined slots are not booked');
 stage='real_calendar_readback';
 for(const callId of [a,winner])for(const type of ['callback','cleaning_visit']){
  const row=await store.existing(callId,type,config.workspaceId);if(!row)continue;
  assert.equal(row.status,'confirmed');assert.equal(await provider.find(row),row.provider_event_id);
 }
 check('actual provider events match durable booking receipts');
 stage='transactional_enquiry_emails';
 for(const callId of [a,winner,unavailable,declined]){
  await post('/webhooks/retell',{event:'call_analyzed',call:{call_id:callId,agent_id:agentId,call_type:'web_call',call_analysis:{custom_analysis_data:{customer_name:'Alex Example — synthetic booking test',callback_number:'+12025550143',service_requested:'Demo calendar validation',zip_code:'02108',property_details:'Synthetic test only',preferred_date:date,cleaning_notes:'Synthetic booking acceptance test; no real cleaning service.',callback_preference:'A separate explicitly confirmed demo callback slot',follow_up_needed:true}}}});
  report.syntheticCalls.push(callId);
 }
 console.log(JSON.stringify({waitingForScheduledDelivery:true,testEmailsExpected:4,manualProcessingInvoked:false}));
 const end=Date.now()+180000;
 let rows=[];
 while(Date.now()<end){
  rows=await sql(`SELECT e.call_id,n.state,n.payload,n.provider_message_id FROM orvanta_workflow.enquiries e JOIN orvanta_workflow.notification_outbox n ON n.enquiry_id=e.id WHERE e.call_id=ANY($1::text[])`,[report.syntheticCalls]);
  if(rows.length===4&&rows.every(r=>r.state==='accepted'))break;
  if(rows.some(r=>['failed','review'].includes(r.state)))throw new Error('notification_failed');
  console.log(JSON.stringify({accepted:rows.filter(r=>r.state==='accepted').length,expected:4}));await new Promise(resolve=>setTimeout(resolve,15000));
 }
 assert.equal(rows.length,4);assert.ok(rows.every(r=>r.state==='accepted'&&r.provider_message_id));
 for(const row of rows){assert.deepEqual(row.payload.to,[INITIAL_RECIPIENT]);assert.match(row.payload.text,/Booking type:/);assert.match(row.payload.text,/Booking status:/);assert.match(row.payload.text,/Booking time zone:/);}
 check('scheduled outbox accepted all four correctly routed enquiry summaries');
 report.completedAt=new Date().toISOString();report.providerEventsVerified=true;report.manualProcessingInvoked=false;
 console.log(JSON.stringify({liveCalendarTestsPassed:true,syntheticCalls:report.syntheticCalls,inboxReceiptVerified:false,operational:false,next:'Verify the four actual Gmail messages and complete a real Mia call with explicit confirmation.'}));
}catch{console.error(JSON.stringify({liveBookingVerificationIncomplete:true,stage,operational:false,secretValuesPrinted:false}));process.exitCode=1;}
finally{await fs.mkdir(new URL('../../../artifacts/booking-live/',import.meta.url),{recursive:true});await fs.writeFile(new URL('../../../artifacts/booking-live/latest.json',import.meta.url),JSON.stringify(report,null,2),{mode:0o600});}
