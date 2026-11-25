import type {Env} from './types.ts';
import type {BookingSummary,BookingType} from './booking-types.ts';
import {calcomConfig,CALCOM_TOOLS,verifyCalcomTools,type CalcomConfig} from './calcom-config.ts';
export interface CalcomEvidence extends BookingSummary {
 toolCallId:string;eventTypeId:string;source:'retell_api_tool_result'|'verification_unavailable';reason:string|null;
}
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const json=(v:unknown):Record<string,unknown>|null=>{try{const d=typeof v==='string'?JSON.parse(v):v;return object(d)?d:null;}catch{return null;}};
const instant=(v:unknown):string|null=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT.*(?:Z|[+-]\d\d:\d\d)$/.test(v)&&Number.isFinite(Date.parse(v))?new Date(v).toISOString():null;
const uid=(v:unknown):string|null=>typeof v==='string'&&/^[a-zA-Z0-9_-]{5,160}$/.test(v)?v:null;

export function unavailableEvidence(config:CalcomConfig,reason:string):CalcomEvidence[]{
 return (['callback','cleaning_visit'] as const).map(type=>({type,status:'review',timeZone:config.timeZone,start:null,end:null,providerBookingId:null,toolCallId:'verification_'+type,eventTypeId:config.eventTypes[type].id,source:'verification_unavailable',reason}));
}

// Receives only the authenticated Get Call response, never extraction values,
// dynamic variables, caller metadata or an LLM's spoken booking claims.
export function parseCalcomEvidence(call:Record<string,unknown>,config:CalcomConfig):CalcomEvidence[]{
 const messages=call.transcript_with_tool_calls;
 if(!Array.isArray(messages))return unavailableEvidence(config,'execution_records_missing');
 const evidence:CalcomEvidence[]=[];
 for(const type of ['callback','cleaning_visit'] as const){
  let observed=false,attempted=false;
  const invocationIds=new Set<string>();
  for(const invocation of messages){
   if(!object(invocation)||invocation.role!=='tool_call_invocation'||invocation.type!=='integration_app'||typeof invocation.tool_call_id!=='string')continue;
   const isBooking=invocation.name===CALCOM_TOOLS[type].booking;
   if(!isBooking&&invocation.name!==CALCOM_TOOLS[type].availability)continue;
   if(invocationIds.has(invocation.tool_call_id))continue;invocationIds.add(invocation.tool_call_id);
   const result=messages.find(m=>object(m)&&m.role==='tool_call_result'&&m.tool_call_id===invocation.tool_call_id);
   const body=object(result)?json(result.content):null;
   const base:CalcomEvidence={type,status:'review',timeZone:config.timeZone,start:null,end:null,providerBookingId:null,toolCallId:invocation.tool_call_id,eventTypeId:config.eventTypes[type].id,source:'retell_api_tool_result',reason:null};
   if(!isBooking){
    if(attempted)continue;
    observed=true;
    if(object(result)&&result.successful===true&&Array.isArray(body?.available_slots)){
     base.status=body.available_slots.length?'offered':'unavailable';base.reason='availability_only_no_booking';
    }else{base.status='failed';base.reason='availability_failed';}
    // Availability outcomes are replaced by an actual creation attempt below.
    const old=evidence.findIndex(e=>e.type===type);if(old>=0)evidence.splice(old,1);
    evidence.push(base);continue;
   }
   if(!attempted){for(let i=evidence.length-1;i>=0;i--)if(evidence[i].type===type)evidence.splice(i,1);}
   observed=true;attempted=true;
   if(!object(result)||result.successful!==true){
    // A generic failed execution can include a transport timeout after creation.
    // It is never proof that no appointment exists; no automatic create retry.
    base.reason='creation_failed_or_uncertain';
    if(body?.status==='error'&&['SLOT_UNAVAILABLE','CONFLICT','BOOKING_CONFLICT'].includes(String(body.code))){base.status='unavailable';base.reason='provider_slot_rejected';}
    evidence.push(base);continue;
   }
   const receipt=providerReceipt(body,config,type);
   if(receipt){Object.assign(base,receipt,{status:'confirmed'});}
   else base.reason='provider_receipt_incomplete_or_unconfirmed';
   evidence.push(base);
  }
  if(!observed)evidence.push({type,status:'not_requested',timeZone:config.timeZone,start:null,end:null,providerBookingId:null,toolCallId:'no_attempt_'+type,eventTypeId:config.eventTypes[type].id,source:'retell_api_tool_result',reason:'no_verified_creation_attempt'});
 }
 // A repeated successful tool response with the same UID is one provider booking.
 const seen=new Set<string>();
 return evidence.filter(e=>{if(!e.providerBookingId)return true;const key=e.type+':'+e.providerBookingId;if(seen.has(key))return false;seen.add(key);return true;});
}

function providerReceipt(body:Record<string,unknown>|null,config:CalcomConfig,type:BookingType):Partial<CalcomEvidence>|null{
 if(!body)return null;
 // This adapter is finalized against the live Cal.com OAuth response, not
 // arbitrary recursively discovered IDs or an attendee's free-text notes.
 if(body.status!=='success'||!object(body.data))return null;
 const data=body.data;
 const id=uid(data.uid),start=instant(data.start),end=instant(data.end);
 if(!id||!start||!end||data.status!=='accepted'||Date.parse(end)-Date.parse(start)!==config.eventTypes[type].minutes*60000)return null;
 if(String(data.eventTypeId)!==config.eventTypes[type].id)return null;
 if(!Array.isArray(data.attendees)||data.attendees.length!==1||data.attendees[0]?.email!=='julianahonour@gmail.com'||data.attendees[0]?.timeZone!==config.timeZone)return null;
 return {providerBookingId:id,start,end};
}

export async function verifiedCalcomEvidence(call:Record<string,unknown>,env:Env,fetcher:typeof fetch=fetch):Promise<CalcomEvidence[]|undefined>{
 if(env.CALCOM_BOOKING_ENABLED!=='true')return undefined;
 const config=calcomConfig(env);
 if(call.agent_id!==config.agentId)return undefined;
 if(Number(call.agent_version)<=5)return undefined;
 if(!config.versions.includes(Number(call.agent_version)))return unavailableEvidence(config,'unreviewed_agent_version');
 try {
  const read=async(path:string)=>{
   const response=await fetcher('https://api.retellai.com/'+path,{headers:{Authorization:`Bearer ${env.RETELL_API_KEY}`},signal:AbortSignal.timeout(5000)});
   if(!response.ok)throw new Error('retell_execution_read_failed');
   const data:unknown=await response.json();if(!object(data))throw new Error('retell_execution_invalid');return data;
  };
  const [canonical,llm]=await Promise.all([read('v2/get-call/'+encodeURIComponent(String(call.call_id))),read(`get-retell-llm/${config.llmId}?version=${config.llmVersion}`)]);
  if(canonical.call_id!==call.call_id||canonical.agent_id!==config.agentId||!config.versions.includes(Number(canonical.agent_version))||canonical.agent_version!==call.agent_version)throw new Error('call_scope_mismatch');
  verifyCalcomTools(llm,config);
  return parseCalcomEvidence(canonical,config);
 }catch{return unavailableEvidence(config,'authenticated_execution_verification_failed');}
}
