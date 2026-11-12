import { cp, mkdir, rm }
from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, {recursive: true, force: true});
await mkdir(dist, {recursive: true});
await cp(new URL('index.html', root), new URL('index.html', dist));
await cp(new URL('flight/', root), new URL('flight/', dist), {recursive: true});
console.log('Built Skybreak in dist/');
