import { createServer }
from 'node:http';
import { readFile }
from 'node:fs/promises';
import { extname, resolve, sep }
from 'node:path';
import { fileURLToPath }
from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
function option(name, fallback) {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1] && !args[i + 1].startsWith('--')) return args[i + 1];
  return args.find(a => a.startsWith(name + '='))?.slice(name.length + 1) || fallback;
}
const port = Number(option('--port', process.env.PORT || 5173));
const host = option('--host', process.env.HOST || '127.0.0.1');
const types = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.webp': 'image/webp'};
createServer(async(req, res) => {
    try {
      const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      const target = resolve(root, '.' + (path === '/' ? '/index.html' : path));
      if (target !== resolve(root, 'index.html') && !target.startsWith(resolve(root, 'flight') + sep)) {
        res.writeHead(404).end();
        return;
      }
      const content = await readFile(target);
      res.writeHead(200, {'content-type': types[extname(target)] || 'application/octet-stream', 'cache-control': 'no-cache'}).end(content);
    } catch {res.writeHead(404).end();}
}).listen(port, host, () => console.log('Skybreak running on http://' + host + ':' + port));
