export const POLICY_MARKER='ORVANTA CAL.COM DEMO BOOKING RULES v2';
export const GREETING='Hi, you’ve reached the Sample Home Cleaning demo. I’m Mia, an AI assistant. How can I help?';
export const EVENT_LINKS={callback:'1cGor7T7gRA6iJPHp7oqbp',cleaning_visit:'1cGor7T7gxwuc12axZjqG4'};
export const TOOL_NAMES={callback:{availability:'callback_availability',booking:'callback_booking'},cleaning_visit:{availability:'cleaning_availability',booking:'cleaning_booking'}};
const zone='America/Chicago';

export function configureInputs(schema,{type,operation,linkId,round}) {
 const configured=structuredClone(schema);
 for(const [name,field]of Object.entries(configured.properties)) {
  if(name==='event_type_id'){field.const=linkId;field.selected_input_mode='const_value';}
  else if(name==='timezone'){field.const=zone;field.selected_input_mode='const_value';}
  else if(name==='email'){
   // Test-stage attendee notifications cannot escape the explicitly allowed inbox.
   field.const='julianahonour@gmail.com';field.selected_input_mode='const_value';
  } else if(name==='attendee_language'){field.const='en';field.selected_input_mode='const_enum';}
  else if(name==='guests'){field.const=[];field.selected_input_mode='const_value';}
  else {
   field.selected_input_mode='description_custom';delete field.const;
   const guidance={
    start_time:'Caller-confirmed start of the search window as local YYYY-MM-DDTHH:mm:ss in America/Chicago. Resolve the full date and year; never strip a UTC offset to convert a time.',
    end_time:'End of that same caller-confirmed search window as local YYYY-MM-DDTHH:mm:ss in America/Chicago. Weekends are unavailable.',
    time:'Use only a slot returned by the latest live availability check for THIS booking type. Convert its instant to local America/Chicago YYYY-MM-DDTHH:mm:ss. First read back type, full date/year, start/end time and Austin/Central timezone and wait for explicit yes. Never retry creation after a timeout or repeat a successful booking.',
    name:'Full synthetic attendee name explicitly confirmed by the caller before booking.',
    attendeePhoneNumber:'Caller-confirmed synthetic phone number in E.164 format. Keep it separate from booking times. Never initiate an outbound call.',
    location:type==='callback'?'Caller-confirmed callback phone number in E.164 format. This reserves time for the business to call; no automatic outbound calls.':'Caller-confirmed synthetic full street address for a standard-cleaning DEMONSTRATION appointment. No real cleaning or crew dispatch.',
    title:type==='callback'?'Sample Home Cleaning DEMO callback':'Sample Home Cleaning DEMO standard cleaning',
    notes:'Synthetic demonstration only; no cleaning service or crew dispatch. Do not include transcripts, secrets or unconfirmed dates.',
    rescheduleReason:'Leave blank; this demo does not reschedule existing bookings.',
   };
   if(guidance[name])field.description=guidance[name];
  }
 }
 // Optional inputs are retained only when needed and understood. No inferred
 // guests, reschedule parameters or caller-selected recipients are sent.
 if(operation==='booking'&&round>0)for(const name of Object.keys(configured.properties)){
  if(!(configured.required||[]).includes(name)&&!['attendeePhoneNumber','attendee_language','guests'].includes(name))delete configured.properties[name];
 }
 return configured;
}

export async function resolveCalcomTool(api,appId,type,operation) {
 const template=operation==='availability'?'check_calcom_availability':'book_calcom_appointment';
 const parameters=[];let responseSchema;
 for(let round=0;round<5;round++){
  const result=await api('get-app-tool-schema/'+appId,'POST',{app_tool_template_name:template,parameters});
  if(result.input_schema)parameters.push(configureInputs(result.input_schema,{type,operation,linkId:EVENT_LINKS[type],round}));
  if(result.response_schema)responseSchema=result.response_schema;
  if(result.complete){
   // Submit the final schema too: it can expose a response schema after all
   // required attendee fields have been resolved against this event type.
   const final=await api('get-app-tool-schema/'+appId,'POST',{app_tool_template_name:template,parameters});
   responseSchema=final.response_schema||responseSchema;
   return {type:'integration_app',name:TOOL_NAMES[type][operation],app_id:appId,provider:'calcom',app_tool_template_name:template,parameters,
    description:operation==='availability'?`Check live ${type==='callback'?'15-minute callback':'120-minute standard-cleaning demo'} availability only. Does not reserve or book.`:`Create ONE ${type==='callback'?'demo callback':'standard-cleaning demonstration'} only after live availability and explicit confirmation. Do not retry after success or ambiguous timeout.`,
    execution_status_variable:TOOL_NAMES[type][operation]+'_execution_status',enable_typing_sound:false,speak_during_execution:true,speak_after_execution:true,
    execution_message_description:'Say you are checking the demo calendar; nothing is confirmed yet.',
    ...(responseSchema?{_response_schema:responseSchema}:{})};
  }
 }
 throw new Error('schema_resolution_exceeded');
}

