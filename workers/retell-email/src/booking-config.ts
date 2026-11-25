import type { Env } from './types.ts';
import type { BookingConfig, BookingType } from './booking-types.ts';
import { RequestError } from './payload.ts';
export function bookingConfig(env: Env): BookingConfig {
  if (!env.GOOGLE_CALENDAR_ID || !/^[^\s@]+@group\.calendar\.google\.com$/.test(env.GOOGLE_CALENDAR_ID)) throw new Error('dedicated_demo_calendar_required');
  if (env.BOOKING_TIMEZONE !== 'America/Chicago') throw new Error('demo_timezone_invalid');
  const account = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON || 'null');
  if (account?.type !== 'service_account' || !/^[^\s@]+@[^\s@]+\.iam\.gserviceaccount\.com$/.test(account.client_email || '') ||
      typeof account.private_key !== 'string' || !account.private_key.startsWith('-----BEGIN PRIVATE KEY-----')) throw new Error('calendar_credentials_missing');
  const duration = (value: string | undefined, fallback: number) => {
    const n = Number(value || fallback);
    if (!Number.isInteger(n) || n < 15 || n > 240 || n % 15) throw new Error('booking_duration_invalid');
    return n;
  };
  return { calendarId: env.GOOGLE_CALENDAR_ID, timeZone: env.BOOKING_TIMEZONE,
    callbackMinutes: duration(env.CALLBACK_DURATION_MINUTES, 15), cleaningMinutes: duration(env.CLEANING_VISIT_DURATION_MINUTES, 120), serviceAccount: account };
}
export function bookingType(value: unknown): BookingType {
  if (value !== 'callback' && value !== 'cleaning_visit') throw new RequestError(400,'invalid_booking_type');
  return value;
}
export const overlaps = (a: {start: string; end: string}, b: {start: string; end: string}) => Date.parse(a.start) < Date.parse(b.end) && Date.parse(b.start) < Date.parse(a.end);
const formatters=new Map<string,Intl.DateTimeFormat>();
export function localDateTime(iso: string, zone: string): string {
  if(!formatters.has(zone))formatters.set(zone,new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}));
  const p = formatters.get(zone)!.formatToParts(new Date(iso));
  const v = Object.fromEntries(p.map(x=>[x.type,x.value]));
  return `${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}`;
}
export function daySlots(date: unknown, type: BookingType, config: BookingConfig, now = Date.now()) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T12:00:00Z')) || new Date(date+'T12:00:00Z').toISOString().slice(0,10) !== date) throw new RequestError(400,'explicit_date_required');
  const midnight = Date.parse(date+'T00:00:00Z');
  if (midnight < now-86400_000 || midnight > now+90*86400_000) throw new RequestError(400,'date_out_of_range');
  if ([0,6].includes(new Date(midnight).getUTCDay())) return [];
  const minuteCount = type === 'callback' ? config.callbackMinutes : config.cleaningMinutes;
  const result = [];
  for (let minute=9*60; minute+minuteCount<=17*60; minute+=15) {
    const local = `${date}T${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
    let utc = midnight+minute*60000;
    // Office-hour slots avoid the DST transition hour; round-trip validation still applies.
    for(let i=0;i<2;i++) utc += Date.parse(local+'Z')-Date.parse(localDateTime(new Date(utc).toISOString(),config.timeZone)+'Z');
    const start = new Date(utc).toISOString(),end = new Date(utc+minuteCount*60000).toISOString();
    if (utc > now+30*60000 && localDateTime(start,config.timeZone)===local) result.push({start,end,localStart:local});
  }
  return result;
}
