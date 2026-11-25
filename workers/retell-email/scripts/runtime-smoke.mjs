import { createHmac } from 'node:crypto';
import assert from 'node:assert/strict';
const origin = 'http://127.0.0.1:8790';
const key = 'synthetic-signing-key-only';
async function send(payload, expected, signature = true) {
  const raw = JSON.stringify(payload), timestamp = Date.now();
  const digest = createHmac('sha256', key).update(raw + timestamp).digest('hex');
  const response = await fetch(origin + '/webhooks/retell', { method: 'POST', body: raw,
    headers: { 'content-type': 'application/json', 'x-retell-signature': signature ? `v=${timestamp},d=${digest}` : 'invalid' } });
  assert.equal(response.status, expected);
}
assert.equal((await fetch(origin + '/health')).status, 200);
await send({event:'call_analyzed',call:{call_id:'call_synthetic',agent_id:'agent_unknown'}},403);
await send({event:'call_analyzed',call:{call_id:'call_synthetic',agent_id:'agent_unknown'}},401,false);
await send({event:'call_analyzed',call:{call_id:'call_synthetic',agent_id:'agent_synthetic',call_analysis:{custom_analysis_data:{zip_code:2108}}}},400);
await send({event:'call_ended',call:{call_id:'call_synthetic',agent_id:'agent_synthetic'}},204);
assert.equal((await fetch(origin + '/admin/process',{method:'POST'})).status,401);
const cryptoCheck=await (await fetch(origin+'/__test/calendar-crypto')).json();
assert.equal(cryptoCheck.jwtVerified,true);assert.equal(cryptoCheck.googleRequestsStubbed,true);
async function booking(payload,expected,valid=true) {
 const raw=JSON.stringify(payload),timestamp=Date.now(),digest=createHmac('sha256',key).update(raw+timestamp).digest('hex');
 const response=await fetch(origin+'/tools/booking-availability',{method:'POST',body:raw,headers:{'content-type':'application/json','x-retell-signature':valid?`v=${timestamp},d=${digest}`:'invalid'}});
 assert.equal(response.status,expected);
 if(expected===200)assert.equal((await response.json()).status,'disabled');
}
await booking({call:{call_id:'call_synthetic',agent_id:'agent_synthetic'},args:{}},200);
await booking({call:{call_id:'call_synthetic',agent_id:'agent_unknown'},args:{}},403);
await booking({call:{call_id:'call_synthetic',agent_id:'agent_synthetic'},args:{}},401,false);
console.log('10 workerd HTTP/crypto checks passed with synthetic credentials; no database, Google API or email provider was contacted.');