export function calcomPrompt(current) {
 if(current.includes(POLICY_MARKER))throw new Error('calcom_policy_already_present');
 let prompt=current;
 const replacements=[
  ['- You collect enquiries; you cannot confirm appointments.','- You collect enquiries. You can confirm only a verified Cal.com DEMONSTRATION appointment under the conditions below.'],
  ['Never guarantee availability; explain that the team must confirm it.','Never guarantee availability before live Cal.com booking succeeds. Quotes and real service arrangements require human follow-up.'],
  ['availability; do not promise a callback appointment.','real service arrangements; confirm a demo callback only after a successful Cal.com booking receipt.'],
 ];
 for(const [old,next]of replacements){if(!prompt.includes(old))throw new Error('v5_business_rule_baseline_changed');prompt=prompt.replace(old,next);}
 return prompt+`\n\n${POLICY_MARKER}\n`+[
  'Preserve the exact AI-first greeting and existing enquiry questions, including the proactive callback-preference question. This is the fictional Sample Home Cleaning demonstration. Before any booking, clearly explain that demo appointments provide NO actual cleaning service and NO crew dispatch. A scheduled callback reserves time for the business to call the customer; it does NOT initiate an automatic outbound call.',
  'Separate requested cleaning preferences, callback preferences, confirmed demo callbacks and confirmed demo cleaning appointments. Never copy a cleaning date into callback preference or present a preference as a reservation. Either type, both at separate times, or neither is allowed.',
  'There are precisely two bookable types: a 15-minute callback (callback_availability then callback_booking), and a 120-minute STANDARD cleaning demonstration (cleaning_availability then cleaning_booking). Deep cleaning, move-out cleaning and all other services stay enquiries for human follow-up; never substitute a standard-cleaning booking for them.',
  'Use live availability for the intended type. Both use America/Chicago (Austin/Central time), weekdays 9 AM–5 PM, no weekends. Cleaning requires two hours’ notice and a 30-minute buffer afterward. Never offer a slot outside the provider result. Ask about ambiguous dates, years and time zones; apply daylight saving through the IANA zone rather than assuming a fixed UTC offset.',
  'Collect and read back the attendee name and email, plus callback phone or cleaning address. For this acceptance-stage demo, bookings and invitations are restricted to julianahonour@gmail.com. Ask the caller to confirm that test address; if they want a different address, retain the enquiry and do not book. Confirm the callback phone in E.164 format; use a synthetic address for cleaning. Never invent missing information.',
  'Before creating EACH booking, read back the TYPE, full date including year, start AND end time and America/Chicago (Austin/Central) timezone, and ask whether that exact demo appointment is correct. WAIT for explicit yes. A confirmation for one type does not authorize the other. If any detail changes, recheck live availability and ask again.',
  'Announce success ONLY after that booking tool completes successfully AND its provider response contains a nonempty booking UID and a confirmed/accepted status. A request, availability list, extracted field, agent statement, success status without a provider UID, pending approval, error or timeout is not a confirmed booking. Read back the actual returned appointment and timezone; do not invent a booking ID or claim an invitation arrived.',
  'Call each booking function at most once per type per conversation. Never retry a successful creation. After a timeout, missing/uncertain result or ambiguous error, stop creating for that type and explain that confirmation needs human reconciliation before another attempt. Do not create a replacement appointment or change the time to bypass uncertainty. Refer existing bookings, cancellations and rescheduling to the team.',
  'When a slot is rejected as occupied with an explicit provider rejection, offer another live availability check and retain the enquiry; do not announce a booking. If the caller declines, does not give consent, or any provider fails, continue collecting all nine original enquiry fields and send the normal enquiry summary for human follow-up.',
  'In the final recap, state requested cleaning date, callback preference, actual confirmed demo callback, actual confirmed standard-cleaning demo appointment and items requiring follow-up separately. A provider pending/uncertain state remains unconfirmed. No artificial ringing or typing sound and no automatic outbound calls.',
 ].join('\n')+'\n';
}
