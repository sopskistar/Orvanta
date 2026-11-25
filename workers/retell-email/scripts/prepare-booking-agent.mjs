import fs from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {preflight} from './preflight.mjs';
import {bookingTools,bookingPrompt,POLICY_MARKER} from './booking-agent-config.mjs';
import {loadConfig} from '../src/config.ts';
let stage='preflight';
try {
 if(process.env.BOOKING_ENABLED!=='true')throw new Error('enable_booking_only_after_private_setup');
 await preflight();
 const origin=new URL(process.env.WORKER_URL).origin;
 const check=await fetch(origin+'/admin/booking-check',{method:'POST',headers:{Authorization:`Bearer ${process.env.PROCESSING_TOKEN}`},signal:AbortSignal.timeout(15000)});
 if(!check.ok||!(await check.json()).dedicatedDemoCalendarVerified)throw new Error('enabled_worker_not_verified');
 const config=loadConfig(process.env);if(config.routes.size!==1)throw new Error('ambiguous_agent');
 const id=[...config.routes.keys()][0];
 const api=async(path,method='GET',body)=>{const r=await fetch('https://api.retellai.com/'+path,{method,headers:{Authorization:`Bearer ${process.env.RETELL_API_KEY}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('retell_request_failed');const text=await r.text();return text?JSON.parse(text):null;};
 const file=new URL('../.private/booking-agent-review.json',import.meta.url);
 if(!process.argv.includes('--publish')) {
  stage='prepare_draft';
  try {await fs.access(file);throw new Error('review_file_exists_preserved');}catch(error){if(error.code!=='ENOENT')throw error;}
  const list=await api(`list-agent-versions/${id}?limit=100&sort_order=descending`);
  const newest=list.items.filter(v=>v.is_published).sort((a,b)=>b.version-a.version)[0];
  const base=await api(`get-agent/${id}?version=${newest.version}`);
  if(base.response_engine.type!=='retell-llm')throw new Error('unsupported_engine');
  const llm=await api(`get-retell-llm/${base.response_engine.llm_id}?version=${base.response_engine.version}`);
  if(llm.general_prompt?.includes(POLICY_MARKER))throw new Error('booking_already_configured_review_live_version');
  if((llm.general_tools||[]).some(t=>/book|calendar|availability|appointment/i.test(t.name||t.type)))throw new Error('existing_calendar_tools_need_review');
  const prompt=bookingPrompt(llm.general_prompt),tools=[...(llm.general_tools||[]),...bookingTools(origin)];
  const draft=await api(`create-agent-version/${id}`,'POST',{base_version:base.version});
  const changed=await api(`update-retell-llm/${draft.response_engine.llm_id}?version=${draft.response_engine.version}`,'PATCH',{general_prompt:prompt,general_tools:tools});
  if(changed.begin_message!==llm.begin_message||changed.start_speaker!==llm.start_speaker||!isDeepStrictEqual(draft.post_call_analysis_data,base.post_call_analysis_data)||draft.webhook_url!==base.webhook_url||!isDeepStrictEqual(draft.webhook_events,base.webhook_events))throw new Error('protected_configuration_changed');
  await fs.mkdir(new URL('../.private/',import.meta.url),{recursive:true,mode:0o700});
  const savedDraft=await api(`get-agent/${id}?version=${draft.version}`);
  await fs.writeFile(file,JSON.stringify({id,base,draft:savedDraft,llm:changed,workerOrigin:origin},null,2),{flag:'wx',mode:0o600});
  console.log(JSON.stringify({preparedDraftVersion:draft.version,published:false,greetingPreserved:true,extractionAndWebhookPreserved:true,privateReviewFileCreated:true}));
 } else {
  stage='publish_reviewed_draft';
  const review=JSON.parse(await fs.readFile(file,'utf8'));
  if(review.id!==id||review.workerOrigin!==origin)throw new Error('review_scope_mismatch');
  const draft=await api(`get-agent/${id}?version=${review.draft.version}`);
  const llm=await api(`get-retell-llm/${draft.response_engine.llm_id}?version=${draft.response_engine.version}`);
  if(!draft.is_published&&(!isDeepStrictEqual(draft,review.draft)||!isDeepStrictEqual(llm,review.llm)))throw new Error('reviewed_draft_changed');
  if(llm.general_prompt!==review.llm.general_prompt||!isDeepStrictEqual(llm.general_tools,review.llm.general_tools)||llm.begin_message!==review.llm.begin_message||llm.start_speaker!==review.llm.start_speaker)throw new Error('reviewed_behavior_changed');
  const versions=await api(`list-agent-versions/${id}?limit=100&sort_order=descending`);
  const latest=versions.items.filter(v=>v.is_published).sort((a,b)=>b.version-a.version)[0];
  if(latest.version!==(draft.is_published?draft.version:review.base.version))throw new Error('published_baseline_changed');
  const numbers=await api('v2/list-phone-numbers?limit=100');
  const matches=numbers.items.filter(n=>n.inbound_agents?.length===1&&n.inbound_agents[0].agent_id===id&&n.inbound_agents[0].weight===1);
  if(numbers.has_more||matches.length!==1)throw new Error('ambiguous_inbound_number');
  const numberPath=encodeURIComponent(matches[0].phone_number),before=await api('get-phone-number/'+numberPath);
  if(!draft.is_published)await api(`publish-agent-version/${id}`,'POST',{version:draft.version});
  const published=await api(`get-agent/${id}?version=${draft.version}`);
  if(!published.is_published||!isDeepStrictEqual(published.post_call_analysis_data,review.base.post_call_analysis_data)||published.webhook_url!==review.base.webhook_url)throw new Error('published_readback_mismatch');
  const inbound=before.inbound_agents.map(a=>({...a,agent_version:published.version}));
  await api('update-phone-number/'+numberPath,'PATCH',{inbound_agents:inbound});
  const after=await api('get-phone-number/'+numberPath);
  if(!isDeepStrictEqual(after.inbound_agents,inbound))throw new Error('inbound_readback_mismatch');
  if(Object.keys({...before,...after}).some(k=>!['inbound_agents','last_modification_timestamp'].includes(k)&&!isDeepStrictEqual(before[k]??null,after[k]??null)))throw new Error('other_number_setting_changed');
  console.log(JSON.stringify({publishedVersion:published.version,inboundVersion:published.version,greetingPreserved:true,extractionAndWebhookPreserved:true,bookingOperational:false,nextStep:'Run the synthetic live calendar and inbox acceptance tests.'}));
 }
}catch{console.error(JSON.stringify({bookingAgentSetupIncomplete:true,stage,secretValuesPrinted:false,noOperationalClaim:true}));process.exitCode=1;}
