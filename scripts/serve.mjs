import http from 'node:http';import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('dist-public');
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.png':'image/png','.webp':'image/webp','.webmanifest':'application/manifest+json'};
const option=(name,fallback)=>{const i=process.argv.indexOf(name);return i>=0?process.argv[i+1]:fallback};
const host=option('--host','127.0.0.1'),port=Number(option('--port',process.env.PORT||'3000'));
if(!Number.isInteger(port)||port<1||port>65535)throw Error('Invalid preview port');
http.createServer((req,res)=>{let pathname;try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400).end();return;}
 const f=path.resolve(root,'.'+(pathname.endsWith('/')?pathname+'index.html':pathname));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 fs.readFile(f,(err,data)=>{if(err){res.writeHead(404).end('Not Found');return;}res.writeHead(200,{'content-type':types[path.extname(f)]||'application/octet-stream'});res.end(data);});
}).listen(port,host,()=>console.log('Local preview http://'+host+':'+port));
