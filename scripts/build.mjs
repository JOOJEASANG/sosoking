import fs from 'node:fs';
import path from 'node:path';
import {build} from 'esbuild';
import {Resvg} from '@resvg/resvg-js';
const source=path.resolve('public'),dest=path.resolve('dist-public');
for(const filename of ['index.html','css/site.css','js/daily.js','js/daily-core.js','js/pwa-install.js','icons/sosoking.svg','manifest.webmanifest','sw.js','robots.txt','sitemap.xml']){
 if(!fs.existsSync(path.join(source,filename)))throw Error('Missing '+filename);
}
fs.rmSync(dest,{recursive:true,force:true});
fs.cpSync(source,dest,{recursive:true});
const svg=fs.readFileSync(path.join(source,'icons/sosoking.svg'),'utf8');
const iconDir=path.join(dest,'icons');fs.mkdirSync(iconDir,{recursive:true});
for(const size of [32,180,192,512]){
 const png=new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng();
 const file=size===32?path.join(dest,'favicon-32.png'):path.join(iconDir,'sosoking-'+size+'.png');
 fs.writeFileSync(file,png);
}
const maskable=svg.replace('rx="112"','rx="0"');
fs.writeFileSync(path.join(iconDir,'sosoking-maskable-512.png'),new Resvg(maskable,{fitTo:{mode:'width',value:512}}).render().asPng());
await build({entryPoints:[path.join(source,'js','daily.js')],outfile:path.join(dest,'js','daily.js'),bundle:true,format:'esm',platform:'browser',target:'es2021',minify:true,legalComments:'none',logLevel:'warning'});
for(const legacy of ['event.html','old-phone.html','roster.html','orders.html','chat.html','guide.html']){
 if(fs.existsSync(path.join(dest,legacy)))throw Error('Legacy program survived redesign: '+legacy);
}
console.log('SOSOKING Daily Check build passed');
