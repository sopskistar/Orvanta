export function retellClient(env=process.env) {
 return async(path,method='GET',body)=>{
  const response=await fetch('https://api.retellai.com/'+path,{method,headers:{Authorization:`Bearer ${env.RETELL_API_KEY}`,'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('retell_http_'+response.status);
  const text=await response.text();return text?JSON.parse(text):null;
 };
}
