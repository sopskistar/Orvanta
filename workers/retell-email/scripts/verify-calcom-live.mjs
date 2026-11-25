import assert from 'node:assert/strict';
import {liveConversation,toolResults} from './calcom-live-tools.mjs';
// Read-only by default. Creation requires a separate command/explicit flag and
// its prewritten report prevents unsafe repeats after an ambiguous response.
try {
 const date=process.argv[2];if(!/^\d{4}-\d\d-\d\d$/.test(date||''))throw new Error('explicit_future_date_required');
 const create=process.argv.includes('--cleaning');
 const name=process.env.CALCOM_TEST_NAME||('availability_'+date);
 const request=create?`I want a STANDARD cleaning DEMONSTRATION appointment on ${date} from 11 AM to 1 PM America/Chicago, Austin/Central time. My synthetic name is Alex Orvanta Cleaning Test, test email julianahonour@gmail.com, phone +12025550143, synthetic address 123 Example Lane, Austin TX 78701. I understand no actual cleaning service or crew dispatch is provided. Please check LIVE availability and ask for my explicit confirmation before creating anything. Do not book a callback.`:`Only check LIVE standard-cleaning demonstration availability on ${date} between 9 AM and 5 PM America/Chicago, Austin/Central time. Do not create any booking or callback. List available openings.`;
 const report=await liveConversation({name,request,create,confirmation:`Yes. I explicitly confirm the STANDARD cleaning DEMONSTRATION appointment on ${date}, 11:00 AM–1:00 PM America/Chicago (Austin/Central time), for Alex Orvanta Cleaning Test, julianahonour@gmail.com, +12025550143, synthetic address 123 Example Lane, Austin TX 78701. I understand it provides no actual cleaning service or crew dispatch. Book only that exact appointment if live availability allows it.`});
 const results=toolResults(report);assert.ok(results.some(r=>r.name==='cleaning_availability'));
 const bookings=results.filter(r=>r.name==='cleaning_booking');if(create)assert.equal(bookings.length,1);else assert.equal(bookings.length,0);
 console.log(JSON.stringify({draftVersion:report.version,actualOAuthToolCalls:results.map(r=>({name:r.name,successful:r.result?.successful,providerStatus:r.result?JSON.parse(r.result.content).data?.status:undefined,providerBookingId:r.result?JSON.parse(r.result.content).data?.uid:undefined})),privateReportSaved:true,calendarAndInboxStillRequireReadback:true,operational:false}));
}catch(e){console.error(JSON.stringify({liveVerificationIncomplete:true,code:/^[a-z0-9_]+$/.test(e.message)?e.message:'test_failed',blindRetry:false,noOperationalClaim:true}));process.exitCode=1;}
