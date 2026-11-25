import fs from 'node:fs/promises';
import {isDeepStrictEqual} from 'node:util';
import {retellClient} from './retell-client.mjs';
import {GREETING} from './calcom-agent-config.mjs';
try{
 const r=JSON.parse(await fs.readFile(new URL('../.private/calcom-agent-review.json',import.meta.url),'utf8')),api=retellClient();
 const draft=await api(`get-agent/${r.id}?version=${r.draft.version}`),llm=await api(`get-retell-llm/${draft.response_engine.llm_id}?version=${draft.response_engine.version}`);
 const numbers=await api('v2/list-phone-numbers?limit=100'),number=numbers.items.find(n=>n.phone_number.endsWith('6003'));
 const result={draftVersion:draft.version,published:draft.is_published,greetingPreserved:llm.begin_message===GREETING&&llm.start_speaker==='agent',reviewedToolsAndPromptMatch:isDeepStrictEqual(llm.general_tools,r.llm.general_tools)&&llm.general_prompt===r.llm.general_prompt,
 extractionPreserved:isDeepStrictEqual(draft.post_call_analysis_data,r.base.post_call_analysis_data),webhookPreserved:draft.webhook_url===r.base.webhook_url&&isDeepStrictEqual(draft.webhook_events,r.base.webhook_events),phoneVersion:number?.inbound_agents?.[0]?.agent_version,phoneStillOnV5:number?.inbound_agents?.length===1&&number.inbound_agents[0].agent_id===r.id&&number.inbound_agents[0].agent_version===5,operational:false};
 console.log(JSON.stringify(result));if(numbers.has_more||result.published||!result.greetingPreserved||!result.reviewedToolsAndPromptMatch||!result.extractionPreserved||!result.webhookPreserved||!result.phoneStillOnV5)process.exitCode=1;
}catch{console.error('Draft read-back incomplete. No private prompt, call details or credentials printed.');process.exitCode=1;}
