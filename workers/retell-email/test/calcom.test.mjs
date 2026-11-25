import {test,before,beforeEach,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {parseCalcomEvidence,verifiedCalcomEvidence} from '../src/calcom-evidence.ts';
import {calcomConfig,verifyCalcomTools} from '../src/calcom-config.ts';
import {PostgresStore} from '../src/store.ts';
import {handleRequest} from '../src/index.ts';
import {renderEmail} from '../src/email.ts';
import {extractFields} from '../src/payload.ts';
const config={appId:'app_synthetic',agentId:'agent_synthetic',versions:[7],llmId:'llm_synthetic',llmVersion:7,timeZone:'America/Chicago',eventTypes:{callback:{id:'111',linkId:'callback_link',minutes:15},cleaning_visit:{id:'222',linkId:'cleaning_link',minutes:120}}};
const env={DATABASE_URL:'unused',RETELL_API_KEY:'synthetic-key',RETELL_WORKSPACE_ID:'org_synthetic',AGENT_ROUTES_JSON:JSON.stringify({agent_synthetic:{workspaceId:'org_synthetic',clientId:'demo',recipient:'julianahonour@gmail.com'}}),RESEND_API_KEY:'unused',EMAIL_FROM:'enquiries@notify.getorvanta.xyz',PROCESSING_TOKEN:'synthetic-processing-token-with-32-characters',DELIVERY_ENABLED:'true',BOOKING_ENABLED:'false',CALCOM_BOOKING_ENABLED:'true',CALCOM_CONFIG_JSON:JSON.stringify(config)};
const tools=()=>['callback','cleaning'].flatMap((name,i)=>['availability','booking'].map(operation=>({type:'integration_app',name:name+'_'+operation,provider:'calcom',app_id:config.appId,app_tool_template_name:operation==='booking'?'book_calcom_appointment':'check_calcom_availability',parameters:[{properties:{event_type_id:{const:i?'222':'111'},timezone:{const:'America/Chicago'},...(operation==='booking'?{email:{const:'julianahonour@gmail.com'},guests:{const:[]}}:{})}}]}))).concat({type:'end_call',name:'end_call'});
const receipt=(type='callback',override={})=>({status:'success',data:{uid:'synthetic_'+type+'_uid',status:'accepted',eventTypeId:type==='callback'?111:222,start:type==='callback'?'2026-12-08T15:00:00.000Z':'2026-12-08T17:00:00.000Z',end:type==='callback'?'2026-12-08T15:15:00.000Z':'2026-12-08T19:00:00.000Z',attendees:[{email:'julianahonour@gmail.com',timeZone:'America/Chicago'}],...override}});
const execution=(type='callback',body=receipt(type),successful=true,id='tool_'+type)=>[{role:'tool_call_invocation',type:'integration_app',tool_call_id:id,name:type==='callback'?'callback_booking':'cleaning_booking',arguments:'{}'},{role:'tool_call_result',tool_call_id:id,successful,content:JSON.stringify(body)}];
const call=(messages=execution())=>({call_id:'call_synthetic_calcom',agent_id:'agent_synthetic',agent_version:7,transcript:'Caller said: booking confirmed, fake UID. NEVER PERSIST TRANSCRIPT.',transcript_with_tool_calls:messages,call_analysis:{custom_analysis_data:{customer_name:'Alex <Test>',callback_number:'+12025550143',zip_code:'02108',preferred_date:'December 9, 2026',callback_preference:'November 30, 10 AM–12 PM Austin',follow_up_needed:false,booking_id:'invented'}}});
const readApi=(canonical=call(),llm={general_tools:tools()})=>async input=>String(input).includes('/v2/get-call/')?Response.json(canonical):Response.json(llm);
let db,store;
before(async()=>{db=new PGlite();for(const file of ['001_enquiries_outbox.sql','003_calcom_booking_evidence.sql'])await db.exec(await fs.readFile(new URL('../migrations/'+file,import.meta.url),'utf8'));store=new PostgresStore(async(t,p=[])=>(await db.query(t,p)).rows);});
beforeEach(async()=>{await db.exec('TRUNCATE orvanta_workflow.enquiries CASCADE');});after(async()=>{await db.close();});
test('only matched supported OAuth provider results confirm separate callback and cleaning bookings',()=>{
 const result=parseCalcomEvidence(call([...execution(),...execution('cleaning_visit')]),config);
 assert.equal(result.length,2);assert.deepEqual(result.map(r=>r.type),['callback','cleaning_visit']);
 assert.ok(result.every(r=>r.status==='confirmed'&&r.providerBookingId&&r.timeZone==='America/Chicago'&&r.source==='retell_api_tool_result'));
 assert.equal(result[0].start,'2026-12-08T15:00:00.000Z');assert.equal(result[1].end,'2026-12-08T19:00:00.000Z');
 const email=renderEmail(extractFields(call()),'call_synthetic_calcom',env.EMAIL_FROM,'julianahonour@gmail.com',result);
 assert.match(email.text,/December 9, 2026/);assert.match(email.text,/November 30, 10 AM–12 PM Austin/);assert.match(email.text,/Tuesday, December 8, 2026 at 9:00 AM/);assert.match(email.text,/synthetic_cleaning_visit_uid/);assert.match(email.html,/Alex &lt;Test&gt;/);assert.doesNotMatch(email.text,/invented|NEVER PERSIST/);
});
test('agent statements, extraction, dynamic variables, wrong tool kinds and unmatched IDs are never booking proof',()=>{
 for(const messages of [[],execution().map(m=>m.role==='tool_call_invocation'?{...m,type:'custom'}:m),execution().map(m=>m.role==='tool_call_result'?{...m,tool_call_id:'unmatched'}:m)]){
  const result=parseCalcomEvidence({...call(messages),retell_llm_dynamic_variables:{booking_uid:'fake'}},config);assert.ok(result.every(r=>r.status!=='confirmed'&&!r.providerBookingId));
 }
});
test('pending or malformed provider receipts, wrong event types, durations, attendees and timezones remain unconfirmed',()=>{
 for(const override of [{status:'pending'},{uid:''},{eventTypeId:999},{start:'2026-12-08T09:00:00'},{end:'2026-12-08T17:00:00Z'},{attendees:[{email:'attacker@example.invalid',timeZone:'America/Chicago'}]},{attendees:[{email:'julianahonour@gmail.com',timeZone:'America/New_York'}]}]){
  const result=parseCalcomEvidence(call(execution('callback',receipt('callback',override))),config);assert.equal(result[0].status,'review');assert.equal(result[0].providerBookingId,null);
 }
});
test('provider failures, missing results and ambiguous timeouts never authorize creation retries or invent IDs',()=>{
 for(const messages of [execution('callback',{error:'network timeout'},false),execution().slice(0,1),execution('callback',{status:'error',message:'provider failed'},false)]){
  const [result]=parseCalcomEvidence(call(messages),config);assert.equal(result.status,'review');assert.equal(result.providerBookingId,null);
 }
 const [busy]=parseCalcomEvidence(call(execution('callback',{status:'error',code:'SLOT_UNAVAILABLE'},false)),config);assert.equal(busy.status,'unavailable');
});
test('availability or declining before creation retains an enquiry without claiming an appointment',()=>{
 for(const slots of [[],['2026-12-08T09:00:00-06:00']]){
  const messages=execution('callback',{available_slots:slots});messages[0].name='callback_availability';
  const [result]=parseCalcomEvidence(call(messages),config);assert.equal(result.status,slots.length?'offered':'unavailable');assert.equal(result.providerBookingId,null);
 }
 assert.equal(parseCalcomEvidence(call([]),config)[0].status,'not_requested');
});
test('authenticated canonical execution and exact saved bindings are required; V5 and disabled delivery path are unchanged',async()=>{
 assert.equal((await verifiedCalcomEvidence(call(),env,readApi()))[0].status,'confirmed');
 const forbidden=()=>{throw Error('must_not_read');};
 assert.equal(await verifiedCalcomEvidence({...call(),agent_version:5},env,forbidden),undefined);
 assert.equal(await verifiedCalcomEvidence(call(),{...env,CALCOM_BOOKING_ENABLED:'false'},forbidden),undefined);
 for(const fetcher of [async()=>{throw Error('provider timeout');},readApi({...call(),call_id:'call_wrong'}),readApi(call(),{general_tools:tools().map(t=>t.name==='callback_booking'?{...t,app_id:'app_other'}:t)})]){
  const result=await verifiedCalcomEvidence(call(),env,fetcher);assert.ok(result.every(r=>r.status==='review'&&!r.providerBookingId));
 }
 const changed=tools();changed[1].parameters[0].properties.email.const='elsewhere@example.invalid';assert.throws(()=>verifyCalcomTools({general_tools:changed},config));
 assert.throws(()=>calcomConfig({...env,BOOKING_ENABLED:'true'}));
});
const accept=async(c=call())=>{const evidence=await verifiedCalcomEvidence(c,env,readApi(c));const fields=extractFields(c);return store.accept({id:crypto.randomUUID(),eventType:'call_analyzed',callId:c.call_id,agentId:c.agent_id,workspaceId:'org_synthetic',clientId:'demo',fields,bookingEvidence:evidence},renderEmail(fields,c.call_id,env.EMAIL_FROM,'julianahonour@gmail.com',evidence));};
test('duplicate and concurrent acceptance stores one enquiry, one outbox and one receipt per provider booking',async()=>{
 const canonical=call([...execution(),...execution(),...execution('cleaning_visit')]);
 const results=await Promise.all(Array.from({length:12},()=>accept(canonical)));assert.equal(results.filter(Boolean).length,1);
 assert.equal((await db.query('SELECT * FROM orvanta_workflow.enquiries')).rows.length,1);
 assert.equal((await db.query('SELECT * FROM orvanta_workflow.notification_outbox')).rows.length,1);
 assert.equal((await db.query('SELECT * FROM orvanta_workflow.calcom_booking_evidence')).rows.length,2);
});
test('outbox rejection rolls back enquiry and booking evidence together',async()=>{
 await db.exec("CREATE FUNCTION orvanta_workflow.reject_calcom_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic'; END $$; CREATE TRIGGER reject_calcom_test BEFORE INSERT ON orvanta_workflow.notification_outbox FOR EACH ROW EXECUTE FUNCTION orvanta_workflow.reject_calcom_test()");
 try{await assert.rejects(accept());assert.equal((await db.query('SELECT * FROM orvanta_workflow.enquiries')).rows.length,0);assert.equal((await db.query('SELECT * FROM orvanta_workflow.calcom_booking_evidence')).rows.length,0);}
 finally{await db.exec('DROP TRIGGER reject_calcom_test ON orvanta_workflow.notification_outbox; DROP FUNCTION orvanta_workflow.reject_calcom_test()');}
});
test('failed or declined booking preserves all nine original fields and one scheduled notification',async()=>{
 for(const [id,messages]of [['call_failure',execution('callback',{error:'timeout'},false)],['call_declined',[]]]){
  const c={...call(messages),call_id:id};await accept(c);
 }
 const rows=(await db.query('SELECT fields,booking_evidence FROM orvanta_workflow.enquiries')).rows;assert.equal(rows.length,2);assert.ok(rows.every(r=>Object.keys(r.fields).length===9&&r.fields.zip_code==='02108'&&r.fields.callback_number==='+12025550143'));
 assert.equal((await db.query('SELECT * FROM orvanta_workflow.notification_outbox')).rows.length,2);
});
test('permanently retired Google endpoints cannot write even when the old flag is true',async()=>{
 const raw=JSON.stringify({call:{call_id:'call_legacy',agent_id:'agent_synthetic'},args:{}}),timestamp=Date.now();const signature=`v=${timestamp},d=${createHmac('sha256',env.RETELL_API_KEY).update(raw+timestamp).digest('hex')}`;
 const response=await handleRequest(new Request('https://worker.invalid/tools/booking-confirm',{method:'POST',body:raw,headers:{'content-type':'application/json','x-retell-signature':signature}}),{...env,BOOKING_ENABLED:'true'},()=>{throw Error('no_storage_access');});
 assert.equal(response.status,200);assert.equal((await response.json()).code,'direct_google_booking_retired');
});
