import {test} from 'node:test';
import assert from 'node:assert/strict';
import {configureInputs,calcomPrompt,POLICY_MARKER,TOOL_NAMES,EVENT_LINKS} from '../scripts/calcom-agent-config.mjs';
const baseline=['Business rule: never invent prices.','- You collect enquiries; you cannot confirm appointments.','Never guarantee availability; explain that the team must confirm it.','Explain availability; do not promise a callback appointment.','What day and time would you prefer the team to call you back?'].join('\n');
test('Cal.com policy preserves the callback question and other V5 rules, replaces only conflicting booking restrictions',()=>{
 const p=calcomPrompt(baseline);assert.ok(p.includes(POLICY_MARKER));assert.match(p,/Business rule: never invent prices/);assert.match(p,/What day and time would you prefer the team to call you back/);
 for(const phrase of ['NO actual cleaning service','NO crew dispatch','does NOT initiate an automatic outbound call','WAIT for explicit yes','Deep cleaning','at most once per type','timeout','julianahonour@gmail.com','America/Chicago'])assert.ok(p.includes(phrase),phrase);
 assert.throws(()=>calcomPrompt(p));assert.throws(()=>calcomPrompt('Changed baseline preserved'));
 assert.equal(Object.values(TOOL_NAMES).flatMap(Object.values).length,4);assert.notEqual(EVENT_LINKS.callback,EVENT_LINKS.cleaning_visit);
});
test('native schemas retain required fields and pin event type, timezone, attendee email and no guests',()=>{
 const schema={type:'object',properties:Object.fromEntries(['time','timezone','name','email','location','guests','attendeePhoneNumber','notes','rescheduleReason'].map(name=>[name,{type:name==='guests'?'array':'string'}])),required:['time','timezone','name','email','location']};
 for(const type of ['callback','cleaning_visit']){
  const result=configureInputs(schema,{type,operation:'booking',round:1});assert.deepEqual(result.required,schema.required);assert.equal(result.properties.email.const,'julianahonour@gmail.com');assert.equal(result.properties.timezone.const,'America/Chicago');assert.deepEqual(result.properties.guests.const,[]);assert.equal(result.properties.rescheduleReason,undefined);assert.equal(result.properties.notes,undefined);
  assert.match(result.properties.time.description,/explicit yes/);assert.match(result.properties.location.description,type==='callback'?/phone number/:/address/);
 }
 assert.equal(schema.properties.email.const,undefined,'Do not mutate the provider schema.');
});
