import {calcomConfig,verifyCalcomTools} from '../src/calcom-config.ts';
import {loadConfig} from '../src/config.ts';
import {neonSql} from '../src/store.ts';
import {retellClient} from './retell-client.mjs';
export async function checkCalendar(env=process.env) {
 const c=calcomConfig(env),config=loadConfig(env),api=retellClient(env);
 if(!config.routes.has(c.agentId))throw new Error('calcom_agent_not_allowed');
 const app=await api('get-app/'+c.appId);
 if(app.provider!=='calcom'||app.org_id!==config.workspaceId||app.connection_status!=='connected')throw new Error('calcom_oauth_not_connected');
 const llm=await api(`get-retell-llm/${c.llmId}?version=${c.llmVersion}`);verifyCalcomTools(llm,c);
 const [schema]=await neonSql(env.DATABASE_URL)("SELECT to_regclass('orvanta_workflow.calcom_booking_evidence') IS NOT NULL AS ready");
 if(!schema.ready)throw new Error('calcom_evidence_migration_required');
 return {calcomOAuthConnected:true,pinnedEventTypesVerified:true,testInboxRestricted:true,timeZone:c.timeZone,evidenceSchemaVerified:true,directGoogleWriterRetired:true,bookingOperational:false};
}
if(import.meta.url===new URL(process.argv[1],'file:').href){try{console.log(JSON.stringify(await checkCalendar()));}catch{console.error('Cal.com verification incomplete. Check CALCOM_CONFIG_JSON, the existing Retell OAuth connection and migration. No Google credentials or Cal.com API key are needed.');process.exitCode=1;}}
