// Local smoke-test entrypoint only. Production wrangler.jsonc uses src/index.ts.
import worker from '../src/index.ts';
import {GoogleCalendar} from '../src/booking-google.ts';
import type {Env} from '../src/types.ts';
import type {BookingRecord} from '../src/booking-types.ts';
export default {
  ...worker,
  async fetch(request: Request,env: Env) {
    if(new URL(request.url).pathname!=='/__test/calendar-crypto')return worker.fetch(request,env);
    const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
    const privateBytes=new Uint8Array(await crypto.subtle.exportKey('pkcs8',pair.privateKey));
    const config={calendarId:'synthetic@group.calendar.google.com',timeZone:'America/Chicago',callbackMinutes:15,cleaningMinutes:120,
      serviceAccount:{client_email:'synthetic@demo.iam.gserviceaccount.com',private_key:'-----BEGIN PRIVATE KEY-----\n'+btoa(String.fromCharCode(...privateBytes))+'\n-----END PRIVATE KEY-----'}};
    let jwtVerified=false;
    const fake:typeof fetch=async(input,init)=>{
      const url=String(input);
      if(url==='https://oauth2.googleapis.com/token') {
        const jwt=(init!.body as URLSearchParams).get('assertion')!;
        const [head,payload,sig]=jwt.split('.');
        const signature=Uint8Array.from(atob(sig.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
        jwtVerified=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pair.publicKey,signature,new TextEncoder().encode(head+'.'+payload));
        return Response.json({access_token:'synthetic_only',expires_in:3600});
      }
      return Response.json({id:config.calendarId,summary:'Sample Home Cleaning Demo',timeZone:'America/Chicago'});
    };
    await new GoogleCalendar(config,fake).verifyCalendar();
    // The cast documents that no real booking or production calendar is touched.
    const noBooking:Partial<BookingRecord>={call_id:'call_synthetic_runtime'};
    return Response.json({jwtVerified,googleRequestsStubbed:true,realBookingsCreated:0,synthetic:!!noBooking.call_id});
  },
};
