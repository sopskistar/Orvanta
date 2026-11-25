import {bookingConfig} from '../src/booking-config.ts';
import {GoogleCalendar} from '../src/booking-google.ts';
import {neonSql} from '../src/store.ts';
export async function checkCalendar(env=process.env) {
 const missing=['GOOGLE_CALENDAR_ID','GOOGLE_SERVICE_ACCOUNT_JSON','BOOKING_TIMEZONE'].filter(k=>!env[k]||env[k].startsWith('replace-with'));
 if(missing.length){console.log(JSON.stringify({missingVariables:missing}));throw new Error('calendar_configuration_missing');}
 const config=bookingConfig(env);
 await new GoogleCalendar(config).verifyCalendar();
 const sql=neonSql(env.DATABASE_URL);
 const [schema]=await sql("SELECT to_regclass('orvanta_workflow.booking_offers') IS NOT NULL AND to_regclass('orvanta_workflow.bookings') IS NOT NULL AND to_regclass('orvanta_workflow.booking_slot_claims') IS NOT NULL AS ready");
 if(!schema.ready)throw new Error('booking_migration_required');
 return {calendarVerified:true,dedicatedDemoCalendar:true,timeZone:'America/Chicago',bookingSchemaVerified:true,bookingOperational:false};
}
if(import.meta.url===new URL(process.argv[1],'file:').href){try{console.log(JSON.stringify(await checkCalendar()));}catch{console.error('Calendar setup check incomplete. No credentials were printed; booking is not declared operational.');process.exitCode=1;}}
