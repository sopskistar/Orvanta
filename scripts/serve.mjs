// Local production-export preview only; your hosting provider serves production.
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('out');
const port = Number(process.env.PORT || 3000);
const types = {'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.json':'application/json','.txt':'text/plain','.xml':'application/xml','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.ico':'image/x-icon','.ttf':'font/ttf','.mp4':'video/mp4','.webmanifest':'application/manifest+json'};
const server = http.createServer(async (req,res) => {
 try {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  let file = path.resolve(root, '.'+pathname);
  if (file !== root && !file.startsWith(root+path.sep)) {res.writeHead(403).end();return;}
  let info = await stat(file).catch(()=>null);
  if (info?.isDirectory()) {file=path.join(file,'index.html');info=await stat(file).catch(()=>null);}
  let status=200;
  if (!info?.isFile()) {file=path.join(root,'404.html');info=await stat(file);status=404;}
  const headers={'Content-Type':types[path.extname(file)] || 'application/octet-stream','Accept-Ranges':'bytes','X-Content-Type-Options':'nosniff'};
  let start=0,end=info.size-1;
  if(req.headers.range && status===200){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!match){res.writeHead(416).end();return;}start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(start>end || start>=info.size){res.writeHead(416,{'Content-Range':`bytes */${info.size}`}).end();return;}status=206;headers['Content-Range']=`bytes ${start}-${end}/${info.size}`;}
  headers['Content-Length']=String(end-start+1);res.writeHead(status,headers);
  if(req.method==='HEAD'){res.end();return;}
  createReadStream(file,{start,end}).on('error',()=>res.destroy()).pipe(res);
 } catch {res.writeHead(500).end('Could not serve the export. Run npm run build first.');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Orvanta export: http://127.0.0.1:${port}`));
