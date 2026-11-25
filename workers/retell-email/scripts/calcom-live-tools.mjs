import fs from 'node:fs/promises';
import {retellClient} from './retell-client.mjs';
export async function liveConversation({name,request,confirmation,create=false,env=process.env}){
 if(create&&env.RUN_CALCOM_LIVE_TESTS!=='true')throw new Error('explicit_live_creation_opt_in_required');
 const review=JSON.parse(await fs.readFile(new URL('../.private/calcom-agent-review.json',import.meta.url),'utf8'));
 if(review.stage!=='reviewed'||review.draft.is_published)throw new Error('isolated_reviewed_draft_required');
 if(!/^[a-z0-9_-]+$/.test(name))throw new Error('safe_test_name_required');
 const directory=new URL('../../../artifacts/booking-live/',import.meta.url);await fs.mkdir(directory,{recursive:true});
 const file=new URL(name+'.json',directory);
 const report={version:review.draft.version,startedAt:new Date().toISOString(),createAllowed:create,messages:[{role:'user',content:request}],completed:false};
 // A repeated command must stop for reconciliation, even if an HTTP timeout
 // hid a successful provider creation. Never overwrite an existing run file.
 await fs.writeFile(file,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
 const api=retellClient(env);
 for(let turn=0;turn<(create?3:1);turn++){
  const result=await api(`agent-playground-completion/${review.id}?version=${review.draft.version}`,'POST',{messages:report.messages});
  report.messages.push(...result.messages);await fs.writeFile(file,JSON.stringify(report,null,2),{mode:0o600});
  const attempts=result.messages.filter(m=>m.role==='tool_call_invocation'&&/_booking$/.test(m.name));
  if(attempts.length){
   if(!create||turn===0)throw new Error('booking_without_test_consent');
   report.completed=true;break;
  }
  if(!create){report.completed=true;break;}
  report.messages.push({role:'user',content:confirmation});
 }
 await fs.writeFile(file,JSON.stringify(report,null,2),{mode:0o600});
 return report;
}
export function toolResults(report){
 return report.messages.filter(m=>m.role==='tool_call_invocation').map(m=>({name:m.name,type:m.type,arguments:JSON.parse(m.arguments||'{}'),result:report.messages.find(r=>r.role==='tool_call_result'&&r.tool_call_id===m.tool_call_id)}));
}
