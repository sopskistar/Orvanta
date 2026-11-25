import type { BookingConfig, BookingRecord, CalendarProvider } from './booking-types.ts';
import {escapeHtml} from './email.ts';
const API = 'https://www.googleapis.com/calendar/v3';
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export class CalendarError extends Error {
  readonly uncertain: boolean;
  readonly code: string;
  constructor(uncertain: boolean,code: string) { super(code); this.uncertain=uncertain; this.code=code; }
}
export class GoogleCalendar implements CalendarProvider {
  private token?: {value: string; expires: number};
  private config: BookingConfig;
  private request: typeof fetch;
  constructor(config: BookingConfig,request: typeof fetch = fetch) { this.config=config; this.request=request; }
  private async bearer(): Promise<string> {
    if (this.token && this.token.expires > Date.now()+60_000) return this.token.value;
    const now = Math.floor(Date.now()/1000), encode = (v: unknown) => b64(new TextEncoder().encode(JSON.stringify(v)));
    const unsigned = encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:this.config.serviceAccount.client_email,
      scope:'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.calendars.readonly',
      aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
    const pem = this.config.serviceAccount.private_key.replace(/-----[^-]+-----|\s/g,'');
    const key = await crypto.subtle.importKey('pkcs8',Uint8Array.from(atob(pem),c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(unsigned)));
    const response = await this.request('https://oauth2.googleapis.com/token',{method:'POST',signal:AbortSignal.timeout(5000),
      headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:unsigned+'.'+b64(signature)})});
    if (!response.ok) throw new CalendarError(false,'calendar_auth_failed');
    const data = await response.json() as {access_token?:string;expires_in?:number};
    if (!data.access_token || !Number.isFinite(data.expires_in)) throw new CalendarError(false,'calendar_auth_failed');
    this.token={value:data.access_token,expires:Date.now()+Math.min(data.expires_in!,3600)*1000};
    return this.token.value;
  }
  private async api(path: string, method = 'GET', body?: unknown) {
    const token = await this.bearer();
    return this.request(API+path,{method,signal:AbortSignal.timeout(4000),headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  }
  async verifyCalendar() {
    const response = await this.api('/calendars/'+encodeURIComponent(this.config.calendarId));
    if (!response.ok) throw new CalendarError(false,'demo_calendar_unavailable');
    const calendar = await response.json() as {id?:string;summary?:string;timeZone?:string};
    if (calendar.id!==this.config.calendarId || calendar.summary!=='Sample Home Cleaning Demo' || calendar.timeZone!==this.config.timeZone) throw new CalendarError(false,'dedicated_demo_calendar_mismatch');
  }
  async busy(start: string, end: string) {
    const response = await this.api('/freeBusy','POST',{timeMin:start,timeMax:end,timeZone:this.config.timeZone,items:[{id:this.config.calendarId}]});
    if (!response.ok) throw new CalendarError(false,'calendar_availability_failed');
    const data = await response.json() as {calendars?:Record<string,{errors?:unknown[];busy?:{start:string;end:string}[]}>};
    const calendar = data.calendars?.[this.config.calendarId];
    if (!calendar || calendar.errors?.length || !Array.isArray(calendar.busy) || calendar.busy.some(b=>!Number.isFinite(Date.parse(b.start))||!Number.isFinite(Date.parse(b.end))||Date.parse(b.end)<=Date.parse(b.start))) throw new CalendarError(false,'calendar_availability_failed');
    return calendar.busy;
  }
  private eventId(record: BookingRecord) { return 'orvanta'+record.booking_id.replace(/-/g,''); }
  private eventMatches(event: Record<string, unknown>, record: BookingRecord) {
    const start=event.start as {dateTime?:string}, end=event.end as {dateTime?:string};
    const properties=event.extendedProperties as {private?:Record<string,string>};
    return event.id===this.eventId(record) && event.status==='confirmed' &&
      Date.parse(start?.dateTime||'')===Date.parse(record.starts_at) && Date.parse(end?.dateTime||'')===Date.parse(record.ends_at) &&
      properties?.private?.orvantaBookingId===record.booking_id && properties.private.bookingType===record.booking_type && properties.private.callId===record.call_id;
  }
  async find(record: BookingRecord): Promise<string|null> {
    const response = await this.api('/calendars/'+encodeURIComponent(this.config.calendarId)+'/events/'+this.eventId(record));
    if (response.status===404) return null;
    if (!response.ok) throw new CalendarError(true,'calendar_event_read_failed');
    const event=await response.json() as Record<string,unknown>;
    if (!this.eventMatches(event,record)) throw new CalendarError(true,'calendar_event_mismatch');
    return this.eventId(record);
  }
  async create(record: BookingRecord): Promise<string> {
    const body={id:this.eventId(record),summary:`Sample Home Cleaning Demo — ${record.booking_type==='callback'?'Callback':'Cleaning visit'}`,
      description:`Demonstration appointment only.\nCall ID: ${record.call_id}\nCustomer: ${escapeHtml(record.customer_name)}\nCallback number: ${escapeHtml(record.callback_number)}`,
      start:{dateTime:record.starts_at,timeZone:record.time_zone},end:{dateTime:record.ends_at,timeZone:record.time_zone},
      transparency:'opaque',reminders:{useDefault:false},
      extendedProperties:{private:{orvantaBookingId:record.booking_id,bookingType:record.booking_type,callId:record.call_id}}};
    let response: Response;
    try { response=await this.api('/calendars/'+encodeURIComponent(this.config.calendarId)+'/events?sendUpdates=none','POST',body); }
    catch { throw new CalendarError(true,'calendar_creation_uncertain'); }
    // One deterministic provider ID per durable booking; retries never invent a new ID.
    if (response.status===409) { const existing=await this.find(record); if(existing)return existing; throw new CalendarError(true,'calendar_creation_uncertain'); }
    if (!response.ok) throw new CalendarError(response.status>=500||[408,429].includes(response.status),'calendar_creation_failed');
    const event=await response.json().catch(()=>null) as Record<string,unknown>|null;
    if (!event || !this.eventMatches(event,record)) throw new CalendarError(true,'calendar_creation_uncertain');
    const verified=await this.find(record);
    if(!verified)throw new CalendarError(true,'calendar_creation_uncertain');
    return verified;
  }
}
