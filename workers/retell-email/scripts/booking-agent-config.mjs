export const POLICY_MARKER='ORVANTA DEMO BOOKING RULES v1';
export function bookingTools(origin) {
 const url=new URL(origin);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.workers.dev')||url.pathname!=='/')throw new Error('verified_worker_origin_required');
 const string=(description,extra={})=>({type:'string',description,...extra});
 const tool=(name,path,description,properties,required)=>({type:'custom',name,url:new URL(path,url).href,method:'POST',description,
  parameters:{type:'object',properties,required,additionalProperties:false},timeout_ms:45000,max_retry:0,args_at_root:false,enable_typing_sound:false,speak_during_execution:true,speak_after_execution:true,
  execution_message_description:'Say that you are checking the demo calendar. Do not say that anything is booked yet.'});
 return [
  tool('check_demo_booking_availability','/tools/booking-availability','Read live demo availability for one explicitly chosen booking type. Availability does not create a booking.',{
   booking_type:string('Choose callback for a team phone call, cleaning_visit for the separate demo cleaning visit.',{enum:['callback','cleaning_visit']}),
   date:string('The caller-confirmed full local calendar date, YYYY-MM-DD. Ask about ambiguous day, month or year; do not guess.'),
   time_zone:string('Confirm Austin/Central time with the caller.',{enum:['America/Chicago']}),
   time_from:string('Optional earliest local start in HH:mm, copied from the caller’s confirmed preference.'),
   time_to:string('Optional latest local end in HH:mm. Do not mix callback and cleaning-visit preferences.'),
  },['booking_type','date','time_zone']),
  tool('confirm_demo_booking','/tools/booking-confirm','Create only the specific offered demo appointment AFTER asking its full date, time, time zone and type and receiving explicit caller confirmation. Never call this for a declined or uncertain choice.',{
   confirmation_token:string('Copy confirmation_token exactly from the chosen availability offer. Never invent or reuse a token for a different slot or type.'),
   caller_confirmed:{type:'boolean',description:'True only after the caller explicitly confirms this exact type, date, start/end time and zone.',enum:[true]},
   confirmed_local_start:string('Copy local_start from the offer the caller explicitly confirmed.'),
   confirmed_time_zone:string('Copy time_zone from that same offer.',{enum:['America/Chicago']}),
   customer_name:string('Confirmed caller name.'),callback_number:string('Latest confirmed callback phone number, as a string; preserve formatting.'),
  },['confirmation_token','caller_confirmed','confirmed_local_start','confirmed_time_zone','customer_name','callback_number']),
  tool('decline_demo_booking','/tools/booking-decline','Record that the caller declines booking for this type. Continue capturing the enquiry. This never cancels an already-created appointment.',{
   booking_type:string('The booking type the caller declined.',{enum:['callback','cleaning_visit']}),
  },['booking_type']),
 ];
}
export function bookingPrompt(current) {
 if(current.includes(POLICY_MARKER))throw new Error('booking_policy_already_present_review_existing_version');
 let prompt=current;
 const replacements=[
  ['- You collect enquiries; you cannot confirm appointments.','- You collect enquiries. You may confirm a demonstration calendar appointment only after confirm_demo_booking returns booked=true and a providerBookingId.'],
  ['Never guarantee availability; explain that the team must confirm it.','Never guarantee availability before the booking tool succeeds. The team still confirms quotes and real service arrangements.'],
  ['availability; do not promise a callback appointment.','real service arrangements; promise a demo callback appointment only after the booking tool returns a successful provider receipt.'],
 ];
 for(const [old,next]of replacements){if(!prompt.includes(old))throw new Error('business_rule_baseline_changed_review_before_editing');prompt=prompt.replace(old,next);}
 return prompt+`\n\n${POLICY_MARKER}\n`+
 `This remains the fictional Sample Home Cleaning demonstration. A calendar booking is a DEMO appointment, not a guarantee of real cleaning service or price. Keep the existing AI-first opening and enquiry questions.\n`+
 `There are TWO separate appointment types: callback (a team phone call) and cleaning_visit (a demo cleaning visit). Ask which the caller wants. The caller may choose either, both at separate times, or neither. Never use the cleaning date as the callback date or vice versa.\n`+
 `Use check_demo_booking_availability with the confirmed full YYYY-MM-DD date and America/Chicago time zone (Austin/Central time). Ask about an ambiguous date or time instead of guessing. Use only the returned live offers; a listed opening is not a reservation or a successful booking.\n`+
 `Before confirm_demo_booking, read back the appointment TYPE, full date including year, start and end time, and America/Chicago (Austin/Central) time zone. Ask whether that exact appointment is correct. WAIT for an explicit yes. If the caller changes a detail, check availability again. Copy the chosen offer's confirmation_token, local_start and time_zone exactly; never invent one. Confirm the customer's name and latest callback number before creating the event.\n`+
 `Announce a demo booking ONLY when confirm_demo_booking returns booked=true, status=confirmed and a nonempty providerBookingId. Repeat the confirmed type, date/time and zone. Availability, offered, creating, failed, unavailable, review, disabled or a timeout are NOT confirmed bookings. Never say you have booked or sent an invitation based only on a request.\n`+
 `If no slot is available, offer a fresh live check for a different date/time or retain the enquiry for human follow-up. If a provider error, review status or timeout occurs, say that you could not confirm the booking and retain the enquiry. Do not retry with a new offer after an uncertain creation; it requires human reconciliation. A duplicate retry of the SAME token may return its existing receipt and must not create another event.\n`+
 `When the caller declines, use decline_demo_booking for that type and continue the original enquiry capture. Do not pressure them or fill missing dates. This tool is not cancellation or rescheduling; refer changes to an existing booking to the team. Never ask the caller to choose an email recipient, calendar, provider ID or integration credentials.\n`+
 `In the final recap, clearly separate requested cleaning date, preferred callback time, confirmed demo callback booking and confirmed demo cleaning-visit booking. State accurately which appointments were actually created and which need team follow-up.\n`;
}
