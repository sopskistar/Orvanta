import fs from 'node:fs/promises';
import path from 'node:path';
import {parseEnv} from 'node:util';
try {
 const keyPath=path.resolve(process.argv[2]||'');
 const privateRoot=path.resolve('.private')+path.sep;
 if(!keyPath.startsWith(privateRoot)||path.extname(keyPath)!=='.json')throw new Error('Use a key file inside this package’s ignored .private directory.');
 const key=JSON.parse(await fs.readFile(keyPath,'utf8'));
 if(key.type!=='service_account'||!key.client_email?.endsWith('.iam.gserviceaccount.com')||!key.private_key?.startsWith('-----BEGIN PRIVATE KEY-----'))throw new Error('Invalid private service-account file.');
 const file=new URL('../.env.local',import.meta.url),source=await fs.readFile(file,'utf8'),env=parseEnv(source);
 if(env.GOOGLE_SERVICE_ACCOUNT_JSON&&env.GOOGLE_SERVICE_ACCOUNT_JSON!=='replace-with-private-service-account-json')throw new Error('An existing configured key was preserved.');
 const compact=JSON.stringify({type:key.type,client_email:key.client_email,private_key:key.private_key});
 if(compact.includes("'"))throw new Error('Unsupported credential quoting.');
 const line=`GOOGLE_SERVICE_ACCOUNT_JSON='${compact}'`;
 const result=/^GOOGLE_SERVICE_ACCOUNT_JSON=/m.test(source)?source.replace(/^GOOGLE_SERVICE_ACCOUNT_JSON=.*$/m,line):source+'\n'+line+'\n';
 await fs.writeFile(file,result,{mode:0o600});await fs.chmod(file,0o600);await fs.chmod(keyPath,0o600);
 console.log('Imported the calendar credential privately; no key or credential values were printed. Share only the separate demo calendar with this service account using its client_email from your local file.');
}catch{console.error('Calendar key import incomplete. Existing configured keys are never replaced; inspect the private file locally. No credential values were printed.');process.exitCode=1;}
