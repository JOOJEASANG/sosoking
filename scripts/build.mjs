import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
const source=path.resolve('public'),dest=path.resolve('dist-public');
for(const p of ['index.html','event.html','old-phone.html','css/site.css','js/event.js','js/phone.js','js/phone-rules.js','js/event-core.js']){
 if(!fs.existsSync(path.join(source,p)))throw new Error('Missing '+p);
}
fs.rmSync(dest,{recursive:true,force:true});fs.cpSync(source,dest,{recursive:true});
for(const target of ['event','phone']){
 await build({entryPoints:[path.join(source,'js',target+'.js')],outfile:path.join(dest,'js',target+'.js'),bundle:true,format:'esm',platform:'browser',target:'es2021',minify:true,legalComments:'none',logLevel:'warning'});
}
console.log('SOSOKING tools build passed');
