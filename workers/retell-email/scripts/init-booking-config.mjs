import fs from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const file=new URL('../.env.local',import.meta.url);
let stage='git_ignore_check';
try {
 execFileSync('git',['check-ignore','--quiet',file.pathname]);
 stage='review_file';
 const review=JSON.parse(await fs.readFile(new URL('../.private/calcom-agent-review.json',import.meta.url),'utf8'));
 if(review.stage!=='reviewed'||!review.protectedConfigurationVerified)throw new Error('reviewed_calcom_draft_required');
 const config={...review.runtimeConfig,llmId:review.draft.response_engine.llm_id,llmVersion:review.draft.response_engine.version};
 const content=await fs.readFile(file,'utf8');
 stage='append_missing_entries';
 const additions={CALCOM_BOOKING_ENABLED:'false',CALCOM_CONFIG_JSON:JSON.stringify(config)};
 const lines=[];
 for(const [key,value]of Object.entries(additions))if(!new RegExp('^'+key+'=','m').test(content))lines.push(`${key}='${value}'`);
 if(lines.length)await fs.appendFile(file,'\n# Cal.com OAuth evidence; booking writes run only in Retell.\n'+lines.join('\n')+'\n');
 await fs.chmod(file,0o600);
 console.log(JSON.stringify({privateConfigurationPrepared:true,existingValuesPreserved:true,addedVariableNames:lines.map(l=>l.slice(0,l.indexOf('='))),secretsPrinted:false}));
}catch(e){console.error(JSON.stringify({configurationInitializationIncomplete:true,stage,code:/^[A-Z0-9_]+$/.test(e.code||'')?e.code:null,secretsPrinted:false}));process.exitCode=1;}
