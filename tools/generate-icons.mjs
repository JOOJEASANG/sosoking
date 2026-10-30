import sharp from 'sharp';
import {readFile} from 'node:fs/promises';
const appIcon=await readFile('public/app-icon.svg');
for(const size of [180,192,512]){
 const path=size===180?'apple-touch-icon.png':'icon-'+size+'.png';
 await sharp(appIcon,{density:300}).resize(size,size).png().toFile('public/'+path);
}
await sharp(appIcon,{density:300}).resize(512,512).png().toFile('public/icon-maskable-512.png');
await sharp(await readFile('public/social-preview.svg')).resize(1200,630).png().toFile('public/social-preview.png');
console.log('SOSOKING: icons and social preview generated');
