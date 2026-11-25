import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {Resvg} from '@resvg/resvg-js';
const src='public/flix',dest='dist-public';
const asset=fs.readFileSync(path.join(src,'brand-icon-source.jpg'));
const logo=fs.readFileSync(path.join(src,'brand-logo.webp'));
function gitHash(bytes){return createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')}
if(gitHash(asset)!=='a9e1f6212f8e61b3e7cf7bd60ce850cbafc4cfe2'||gitHash(logo)!=='fbd9c6e9253f826863c9acb21662e2004e5726f6')throw Error('Brand asset integrity check failed');
fs.rmSync(dest,{recursive:true,force:true});fs.cpSync(src,dest,{recursive:true});
fs.rmSync(path.join(dest,'brand-icon-source.jpg'),{force:true});
fs.mkdirSync(path.join(dest,'icons'),{recursive:true});
const uri='data:image/jpeg;base64,'+asset.toString('base64');
function render(size,maskable=false){const inset=maskable?96:0,extent=512-inset*2;const svg='<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#10080e"/><image x="'+inset+'" y="'+inset+'" width="'+extent+'" height="'+extent+'" xlink:href="'+uri+'"/></svg>';const png=new Resvg(svg,{fitTo:{mode:'width',value:size}}).render().asPng();if(png.readUInt32BE(16)!==size||png.readUInt32BE(20)!==size)throw Error('Wrong icon size');return png}
for(const size of [32,180,192,512])fs.writeFileSync(path.join(dest,'icons','ai-brand-'+size+'.png'),render(size));
fs.writeFileSync(path.join(dest,'icons','ai-brand-maskable-512.png'),render(512,true));
// Keep old icon URLs compatible for previously installed PWA clients.
for(const size of [192,512])fs.copyFileSync(path.join(dest,'icons','ai-brand-'+size+'.png'),path.join(dest,'icons','flix-'+size+'.png'));
console.log('FLIX build and brand asset verification passed');
