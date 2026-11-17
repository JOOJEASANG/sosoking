import fs from 'node:fs';
import path from 'node:path';
import { build } from 'esbuild';
import { Resvg } from '@resvg/resvg-js';
const source=path.resolve('public'),dest=path.resolve('dist-public');
for(const p of ['index.html','event.html','old-phone.html','css/site.css','js/event.js','js/phone.js','js/phone-rules.js','js/event-core.js','icons/sosoking.svg','manifest.webmanifest','js/pwa-install.js','sw.js']){
 if(!fs.existsSync(path.join(source,p)))throw new Error('Missing '+p);
}
fs.rmSync(dest,{recursive:true,force:true});fs.cpSync(source,dest,{recursive:true});
const svg=fs.readFileSync(path.join(source,'icons/sosoking.svg'),'utf8');
const iconDir=path.join(dest,'icons');
fs.mkdirSync(iconDir,{recursive:true});
for(const size of [32,180,192,512]){
 const rendered=new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng();
 const file=size===32?path.join(dest,'favicon-32.png'):path.join(iconDir,'sosoking-'+size+'.png');
 fs.writeFileSync(file,rendered);
}
// Maskable logo: full-bleed background; same distinctive 'S' inside the safe-zone.
const maskable=svg.replace('rx="112"','rx="0"');
fs.writeFileSync(path.join(iconDir,'sosoking-maskable-512.png'),new Resvg(maskable,{fitTo:{mode:'width',value:512}}).render().asPng());
for(const target of ['event','phone']){
 await build({entryPoints:[path.join(source,'js',target+'.js')],outfile:path.join(dest,'js',target+'.js'),bundle:true,format:'esm',platform:'browser',target:'es2021',minify:true,legalComments:'none',logLevel:'warning'});
}
console.log('SOSOKING tools build passed');
