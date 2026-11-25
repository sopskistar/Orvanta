import type {Env} from './types.ts';
import type {BookingType} from './booking-types.ts';
export const CALCOM_TOOLS={callback:{availability:'callback_availability',booking:'callback_booking'},cleaning_visit:{availability:'cleaning_availability',booking:'cleaning_booking'}} as const;
export interface CalcomConfig {
 appId:string;agentId:string;versions:number[];llmId:string;llmVersion:number;timeZone:'America/Chicago';
 eventTypes:Record<BookingType,{id:string;linkId:string;minutes:number}>;
}
export function calcomConfig(env:Env):CalcomConfig {
 if(env.BOOKING_ENABLED==='true')throw new Error('direct_google_writer_retired');
 const c=JSON.parse(env.CALCOM_CONFIG_JSON||'null');
 if(!c||!/^app_[a-zA-Z0-9]+$/.test(c.appId)||!/^agent_[a-zA-Z0-9]+$/.test(c.agentId)||!/^llm_[a-zA-Z0-9]+$/.test(c.llmId)||!Number.isInteger(c.llmVersion)||
   !Array.isArray(c.versions)||!c.versions.length||c.versions.some((n:unknown)=>!Number.isInteger(n)||Number(n)<=5)||c.timeZone!=='America/Chicago')throw new Error('calcom_configuration_invalid');
 for(const [type,minutes]of [['callback',15],['cleaning_visit',120]] as const){
  const event=c.eventTypes?.[type];
  if(!event||!/^\d+$/.test(event.id)||event.minutes!==minutes||typeof event.linkId!=='string')throw new Error('calcom_event_type_invalid');
 }
 if(c.eventTypes.callback.id===c.eventTypes.cleaning_visit.id)throw new Error('calcom_event_types_must_differ');
 return c;
}
export function verifyCalcomTools(llm:Record<string,unknown>,config:CalcomConfig) {
 const tools=llm.general_tools;
 if(!Array.isArray(tools)||tools.length!==5)throw new Error('reviewed_tools_changed');
 for(const type of ['callback','cleaning_visit'] as const)for(const operation of ['availability','booking'] as const){
  const tool=tools.find(t=>t.name===CALCOM_TOOLS[type][operation]);
  if(!tool||tool.type!=='integration_app'||tool.provider!=='calcom'||tool.app_id!==config.appId||
   tool.app_tool_template_name!==(operation==='availability'?'check_calcom_availability':'book_calcom_appointment'))throw new Error('calcom_tool_binding_changed');
  const props=Object.assign({},...(tool.parameters||[]).map((p:{properties:object})=>p.properties));
  if(String(props.event_type_id?.const)!==config.eventTypes[type].id||props.timezone?.const!==config.timeZone)throw new Error('calcom_fixed_inputs_changed');
  if(operation==='booking'&&(props.email?.const!=='julianahonour@gmail.com'||!Array.isArray(props.guests?.const)||props.guests.const.length))throw new Error('calcom_test_recipient_changed');
 }
 if(!tools.some(t=>t.name==='end_call'&&t.type==='end_call'))throw new Error('protected_end_call_changed');
}
