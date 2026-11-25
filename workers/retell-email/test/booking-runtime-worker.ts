// Local smoke-test entrypoint only. Production uses src/index.ts.
import worker from '../src/index.ts';
import {parseCalcomEvidence} from '../src/calcom-evidence.ts';
import type {CalcomConfig} from '../src/calcom-config.ts';
import type {Env} from '../src/types.ts';
export default {
 ...worker,
 async fetch(request:Request,env:Env){
  if(new URL(request.url).pathname!=='/__test/calcom-evidence')return worker.fetch(request,env);
  const config:CalcomConfig={appId:'app_synthetic',agentId:'agent_synthetic',versions:[7],llmId:'llm_synthetic',llmVersion:7,timeZone:'America/Chicago',eventTypes:{callback:{id:'111',linkId:'synthetic',minutes:15},cleaning_visit:{id:'222',linkId:'synthetic2',minutes:120}}};
  const records=parseCalcomEvidence({transcript_with_tool_calls:[{role:'tool_call_invocation',type:'integration_app',name:'callback_booking',tool_call_id:'tool_synthetic',arguments:'{}'},
   {role:'tool_call_result',tool_call_id:'tool_synthetic',successful:true,content:JSON.stringify({status:'success',data:{uid:'synthetic_uid',status:'accepted',eventTypeId:111,start:'2026-12-08T15:00:00Z',end:'2026-12-08T15:15:00Z',attendees:[{email:'julianahonour@gmail.com',timeZone:'America/Chicago'}]}})}]},config);
  return Response.json({receiptVerified:records[0].status==='confirmed',providerRequestsStubbed:true,realBookingsCreated:0,zoneSupported:new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',hour:'numeric'}).format(new Date(records[0].start!)).includes('9')});
 },
};
