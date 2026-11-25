import fs from 'node:fs/promises';
import {parseEnv} from 'node:util';
try {
 const file=new URL('../.env.local',import.meta.url),source=await fs.readFile(file,'utf8'),env=parseEnv(source);
 const defaults={BOOKING_ENABLED:'false',GOOGLE_CALENDAR_ID:'replace-with-the-secondary-calendar-id@group.calendar.google.com',GOOGLE_SERVICE_ACCOUNT_JSON:'replace-with-private-service-account-json',BOOKING_TIMEZONE:'America/Chicago',CALLBACK_DURATION_MINUTES:'15',CLEANING_VISIT_DURATION_MINUTES:'120'};
 const added=Object.entries(defaults).filter(([key])=>!(key in env));
 if(added.length)await fs.appendFile(file,'\n# Optional demo bookings; keep disabled until verified.\n'+added.map(([k,v])=>`${k}=${v}`).join('\n')+'\n');
 await fs.chmod(file,0o600);
 await fs.mkdir(new URL('../.private/',import.meta.url),{recursive:true,mode:0o700});
 console.log(JSON.stringify({addedVariables:added.map(([k])=>k),existingValuesPreserved:true,secretValuesPrinted:false}));
}catch{console.error('Could not initialize private booking entries; existing values are not printed.');process.exitCode=1;}
