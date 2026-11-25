import { bookingConfig, bookingType, daySlots, localDateTime, overlaps } from './booking-config.ts';
import { CalendarError, GoogleCalendar } from './booking-google.ts';
import { BookingStore } from './booking-store.ts';
import { loadConfig } from './config.ts';
import { callIdentity, RequestError } from './payload.ts';
import type { BookingOffer, CalendarProvider, BookingSummary } from './booking-types.ts';
import type { Env } from './types.ts';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export async function bookingTool(raw: Uint8Array,path: string,env: Env,
  store?:BookingStore,provider?:CalendarProvider,now=Date.now()) {
  let payload:unknown;
  try {payload=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(raw));}catch{throw new RequestError(400,'invalid_json');}
  if(!object(payload)||!object(payload.call)||!object(payload.args))throw new RequestError(400,'invalid_tool_request');
  const {callId,agentId}=callIdentity(payload.call),config=loadConfig(env);
  if(!config.routes.has(agentId))throw new RequestError(403,'agent_not_allowed');
  const args=payload.args;
  if(env.BOOKING_ENABLED!=='true')return {status:'disabled',booked:false,enquiryCaptureContinues:true};
  const calendar=bookingConfig(env),api=provider||new GoogleCalendar(calendar);
  store ||= BookingStore.connect(env.DATABASE_URL);
  const result=(summary:BookingSummary)=>({...summary,booked:summary.status==='confirmed'&&!!summary.providerBookingId,
    enquiryCaptureContinues:true,message:summary.status==='confirmed'?'The demonstration calendar event is confirmed.':'Do not announce a confirmed booking. Keep collecting the enquiry for human follow-up.'});
  if(path==='/tools/booking-decline') {
    const type=bookingType(args.booking_type);
    return result(await store.decline(callId,agentId,config.workspaceId,type,calendar.calendarId,calendar.timeZone));
  }
  if(path==='/tools/booking-availability') {
    const type=bookingType(args.booking_type);
    if(args.time_zone!==calendar.timeZone)throw new RequestError(400,'confirm_demo_timezone');
    const existing=await store.existing(callId,type,config.workspaceId);
    if(existing)return result(store.summary(existing));
    for(const key of ['time_from','time_to'])if(args[key]!==undefined&&(typeof args[key]!=='string'||!/^([01]\d|2[0-3]):[0-5]\d$/.test(args[key] as string)))throw new RequestError(400,'explicit_time_range_required');
    const slots=daySlots(args.date,type,calendar,now).filter(s=>(!args.time_from||s.localStart.slice(11)>=(args.time_from as string))&&(!args.time_to||localDateTime(s.end,calendar.timeZone).slice(11)<=(args.time_to as string)));
    if(!slots.length){await store.recordOutcome(callId,agentId,config.workspaceId,type,calendar.calendarId,calendar.timeZone,'unavailable');return {status:'unavailable',booked:false,offers:[],enquiryCaptureContinues:true};}
    let busy:{start:string;end:string}[];
    try {
      await api.verifyCalendar();
      busy=[...await api.busy(slots[0].start,slots.at(-1)!.end),...await store.reserved(slots[0].start,slots.at(-1)!.end,calendar.calendarId)];
    }catch{
      await store.recordOutcome(callId,agentId,config.workspaceId,type,calendar.calendarId,calendar.timeZone,'failed');
      return {status:'failed',booked:false,offers:[],enquiryCaptureContinues:true,message:'Calendar availability could not be verified. Keep the enquiry for human follow-up.'};
    }
    const offers=[];
    for(const slot of slots.filter(s=>!busy.some(b=>overlaps(s,b))).slice(0,3)) {
      const offer:BookingOffer={id:crypto.randomUUID(),call_id:callId,agent_id:agentId,workspace_id:config.workspaceId,booking_type:type,
        calendar_id:calendar.calendarId,time_zone:calendar.timeZone,starts_at:slot.start,ends_at:slot.end,expires_at:new Date(now+10*60000).toISOString()};
      await store.offer(offer);
      offers.push({confirmation_token:offer.id,booking_type:type,start:slot.start,end:slot.end,local_start:slot.localStart,time_zone:calendar.timeZone,
        confirmation_question:`May I book a demonstration ${type==='callback'?'callback':'cleaning visit'} on ${slot.localStart.replace('T',' at ')} through ${localDateTime(slot.end,calendar.timeZone).slice(11)} in ${calendar.timeZone}?`});
    }
    if(!offers.length)await store.recordOutcome(callId,agentId,config.workspaceId,type,calendar.calendarId,calendar.timeZone,'unavailable');
    return {status:offers.length?'available':'unavailable',booked:false,offers,enquiryCaptureContinues:true,
      message:'Offer one slot, say its booking type, full date, start/end time and time zone, and wait for explicit caller confirmation before booking. Availability is not a booking.'};
  }
  if(path!=='/tools/booking-confirm')throw new RequestError(404,'unknown_booking_tool');
  if(typeof args.confirmation_token!=='string'||!UUID.test(args.confirmation_token))throw new RequestError(400,'invalid_confirmation_token');
  const offer=await store.getOffer(args.confirmation_token,callId,agentId,config.workspaceId);
  if(!offer||offer.calendar_id!==calendar.calendarId||offer.time_zone!==calendar.timeZone)throw new RequestError(400,'offer_not_for_this_call');
  if(args.caller_confirmed!==true||args.confirmed_local_start!==localDateTime(offer.starts_at,offer.time_zone)||args.confirmed_time_zone!==offer.time_zone)throw new RequestError(400,'explicit_slot_confirmation_required');
  const previous=await store.byOffer(offer.id);
  if(previous)return result(store.summary(previous));
  if(offer.status!=='offered')return result({type:offer.booking_type,status:offer.status||'review',timeZone:offer.time_zone,start:offer.starts_at,end:offer.ends_at,providerBookingId:null});
  if(new Date(offer.expires_at).getTime()<=now||new Date(offer.starts_at).getTime()<=now)throw new RequestError(400,'offer_expired_check_availability_again');
  for(const [key,max] of [['customer_name',120],['callback_number',64]] as const)if(typeof args[key]!=='string'||!args[key].trim()||args[key].length>max)throw new RequestError(400,'customer_details_required');
  const claim=await store.claim(offer,args.customer_name as string,args.callback_number as string);
  if(!claim.record){await store.unavailableOffer(offer.id);return {status:'unavailable',booked:false,enquiryCaptureContinues:true,message:'This slot was claimed by another request. Check availability again or capture the enquiry.'};}
  const record=claim.record;
  if(!claim.owned)return result(store.summary(record));
  try {
    await api.verifyCalendar();
    const busy=await api.busy(record.starts_at,record.ends_at);
    if(busy.some(b=>overlaps({start:record.starts_at,end:record.ends_at},b))) {
      await store.finish(record.booking_id,'unavailable',null,'slot_no_longer_available');
      return result({...store.summary(record),status:'unavailable',providerBookingId:null});
    }
  }catch{
    // No creation was attempted; retrying a new offer is safe, and enquiry capture continues.
    await store.finish(record.booking_id,'failed',null,'availability_verification_failed');
    return result({...store.summary(record),status:'failed',providerBookingId:null});
  }
  let providerId:string;
  try { providerId=await api.create(record); }
  catch(error) {
    const uncertain=!(error instanceof CalendarError)||error.uncertain;
    await store.finish(record.booking_id,uncertain?'review':'failed',null,uncertain?'calendar_creation_uncertain':'calendar_creation_failed');
    return result({...store.summary(record),status:uncertain?'review':'failed',providerBookingId:null});
  }
  // If persistence fails after provider creation, leave the durable claim intact.
  // A duplicate never creates again; an explicit read-only reconciliation adopts the event.
  await store.finish(record.booking_id,'confirmed',providerId,null);
  return result({...store.summary(record),status:'confirmed',providerBookingId:providerId});
}
