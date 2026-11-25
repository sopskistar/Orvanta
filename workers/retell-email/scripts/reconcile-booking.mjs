import {bookingConfig} from '../src/booking-config.ts';
import {GoogleCalendar} from '../src/booking-google.ts';
import {BookingStore} from '../src/booking-store.ts';
import {neonSql} from '../src/store.ts';
import {ID} from '../src/config.ts';
try {
 const callId=process.argv[2];if(!callId||!ID.test(callId))throw new Error('A call ID is required.');
 const config=bookingConfig(process.env),sql=neonSql(process.env.DATABASE_URL),store=BookingStore.connect(process.env.DATABASE_URL),provider=new GoogleCalendar(config);
 await provider.verifyCalendar();
 const rows=await sql("SELECT *,id AS booking_id FROM orvanta_workflow.bookings WHERE call_id=$1 AND workspace_id=$2 AND calendar_id=$3 AND status IN ('creating','review')",[callId,process.env.RETELL_WORKSPACE_ID,config.calendarId]);
 let reconciled=0;
 for(const row of rows){const id=await provider.find(row);if(id){await store.finish(row.booking_id,'confirmed',id,null);reconciled++;}}
 console.log(JSON.stringify({callId,existingProviderEventsReconciled:reconciled,remainingForReview:rows.length-reconciled,newEventsCreated:0,emailResent:false}));
}catch{console.error('Read-only provider reconciliation incomplete; no events were created, emails resent or credentials printed.');process.exitCode=1;}
