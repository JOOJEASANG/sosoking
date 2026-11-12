import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {api} from '../server/http.js';
import {localDb} from '../server/local-store.js';
const root = fileURLToPath(new URL('../public/',import.meta.url));
const args = process.argv.slice(2);
const option = (key, fallback) => args[args.indexOf(key)+1] && args.includes(key) ? args[args.indexOf(key)+1] : fallback;
const port = Number(option('--port',process.env.PORT || 5173));
const host = option('--host',process.env.HOST || '127.0.0.1');
const types = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.webp':'image/webp','.svg':'image/svg+xml'};
const db = localDb(fileURLToPath(new URL('../.tidepost-local.sqlite',import.meta.url)));
createServer(async (req,res) => {
  try {
    const url = new URL(req.url,'http://'+req.headers.host);
    if (url.pathname.startsWith('/api/')) {
      const chunks = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes>2048) {res.writeHead(413).end(); return;} chunks.push(chunk); }
      const request = new Request(url,{method:req.method,headers:req.headers,body:chunks.length ? Buffer.concat(chunks) : undefined});
      const response = await api(request,db);
      res.writeHead(response.status,Object.fromEntries(response.headers)).end(await response.text()); return;
    }
    const path = resolve(root,'.'+decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname));
    if (!path.startsWith(resolve(root)+sep)) {res.writeHead(404).end();return;}
    const body = await readFile(path);
    res.writeHead(200,{'Content-Type':types[extname(path)] || 'application/octet-stream','Cache-Control':'no-cache'}).end(body);
  } catch {res.writeHead(404).end();}
}).listen(port,host,()=>console.log('Tidepost is ready on http://'+host+':'+port));
