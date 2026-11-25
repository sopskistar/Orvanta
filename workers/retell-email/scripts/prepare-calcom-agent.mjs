import fs from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {loadConfig} from '../src/config.ts';
import {retellClient} from './retell-client.mjs';
import {calcomPrompt,resolveCalcomTool,GREETING,EVENT_LINKS,TOOL_NAMES} from './calcom-agent-config.mjs';
const file=new URL('../.private/calcom-agent-review.json',import.meta.url);
let stage='validate';
try {
 if(process.argv.includes('--publish'))throw new Error('acceptance_gated_release_required');
 const config=loadConfig(process.env);if(config.routes.size!==1)throw new Error('ambiguous_agent');
 const id=[...config.routes.keys()][0],api=retellClient();
 await fs.mkdir(new URL('../.private/',import.meta.url),{recursive:true,mode:0o700});
 try{await fs.access(file);throw new Error('existing_review_preserved');}catch(e){if(e.code!=='ENOENT')throw e;}
 const apps=await api('list-apps?limit=100');
 const matches=apps.items.filter(a=>a.org_id===config.workspaceId&&a.provider==='calcom'&&a.name==='Cal.com - OAuth'&&a.connection_status==='connected');
 if(apps.has_more||matches.length!==1)throw new Error('oauth_connection_ambiguous');
 const appId=matches[0].app_id;
 const base=await api(`get-agent/${id}?version=5`);
 if(!base.is_published||base.response_engine.type!=='retell-llm')throw new Error('published_v5_required');
 const llm=await api(`get-retell-llm/${base.response_engine.llm_id}?version=${base.response_engine.version}`);
 if(llm.begin_message!==GREETING||llm.start_speaker!=='agent'||(llm.general_tools||[]).some(t=>t.type!=='end_call'))throw new Error('v5_protected_baseline_changed');
 const prompt=calcomPrompt(llm.general_prompt),tools=[];
 stage='resolve_oauth_tools';
 for(const type of ['callback','cleaning_visit'])for(const operation of ['availability','booking']){
  const tool=await resolveCalcomTool(api,appId,type,operation);delete tool._response_schema;tools.push(tool);
 }
 const numbers=await api('v2/list-phone-numbers?limit=100');
 const number=numbers.items.find(n=>n.phone_number.endsWith('6003'));
 if(numbers.has_more||!number||number.inbound_agents?.length!==1||number.inbound_agents[0].agent_id!==id||number.inbound_agents[0].agent_version!==5)throw new Error('phone_must_remain_on_v5');
 stage='create_isolated_draft';
 const draft=await api(`create-agent-version/${id}`,'POST',{base_version:5});
 // Save the newly created version immediately. A later failure must not lead
 // to silently creating another draft or overwriting newer account work.
 const review={id,appId,base,llmBase:llm,draft,stage:'created',eventLinks:EVENT_LINKS,phoneSuffix:'6003',acceptancePassed:false};
 await fs.writeFile(file,JSON.stringify(review,null,2),{flag:'wx',mode:0o600});
 stage='configure_draft';
 await api(`update-retell-llm/${draft.response_engine.llm_id}?version=${draft.response_engine.version}`,'PATCH',{general_prompt:prompt,general_tools:[...(llm.general_tools||[]),...tools]});
 const saved=await api(`get-agent/${id}?version=${draft.version}`);
 const changed=await api(`get-retell-llm/${saved.response_engine.llm_id}?version=${saved.response_engine.version}`);
 if(saved.is_published||changed.begin_message!==GREETING||changed.start_speaker!=='agent'||!isDeepStrictEqual(saved.post_call_analysis_data,base.post_call_analysis_data)||saved.webhook_url!==base.webhook_url||!isDeepStrictEqual(saved.webhook_events,base.webhook_events))throw new Error('protected_configuration_changed');
 const eventTypes={};
 for(const type of ['callback','cleaning_visit']){
  const ids=['availability','booking'].map(operation=>{
   const tool=changed.general_tools.find(t=>t.name===TOOL_NAMES[type][operation]);
   if(tool.type!=='integration_app'||tool.app_id!==appId||tool.provider!=='calcom')throw new Error('oauth_tool_binding_mismatch');
   const id=String(tool.parameters[0]?.properties?.event_type_id?.const||'');
   if(!/^\d+$/.test(id))throw new Error('numeric_event_id_not_resolved');return id;
  });
  if(ids[0]!==ids[1])throw new Error('event_type_binding_mismatch');
  eventTypes[type]={id:ids[0],linkId:EVENT_LINKS[type],minutes:type==='callback'?15:120};
 }
 const after=await api('get-phone-number/'+encodeURIComponent(number.phone_number));
 if(!isDeepStrictEqual(after.inbound_agents,number.inbound_agents))throw new Error('phone_assignment_changed');
 Object.assign(review,{draft:saved,llm:changed,stage:'reviewed',runtimeConfig:{appId,agentId:id,versions:[saved.version],timeZone:'America/Chicago',eventTypes},protectedConfigurationVerified:true});
 await fs.writeFile(file,JSON.stringify(review,null,2),{mode:0o600});
 console.log(JSON.stringify({draftVersion:saved.version,published:false,phoneVersion:5,greetingPreserved:true,extractionAndWebhookPreserved:true,eventTypeIds:Object.fromEntries(Object.entries(eventTypes).map(([k,v])=>[k,v.id])),bookingOperational:false}));
}catch(e){console.error(JSON.stringify({calcomDraftIncomplete:true,stage,code:/^[a-z0-9_]+$/.test(e.message)?e.message:'request_failed',secretsPrinted:false}));process.exitCode=1;}
