import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import fs from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { neon } from '@neondatabase/serverless';
import { handleRequest, scheduledProcessing } from '../src/index.ts';
import { PostgresStore } from '../src/store.ts';
import { verifyRetell } from '../src/signature.ts';
import { extractFields, MAX_BODY_BYTES } from '../src/payload.ts';
import { loadConfig, INITIAL_RECIPIENT } from '../src/config.ts';
import { processBatch, sendEmail } from '../src/delivery.ts';

// Synthetic values only. No tests call Retell, Resend or a real inbox.
const env = {
 DATABASE_URL:'unused-in-local-tests', RETELL_API_KEY:'synthetic-signing-key-only',
 RETELL_WORKSPACE_ID:'org_synthetic', AGENT_ROUTES_JSON:JSON.stringify({agent_synthetic:{clientId:'synthetic',workspaceId:'org_synthetic',recipient:INITIAL_RECIPIENT}}),
 RESEND_API_KEY:'synthetic-provider-key-only', EMAIL_FROM:'enquiries@notify.getorvanta.xyz',
 PROCESSING_TOKEN:'synthetic-processing-token-never-use-in-production', DELIVERY_ENABLED:'true',
};
const sample = () => ({ event:'call_analyzed', call:{call_id:'call_synthetic',agent_id:'agent_synthetic',
 transcript:'PRIVATE_TRANSCRIPT_MUST_NOT_PERSIST',recording_url:'https://recording.synthetic.invalid/private',
 call_analysis:{custom_analysis_data:{customer_name:'Alex Example',callback_number:'+1 202-555-0143',service_requested:'End-of-tenancy cleaning',zip_code:'02108',property_details:'Two bedrooms',preferred_date:'10 December, morning',cleaning_notes:'<script>unsafe & "quoted"</script>',callback_preference:'Weekday afternoons',follow_up_needed:false,recipient:'unconfigured@example.invalid'}},
 metadata:{recipient:'unconfigured@example.invalid',workspaceId:'org_attacker'}}});
const sign = (raw, timestamp=Date.now()) => `v=${timestamp},d=${createHmac('sha256',env.RETELL_API_KEY).update(Buffer.concat([Buffer.from(raw),Buffer.from(String(timestamp))])).digest('hex')}`;
const makeRequest=(payload=sample(),options={})=>{
 const raw=typeof payload==='string'?payload:JSON.stringify(payload);
 return new Request('https://worker.synthetic.invalid/webhooks/retell',{method:'POST',body:raw,headers:{'content-type':'application/json','x-retell-signature':sign(raw),...options}});
};
let db, sql, store;
before(async()=>{
 const source=await fs.readFile(new URL('../migrations/001_enquiries_outbox.sql',import.meta.url),'utf8');
 if(process.env.WORKFLOW_TEST_DATABASE_URL){
  assert.equal(process.env.ALLOW_WORKFLOW_TEST_RESET,'true','Explicit isolated-test-branch reset opt-in is required.');
  assert.notEqual(process.env.WORKFLOW_TEST_DATABASE_URL,process.env.DATABASE_URL,'Never run destructive SQL tests against the configured production database.');
  const client=neon(process.env.WORKFLOW_TEST_DATABASE_URL);
  await client.transaction(source.split('-- statement-breakpoint').map(statement=>client.query(statement.trim())));
  sql=async(text,params=[])=>client.query(text,params);
 }else{
  db=new PGlite();await db.exec(source);
  sql=async(text,params=[])=> (await db.query(text,params)).rows;
 }
 store=new PostgresStore(sql);
});
beforeEach(async()=>{await sql('TRUNCATE orvanta_workflow.enquiries CASCADE');});
after(async()=>{await db?.close();});
const receive=request=>handleRequest(request,env,()=>store);
const rows=()=>sql('SELECT * FROM orvanta_workflow.notification_outbox');
const due=()=>sql("UPDATE orvanta_workflow.notification_outbox SET next_attempt_at=now()-interval '1 second'");
const expire=()=>sql("UPDATE orvanta_workflow.notification_outbox SET lease_until=now()-interval '1 second'");
const accepted=async()=>new Response(JSON.stringify({id:'email_synthetic'}),{status:200});

