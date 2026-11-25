import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bookingPrompt,bookingTools,POLICY_MARKER} from '../scripts/booking-agent-config.mjs';
test('booking policy changes only the conflicting appointment rules and retains existing enquiry/callback guidance',()=>{
 const baseline=['Synthetic business rule: never invent prices.','- You collect enquiries; you cannot confirm appointments.',
  'Never guarantee availability; explain that the team must confirm it.',
  'Keep dates separate; explain that the team will confirm availability; do not promise a callback appointment.',
  'What day and time would you prefer the team to call you back?'].join('\n');
 const updated=bookingPrompt(baseline);
 assert.ok(updated.includes('Synthetic business rule: never invent prices.'));assert.ok(updated.includes('What day and time would you prefer the team to call you back?'));
 assert.ok(updated.includes(POLICY_MARKER));assert.match(updated,/booked=true, status=confirmed/);assert.match(updated,/explicit yes/);
 assert.throws(()=>bookingPrompt('Unexpected changed business prompt'),/baseline_changed/);
 assert.throws(()=>bookingPrompt(updated),/already_present/);
});
test('Retell functions use signed full-call payloads, fixed Worker URLs, no credentials and no artificial audio',()=>{
 const tools=bookingTools('https://synthetic-booking.workers.dev');
 assert.equal(tools.length,3);
 for(const tool of tools){assert.equal(tool.method,'POST');assert.equal(tool.args_at_root,false);assert.equal(tool.enable_typing_sound,false);assert.equal(tool.max_retry,0);assert.equal(tool.headers,undefined);assert.match(tool.url,/^https:\/\/synthetic-booking\.workers\.dev\/tools\/booking-/);}
 assert.deepEqual(tools[0].parameters.properties.booking_type.enum,['callback','cleaning_visit']);
 assert.deepEqual(tools[1].parameters.properties.caller_confirmed.enum,[true]);
 assert.throws(()=>bookingTools('https://untrusted.example'),/worker_origin_required/);
});
