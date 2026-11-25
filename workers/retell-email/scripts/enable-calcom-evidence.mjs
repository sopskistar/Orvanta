import fs from 'node:fs/promises';
import {checkCalendar} from './check-calendar.mjs';
try {
 await checkCalendar();
 if(process.env.DELIVERY_ENABLED!=='true'||process.env.BOOKING_ENABLED==='true')throw new Error('preserve_delivery_and_disable_google');
 const file=new URL('../.env.local',import.meta.url),source=await fs.readFile(file,'utf8');
 if((source.match(/^CALCOM_BOOKING_ENABLED=/gm)||[]).length!==1)throw new Error('one_existing_flag_required');
 await fs.writeFile(file,source.replace(/^CALCOM_BOOKING_ENABLED=.*$/m,'CALCOM_BOOKING_ENABLED=true'),{mode:0o600});
 await fs.chmod(file,0o600);
 console.log('Cal.com receipt verification enabled in private configuration. Delivery stays enabled; direct Google booking stays disabled. No live number assignment changed.');
}catch{console.error('Evidence activation incomplete; verify the reviewed OAuth draft, schema and existing delivery configuration. No secrets printed.');process.exitCode=1;}