test('documented signature accepts exact raw Unicode bytes and rejects mutation, stale/future/invalid headers',async()=>{
 const raw=Buffer.from(' {"name":"Chloé 🧹"} \n');
 assert.equal(await verifyRetell(raw,sign(raw),env.RETELL_API_KEY),true);
 assert.equal(await verifyRetell(Buffer.from(raw.toString().trim()),sign(raw),env.RETELL_API_KEY),false);
 for(const signature of [null,'invalid',sign(raw,Date.now()-300_001),sign(raw,Date.now()+300_001),'v=1,d=zz',sign(raw).replace('v=','v=0')]){
  assert.equal(await verifyRetell(raw,signature,env.RETELL_API_KEY),false);
 }
 assert.equal((await receive(makeRequest(sample(),{'x-retell-signature':'invalid'}))).status,401);
 assert.equal((await rows()).length,0);
});
test('rejects malformed JSON, invalid UTF-8, wrong content type and encoded requests',async()=>{
 assert.equal((await receive(makeRequest('{not json'))).status,400);
 const raw=new Uint8Array([255,254]);
 const invalid=new Request('https://worker.synthetic.invalid/webhooks/retell',{method:'POST',body:raw,headers:{'content-type':'application/json','x-retell-signature':sign(raw)}});
 assert.equal((await receive(invalid)).status,400);
 assert.equal((await receive(makeRequest(sample(),{'content-type':'text/plain'}))).status,415);
 assert.equal((await receive(makeRequest(sample(),{'content-encoding':'gzip'}))).status,415);
 assert.equal((await receive(makeRequest({event:'call_analyzed'}))).status,400);
});
test('rejects oversized bodies using actual streamed size even with a false Content-Length',async()=>{
 assert.equal((await receive(makeRequest('x',{'content-length':String(MAX_BODY_BYTES+1)}))).status,413);
 const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(MAX_BODY_BYTES+1));controller.close();}});
 const request=new Request('https://worker.synthetic.invalid/webhooks/retell',{method:'POST',duplex:'half',body:stream,headers:{'content-type':'application/json','content-length':'1','x-retell-signature':'invalid'}});
 assert.equal((await receive(request)).status,413);
 assert.equal((await receive(makeRequest('x'.repeat(MAX_BODY_BYTES+1)))).status,413);
});
test('slow unfinished bodies time out instead of accepting a truncated prefix',async()=>{
 const stream=new ReadableStream({start(controller){controller.enqueue(new TextEncoder().encode('{}'));}});
 const request=new Request('https://worker.synthetic.invalid/webhooks/retell',{method:'POST',duplex:'half',body:stream,headers:{'content-type':'application/json'}});
 assert.equal((await receive(request)).status,408);
});
test('unknown agents are rejected; caller metadata cannot select workspace or recipient',async()=>{
 const payload=sample();payload.call.agent_id='agent_unknown';
 assert.equal((await receive(makeRequest(payload))).status,403);
 assert.equal((await rows()).length,0);
 assert.equal((await receive(makeRequest())).status,204);
 const [enquiry]=await sql('SELECT * FROM orvanta_workflow.enquiries');
 assert.equal(enquiry.workspace_id,'org_synthetic');
 assert.deepEqual((await rows())[0].payload.to,[INITIAL_RECIPIENT]);
 assert.throws(()=>loadConfig({...env,AGENT_ROUTES_JSON:JSON.stringify({agent_synthetic:{clientId:'test',workspaceId:'org_synthetic',recipient:'someone@example.invalid'}})}));
});
test('other authentic call/chat events are ignored without creating storage or email work',async()=>{
 for(const payload of [{event:'call_ended',call:sample().call},{event:'chat_analyzed',chat:{chat_id:'chat_synthetic'}}]){
  const response=await handleRequest(makeRequest(payload),env,()=>{throw new Error('Storage must not be accessed');});
  assert.equal(response.status,204);assert.equal(await response.text(),'');
 }
 assert.equal((await rows()).length,0);
});
test('all nine fields preserve strings, missing/null values and false without guessing',async()=>{
 assert.equal((await receive(makeRequest())).status,204);
 const [enquiry]=await sql('SELECT * FROM orvanta_workflow.enquiries');
 assert.equal(enquiry.fields.zip_code,'02108');assert.equal(enquiry.fields.callback_number,'+1 202-555-0143');
 assert.equal(enquiry.fields.preferred_date,'10 December, morning');assert.equal(enquiry.fields.callback_preference,'Weekday afternoons');assert.equal(enquiry.fields.follow_up_needed,false);
 const absent=extractFields({from_number:'+1 202-555-0199'});
 assert.equal(Object.keys(absent).length,9);assert.ok(Object.values(absent).every(value=>value===null));
 const payload=sample();delete payload.call.call_analysis;payload.call.call_id='call_missing';
 assert.equal((await receive(makeRequest(payload))).status,204);
 const [missing]=await sql("SELECT fields FROM orvanta_workflow.enquiries WHERE call_id='call_missing'");
 assert.ok(Object.values(missing.fields).every(value=>value===null));
});
test('invalid field types are rejected rather than silently coercing phone, ZIP or follow-up',async()=>{
 for(const [field,value] of [['callback_number',2025550143],['zip_code',2108],['follow_up_needed','false'],['preferred_date',{}],['cleaning_notes','x'.repeat(4001)]]){
  const payload=sample();payload.call.call_analysis.custom_analysis_data[field]=value;
  assert.equal((await receive(makeRequest(payload))).status,400);
 }
 assert.equal((await rows()).length,0);
});
test('email is escaped, text is readable, unknown data/transcripts/recordings are not retained',async()=>{
 await receive(makeRequest());const [job]=await rows();
 assert.match(job.payload.html,/&lt;script&gt;unsafe &amp; &quot;quoted&quot;&lt;\/script&gt;/);
 assert.doesNotMatch(job.payload.html,/<script>/);
 assert.match(job.payload.text,/ZIP code: 02108/);assert.match(job.payload.text,/Call ID: call_synthetic/);
 const data=JSON.stringify([job,await sql('SELECT * FROM orvanta_workflow.enquiries')]);
 assert.doesNotMatch(data,/PRIVATE_TRANSCRIPT|recording\.synthetic|unconfigured@example/);
});
test('duplicate and twenty concurrent events produce exactly one enquiry and one outbox row',async()=>{
 const responses=await Promise.all(Array.from({length:20},()=>receive(makeRequest())));
 assert.ok(responses.every(response=>response.status===204));
 assert.equal((await sql('SELECT * FROM orvanta_workflow.enquiries')).length,1);assert.equal((await rows()).length,1);
 const before=(await rows())[0].payload;
 const changed=sample();changed.call.call_analysis.custom_analysis_data.customer_name='Replacement';
 await receive(makeRequest(changed));assert.deepEqual((await rows())[0].payload,before);
});
test('database acceptance failure returns retryable 503, never durable acceptance',async()=>{
 const response=await handleRequest(makeRequest(),env,()=>({accept:async()=>{throw new Error('DATABASE_CONNECTION_PRIVATE');}}));
 assert.equal(response.status,503);assert.equal(response.headers.get('retry-after'),'30');
 assert.doesNotMatch(await response.text(),/DATABASE_CONNECTION_PRIVATE/);
});
test('outbox insert failure rolls back the enquiry in the same transaction',async()=>{
 await assert.rejects(store.accept({id:crypto.randomUUID(),eventType:'call_analyzed',callId:'call_rollback',agentId:'agent_synthetic',workspaceId:'org_synthetic',clientId:'test',fields:extractFields({})},null));
 assert.equal((await sql('SELECT * FROM orvanta_workflow.enquiries')).length,0);assert.equal((await rows()).length,0);
});
test('overlapping processors claim jobs once and respect the bounded batch size',async()=>{
 for(let i=0;i<5;i++){const payload=sample();payload.call.call_id=`call_synthetic_${i}`;await receive(makeRequest(payload));}
 const [first,second]=await Promise.all([store.claim(),store.claim()]);
 assert.equal(first.length,3);assert.equal(second.length,2);
 assert.equal(new Set([...first,...second].map(job=>job.id)).size,5);
 assert.equal((await store.claim()).length,0);
});
test('provider acceptance is recorded independently from inbox delivery',async()=>{
 await receive(makeRequest());let captured;
 const summary=await processBatch(store,env.RESEND_API_KEY,async(_url,options)=>{captured=options;return accepted();});
 assert.equal(summary.accepted,1);
 const [job]=await rows();assert.equal(job.state,'accepted');assert.equal(job.provider_message_id,'email_synthetic');assert.ok(job.provider_accepted_at);
 assert.equal(job.delivery_status,'unconfirmed');assert.equal(job.delivery_observed_at,null);
 assert.equal(captured.headers['Idempotency-Key'],`orvanta-enquiry/${job.id}`);
 assert.deepEqual(JSON.parse(captured.body).to,[INITIAL_RECIPIENT]);
 assert.equal((await store.claim()).length,0);
 const [attempt]=await sql('SELECT * FROM orvanta_workflow.notification_attempts');assert.equal(attempt.outcome,'accepted');
});
test('network uncertainty uses the same frozen payload and provider key on retry',async()=>{
 await receive(makeRequest());const requests=[];const provider=new Map();
 const request=async(_url,options)=>{
  const key=options.headers['Idempotency-Key'];requests.push([key,options.body]);
  if(!provider.has(key)){provider.set(key,'email_synthetic');throw new Error('Timeout after acceptance');}
  return accepted();
 };
 await processBatch(store,env.RESEND_API_KEY,request);assert.equal((await rows())[0].state,'pending');
 assert.equal((await store.claim()).length,0);await due();
 await processBatch(store,env.RESEND_API_KEY,request);
 assert.equal(provider.size,1);assert.deepEqual(requests[0],requests[1]);assert.equal((await rows())[0].state,'accepted');
});
test('permanent provider failures are retained without leaking response bodies',async()=>{
 await receive(makeRequest());await processBatch(store,env.RESEND_API_KEY,async()=>new Response(JSON.stringify({message:'PRIVATE_PROVIDER_DETAIL'}),{status:403}));
 const [job]=await rows();assert.equal(job.state,'failed');assert.equal(job.last_error,'provider_http_403');
 assert.doesNotMatch(JSON.stringify(job),/PRIVATE_PROVIDER_DETAIL/);assert.equal((await store.claim()).length,0);
});
test('rate limits honor Retry-After and 409 handling distinguishes safe retry from key conflict',async()=>{
 await receive(makeRequest());await processBatch(store,env.RESEND_API_KEY,async()=>new Response('{}',{status:429,headers:{'retry-after':'120'}}));
 const [job]=await rows();assert.ok(new Date(job.next_attempt_at).getTime()-Date.now()>110_000);
 const fake={...job,first_attempt_at:new Date().toISOString()};
 assert.equal((await sendEmail(fake,'synthetic',async()=>new Response(JSON.stringify({name:'concurrent_idempotent_requests'}),{status:409}))).kind,'retry');
 assert.equal((await sendEmail(fake,'synthetic',async()=>new Response(JSON.stringify({name:'invalid_idempotent_request'}),{status:409}))).kind,'review');
});
test('expired leases recover and fence stale completions',async()=>{
 await receive(makeRequest());const [old]=await store.claim();await expire();const [current]=await store.claim();
 assert.equal(old.id,current.id);assert.notEqual(old.claim_token,current.claim_token);
 await assert.rejects(store.finish(old,{kind:'accepted',providerId:'old_id'}),/claim_lost/);
 await store.finish(current,{kind:'accepted',providerId:'email_synthetic'});
 assert.equal((await rows())[0].provider_message_id,'email_synthetic');
});
test('provider acceptance followed by database failure is recovered without changing provider key',async()=>{
 await receive(makeRequest());const originalFinish=store.finish.bind(store);const keys=[];
 const request=async(_url,options)=>{keys.push(options.headers['Idempotency-Key']);return accepted();};
 const failing={claim:()=>store.claim(),finish:async()=>{throw new Error('database_down');}};
 await assert.rejects(processBatch(failing,'synthetic',request),/persistence_failed/);
 assert.equal((await rows())[0].state,'processing');await expire();
 await processBatch({claim:()=>store.claim(),finish:originalFinish},'synthetic',request);
 assert.equal(keys[0],keys[1]);assert.equal((await rows())[0].state,'accepted');
});
test('six failed attempts are bounded and retained for review',async()=>{
 await receive(makeRequest());
 for(let i=0;i<6;i++){await due();await processBatch(store,'synthetic',async()=>new Response('{}',{status:500}));}
 const [job]=await rows();assert.equal(job.attempts,6);assert.equal(job.state,'review');assert.equal((await store.claim()).length,0);
 assert.equal((await sql('SELECT * FROM orvanta_workflow.notification_attempts')).length,6);
});
test('uncertain sends beyond 23 hours are never automatically sent again',async()=>{
 await receive(makeRequest());await store.claim();await expire();
 await sql("UPDATE orvanta_workflow.notification_outbox SET first_attempt_at=now()-interval '24 hours'");
 let sends=0;await processBatch(store,'synthetic',async()=>{sends++;return accepted();});
 assert.equal(sends,0);assert.equal((await rows())[0].state,'review');
});
test('delivery also rejects an expired idempotency window or a corrupted stored recipient',async()=>{
 await receive(makeRequest());const [job]=await store.claim();
 const never=async()=>{throw new Error('Must not call provider');};
 assert.equal((await sendEmail({...job,first_attempt_at:new Date(Date.now()-24*3600_000).toISOString()},'synthetic',never)).kind,'review');
 assert.equal((await sendEmail({...job,payload:{...job.payload,to:['unconfigured@example.invalid']}},'synthetic',never)).kind,'failed');
});
test('manual processing requires a secret; disabled cron does not access storage',async()=>{
 const request=()=>new Request('https://worker.synthetic.invalid/admin/process',{method:'POST'});
 assert.equal((await handleRequest(request(),env,()=>store)).status,401);
 const authorized=new Request('https://worker.synthetic.invalid/admin/process',{method:'POST',headers:{authorization:`Bearer ${env.PROCESSING_TOKEN}`}});
 assert.equal((await handleRequest(authorized,{...env,DELIVERY_ENABLED:'false'},()=>store)).status,409);
 await scheduledProcessing({...env,DELIVERY_ENABLED:'false'},()=>{throw new Error('Must not run');});
});
