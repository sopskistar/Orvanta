import {test,before} from 'node:test';
import assert from 'node:assert/strict';
import {GoogleCalendar} from '../src/booking-google.ts';
let account,publicKey;
const config=()=>({calendarId:'synthetic@group.calendar.google.com',timeZone:'America/Chicago',callbackMinutes:15,cleaningMinutes:120,serviceAccount:account});
const record={booking_id:'9f782c47-6bb7-4cd4-8f83-d552e988aba0',call_id:'call_synthetic',booking_type:'callback',starts_at:'2026-12-03T15:00:00Z',ends_at:'2026-12-03T15:15:00Z',time_zone:'America/Chicago',customer_name:'Alex Example',callback_number:'+12025550143'};
before(async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 publicKey=pair.publicKey;
 const bytes=new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey));
 account={client_email:'synthetic@demo.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\n'+Buffer.from(bytes).toString('base64')+'\n-----END PRIVATE KEY-----'};
});
test('Workers-compatible Web Crypto signs service-account JWTs, pins Google hosts and creates verified idempotent events without attendees',async()=>{
 let saved,tokenCalls=0,creates=0;
 const client=new GoogleCalendar(config(),async(url,options)=>{
  if(url==='https://oauth2.googleapis.com/token'){
   tokenCalls++;const [head,payload,sig]=options.body.get('assertion').split('.');
   assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',publicKey,Buffer.from(sig,'base64url'),Buffer.from(head+'.'+payload)),true);
   const claim=JSON.parse(Buffer.from(payload,'base64url'));assert.equal(claim.aud,url);assert.match(claim.scope,/calendar\.freebusy/);
   return Response.json({access_token:'synthetic_access',expires_in:3600});
  }
  assert.ok(url.startsWith('https://www.googleapis.com/calendar/v3/'));
  assert.equal(options.headers.Authorization,'Bearer synthetic_access');
  if(url.endsWith('/freeBusy'))return Response.json({calendars:{[config().calendarId]:{busy:[]}}});
  if(url.includes('/events?')){creates++;saved={...JSON.parse(options.body),status:'confirmed'};assert.equal(url.endsWith('sendUpdates=none'),true);assert.equal(saved.attendees,undefined);assert.equal(saved.reminders.useDefault,false);return Response.json(saved);}
  if(url.includes('/events/'))return Response.json(saved);
  return Response.json({id:config().calendarId,summary:'Sample Home Cleaning Demo',timeZone:'America/Chicago'});
 });
 await client.verifyCalendar();assert.deepEqual(await client.busy(record.starts_at,record.ends_at),[]);
 assert.equal(await client.create(record),'orvanta9f782c476bb74cd48f83d552e988aba0');assert.equal(creates,1);assert.equal(tokenCalls,1);
});
test('wrong demo calendar identity, partial free/busy errors and pre-existing mismatched event IDs never confirm',async()=>{
 const auth=()=>Response.json({access_token:'synthetic',expires_in:3600});
 const wrong=new GoogleCalendar(config(),async url=>url.includes('/token')?auth():Response.json({id:config().calendarId,summary:'Personal calendar',timeZone:'America/Chicago'}));
 await assert.rejects(wrong.verifyCalendar(),/demo_calendar_mismatch/);
 const partial=new GoogleCalendar(config(),async url=>url.includes('/token')?auth():Response.json({calendars:{[config().calendarId]:{errors:[{reason:'synthetic'}],busy:[]}}}));
 await assert.rejects(partial.busy(record.starts_at,record.ends_at),/availability_failed/);
 const collision=new GoogleCalendar(config(),async url=>url.includes('/token')?auth():Response.json({id:'wrong',status:'confirmed'}));
 await assert.rejects(collision.find(record),/event_mismatch/);
});
