import {before,beforeEach,after,test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {bookingTool} from '../src/booking.ts';
import {BookingStore} from '../src/booking-store.ts';
import {bookingConfig,daySlots,localDateTime} from '../src/booking-config.ts';
import {CalendarError} from '../src/booking-google.ts';
import {renderEmail} from '../src/email.ts';
import {createHmac} from 'node:crypto';
import {handleRequest} from '../src/index.ts';
import {PostgresStore} from '../src/store.ts';
import {processBatch} from '../src/delivery.ts';
const env={DATABASE_URL:'unused',RETELL_API_KEY:'synthetic-only',RETELL_WORKSPACE_ID:'org_synthetic',
 AGENT_ROUTES_JSON:JSON.stringify({agent_synthetic:{workspaceId:'org_synthetic',clientId:'orvanta',recipient:'julianahonour@gmail.com'}}),
 EMAIL_FROM:'enquiries@notify.getorvanta.xyz',BOOKING_ENABLED:'true',GOOGLE_CALENDAR_ID:'synthetic@group.calendar.google.com',BOOKING_TIMEZONE:'America/Chicago',
 GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify({type:'service_account',client_email:'synthetic@demo.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\nsynthetic_not_a_key\n-----END PRIVATE KEY-----'})};
const now=Date.parse('2026-11-25T14:00:00Z');
let db,store,created,busy,provider;
before(async()=>{
 db=new PGlite();
 for(const name of ['001_enquiries_outbox.sql','002_demo_bookings.sql'])await db.exec(await fs.readFile(new URL('../migrations/'+name,import.meta.url),'utf8'));
 store=new BookingStore(async(text,params=[]) => (await db.query(text,params)).rows,
  async statements=>db.transaction(async tx=>{const results=[];for(const s of statements)results.push((await tx.query(s.text,s.params||[])).rows);return results;}));
});
beforeEach(async()=>{await db.exec('TRUNCATE orvanta_workflow.booking_offers CASCADE; TRUNCATE orvanta_workflow.enquiries CASCADE');created=[];busy=[];provider={verifyCalendar:async()=>{},busy:async()=>busy,create:async r=>{created.push(r);return 'provider_'+r.booking_id;},find:async()=>null};});
after(async()=>db.close());
const tool=(path,args,call='call_synthetic',custom=provider,customEnv=env)=>bookingTool(new TextEncoder().encode(JSON.stringify({name:'synthetic',call:{call_id:call,agent_id:'agent_synthetic'},args})),path,customEnv,store,custom,now);
const offers=async(type='callback',call='call_synthetic') => (await tool('/tools/booking-availability',{booking_type:type,date:'2026-12-03',time_zone:'America/Chicago'},call)).offers;
const confirm=(offer,call='call_synthetic',custom=provider)=>tool('/tools/booking-confirm',{confirmation_token:offer.confirmation_token,caller_confirmed:true,confirmed_local_start:offer.local_start,confirmed_time_zone:offer.time_zone,customer_name:'Alex Example',callback_number:'+12025550143'},call,custom);
test('successful booking uses a live slot, explicit confirmation, one durable receipt and one provider event',async()=>{
 const [offer]=await offers();assert.equal(offer.local_start,'2026-12-03T09:00');assert.equal(offer.time_zone,'America/Chicago');
 const result=await confirm(offer);assert.equal(result.booked,true);assert.equal(result.status,'confirmed');assert.equal(created.length,1);
 const summary=await store.summaries('call_synthetic','org_synthetic');assert.equal(summary[0].providerBookingId,result.providerBookingId);assert.equal(summary[1].status,'not_requested');
});
test('duplicate retries and concurrent confirmations create one event and stable receipt',async()=>{
 const [offer]=await offers();
 const results=await Promise.all(Array.from({length:12},()=>confirm(offer)));
 assert.equal(created.length,1);assert.equal((await db.query('SELECT * FROM orvanta_workflow.bookings')).rows.length,1);
 const again=await confirm(offer);assert.equal(again.booked,true);assert.equal(again.providerBookingId,results.find(r=>r.booked).providerBookingId);
});
test('simultaneous callers and overlapping callback/cleaning visit slots claim shared capacity only once',async()=>{
 const [a]=await offers('callback','call_a'),[b]=await offers('cleaning_visit','call_b');
 const results=await Promise.all([confirm(a,'call_a'),confirm(b,'call_b')]);
 assert.equal(results.filter(r=>r.booked).length,1);assert.equal(created.length,1);assert.equal(results.filter(r=>r.status==='unavailable').length,1);
});
test('callback and cleaning visit remain separate and can both be booked at distinct times',async()=>{
 const callback=await offers('callback');await confirm(callback[0]);
 const visits=await offers('cleaning_visit');await confirm(visits[0]);
 const summaries=await store.summaries('call_synthetic','org_synthetic');assert.deepEqual(summaries.map(r=>r.type),['callback','cleaning_visit']);
 assert.ok(summaries.every(r=>r.status==='confirmed'));assert.notEqual(summaries[0].providerBookingId,summaries[1].providerBookingId);
 assert.notEqual(summaries[0].start,summaries[1].start);
});
test('slots becoming unavailable are not booked and release the durable claim',async()=>{
 const [offer]=await offers();busy=[{start:offer.start,end:offer.end}];
 const result=await confirm(offer);assert.equal(result.status,'unavailable');assert.equal(created.length,0);
 assert.equal((await db.query('SELECT * FROM orvanta_workflow.booking_slot_claims')).rows.length,0);
});
test('calendar outage and permanent creation rejection keep enquiry capture and never announce confirmation',async()=>{
 const [offer]=await offers();
 const result=await confirm(offer,'call_synthetic',{...provider,create:async()=>{throw new CalendarError(false,'synthetic_rejection');}});
 assert.equal(result.status,'failed');assert.equal(result.booked,false);assert.equal(result.enquiryCaptureContinues,true);
 assert.equal((await db.query('SELECT * FROM orvanta_workflow.booking_slot_claims')).rows.length,0);
});
test('uncertain provider timeout retains the slot for review and never creates again on duplicate',async()=>{
 const [offer]=await offers();let attempted=0;
 const uncertain={...provider,create:async()=>{attempted++;throw new CalendarError(true,'synthetic_timeout');}};
 assert.equal((await confirm(offer,'call_synthetic',uncertain)).status,'review');
 assert.equal((await confirm(offer,'call_synthetic',uncertain)).booked,false);assert.equal(attempted,1);
 assert.equal((await db.query('SELECT * FROM orvanta_workflow.booking_slot_claims')).rows.length,15);
});
test('declining a booking retains a separate declined outcome and leaves provider untouched',async()=>{
 const result=await tool('/tools/booking-decline',{booking_type:'cleaning_visit'});assert.equal(result.status,'declined');assert.equal(created.length,0);
 const summary=await store.summaries('call_synthetic','org_synthetic');assert.equal(summary[1].status,'declined');assert.equal(summary[0].status,'not_requested');
});
test('missing confirmation, mismatched timezone, expired or other-call tokens cannot book',async()=>{
 const [offer]=await offers();
 await assert.rejects(tool('/tools/booking-confirm',{confirmation_token:offer.confirmation_token,caller_confirmed:false}),/confirmation_required/);
 await assert.rejects(confirm({...offer,time_zone:'UTC'}),/confirmation_required/);
 await assert.rejects(confirm(offer,'call_other'),/not_for_this_call/);
 await db.query("UPDATE orvanta_workflow.booking_offers SET expires_at='2026-11-24T00:00:00Z'");
 await assert.rejects(confirm(offer),/offer_expired/);assert.equal(created.length,0);
});
test('disabled booking needs no calendar credentials and does not affect enquiry processing',async()=>{
 const result=await tool('/tools/booking-availability',{},'call_synthetic',provider,{...env,BOOKING_ENABLED:'false',GOOGLE_SERVICE_ACCOUNT_JSON:undefined});
 assert.equal(result.status,'disabled');assert.equal(created.length,0);
});
test('server configuration fixes the calendar, rejects primary and keeps office hours and DST explicit',()=>{
 assert.throws(()=>bookingConfig({...env,GOOGLE_CALENDAR_ID:'primary'}));
 const config=bookingConfig(env);
 assert.equal(daySlots('2026-12-05','callback',config,now).length,0);
 const summer=daySlots('2027-01-25','cleaning_visit',config,now)[0];assert.equal(localDateTime(summer.start,config.timeZone),'2027-01-25T09:00');
 assert.throws(()=>daySlots('tomorrow','callback',config,now));
 const february=Date.parse('2027-02-01T00:00:00Z');
 assert.equal(daySlots('2027-03-12','callback',config,february)[0].start,'2027-03-12T15:00:00.000Z');
 assert.equal(daySlots('2027-03-15','callback',config,february)[0].start,'2027-03-15T14:00:00.000Z');
});
test('booking summaries include trusted type/status/time zone/provider ID with escaped HTML; dates remain distinct',async()=>{
 const [offer]=await offers();await confirm(offer);
 const fields={customer_name:'<script>',callback_number:'02108',service_requested:null,zip_code:'02108',property_details:null,preferred_date:'December 3, morning',cleaning_notes:null,callback_preference:'November 27, 10–12',follow_up_needed:true};
 const email=renderEmail(fields,'call_synthetic','enquiries@notify.getorvanta.xyz','julianahonour@gmail.com',await store.summaries('call_synthetic','org_synthetic'));
 assert.match(email.text,/Booking type: Callback/);assert.match(email.text,/Booking status: confirmed/);assert.match(email.text,/America\/Chicago/);assert.match(email.text,/Provider booking ID: provider_/);
 assert.match(email.text,/December 3, morning/);assert.match(email.text,/November 27, 10–12/);assert.doesNotMatch(email.html,/<script>/);assert.match(email.html,/&lt;script&gt;/);
 assert.deepEqual(email.to,['julianahonour@gmail.com']);
});
test('requested time ranges, unavailable calendars and failed availability are persisted accurately',async()=>{
 const result=await tool('/tools/booking-availability',{booking_type:'callback',date:'2026-12-03',time_zone:'America/Chicago',time_from:'14:00',time_to:'15:00'});
 assert.equal(result.offers[0].local_start,'2026-12-03T14:00');
 busy=[{start:'2026-12-03T00:00:00Z',end:'2026-12-04T23:00:00Z'}];
 assert.equal((await tool('/tools/booking-availability',{booking_type:'cleaning_visit',date:'2026-12-03',time_zone:'America/Chicago'})).status,'unavailable');
 assert.equal((await store.summaries('call_synthetic','org_synthetic'))[1].status,'unavailable');
 provider.verifyCalendar=async()=>{throw new Error('synthetic_unavailable');};
 assert.equal((await tool('/tools/booking-availability',{booking_type:'callback',date:'2026-12-03',time_zone:'America/Chicago'})).status,'failed');
 assert.equal((await store.summaries('call_synthetic','org_synthetic'))[0].status,'failed');
});
test('a declined offer cannot be confirmed later; interrupted creations retain capacity for review',async()=>{
 const [offer]=await offers();await tool('/tools/booking-decline',{booking_type:'callback'});
 assert.equal((await confirm(offer)).status,'declined');assert.equal(created.length,0);
 const [next]=await offers('callback','call_interrupted');
 const stored=await store.getOffer(next.confirmation_token,'call_interrupted','agent_synthetic','org_synthetic');
 await store.claim(stored,'Alex Example','+12025550143');
 await db.exec("UPDATE orvanta_workflow.bookings SET created_at=now()-interval '3 minutes'");await store.markInterrupted();
 assert.equal((await store.existing('call_interrupted','callback','org_synthetic')).status,'review');
 assert.equal((await db.query('SELECT * FROM orvanta_workflow.booking_slot_claims')).rows.length,15);
});
const signed=(path,payload,valid=true)=>{const raw=JSON.stringify(payload),timestamp=Date.now(),digest=createHmac('sha256',env.RETELL_API_KEY).update(raw+timestamp).digest('hex');return new Request('https://synthetic.invalid'+path,{method:'POST',headers:{'content-type':'application/json','x-retell-signature':valid?`v=${timestamp},d=${digest}`:'invalid'},body:raw});};
test('booking HTTP endpoints reject invalid signatures and unknown agents and preserve disabled behavior',async()=>{
 const call={call_id:'call_synthetic',agent_id:'agent_synthetic'};
 const request=(payload,valid)=>signed('/tools/booking-availability',payload,valid);
 assert.equal((await handleRequest(request({call,args:{}},false),env,undefined,()=>store)).status,401);
 assert.equal((await handleRequest(request({call:{...call,agent_id:'agent_unknown'},args:{}},true),env,undefined,()=>store)).status,403);
 assert.equal((await (await handleRequest(request({call,args:{}},true),{...env,BOOKING_ENABLED:'false'})).json()).status,'disabled');
});
test('retired Google records cannot pollute the preserved enquiry email',async()=>{
 const [offer]=await offers();await confirm(offer,'call_synthetic',{...provider,create:async()=>{throw new CalendarError(false,'synthetic');}});
 const enquiryStore=new PostgresStore(async(text,params=[]) => (await db.query(text,params)).rows);
 const payload={event:'call_analyzed',call:{call_id:'call_synthetic',agent_id:'agent_synthetic',call_analysis:{custom_analysis_data:{customer_name:'Alex Example',preferred_date:'December 3',callback_preference:'November 27',recipient:'attacker@invalid.test',booking_status:'confirmed',provider_booking_id:'invented'}}}};
 const response=await handleRequest(signed('/webhooks/retell',payload),env,()=>enquiryStore,()=>store);
 assert.equal(response.status,204);
 assert.equal((await db.query('SELECT * FROM orvanta_workflow.enquiries')).rows.length,1);
 const email=(await db.query('SELECT payload FROM orvanta_workflow.notification_outbox')).rows[0].payload;
 assert.doesNotMatch(email.text,/Booking status:/);assert.match(email.text,/not a confirmed booking/);assert.doesNotMatch(email.text,/invented|attacker/);assert.deepEqual(email.to,['julianahonour@gmail.com']);
 const summary=await processBatch(enquiryStore,'synthetic',async()=>Response.json({id:'synthetic_email'}));assert.equal(summary.accepted,1);
});
