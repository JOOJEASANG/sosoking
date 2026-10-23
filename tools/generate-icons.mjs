import sharp from 'sharp';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const svg=await readFile('public/brand-mark.svg');
for(const size of [192,512]){
 await sharp(svg,{density:300}).resize(size,size).png().toFile('public/icon-'+size+'.png');
}
console.log('SOSOKING BRAND ICONS: generated 192px and 512px');
