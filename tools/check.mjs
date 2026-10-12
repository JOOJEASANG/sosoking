import {readFileSync,readdirSync,existsSync} from 'node:fs';import {execFileSync} from 'node:child_process';import {createRequire} from 'node:module';
const walk=p=>readdirSync(p,{withFileTypes:true}).filter(x=>x.name!=='node_modules').flatMap(x=>x.isDirectory()?walk(`${p}/${x.name}`):[`${p}/${x.name}`]);
for(const file of [...walk('public'),...walk('functions'),...walk('tools')])if(/\.(?:js|mjs|cjs)$/.test(file))execFileSync(process.execPath,['--check',file],{stdio:'pipe'});
const html=readFileSync('public/index.html','utf8');for(const [,p]of html.matchAll(/(?:src|href)="(\/[^"#?]+)"/g))if(!existsSync(`public${p}`))throw new Error(`Missing HTML asset ${p}`);
for(const file of ['firebase.json','firestore.indexes.json','public/site.webmanifest'])JSON.parse(readFileSync(file,'utf8'));
if(readFileSync('functions/game-engine.cjs','utf8')!==readFileSync('public/js/game-engine.js','utf8'))throw new Error('Engine drift');
if(readFileSync('functions/starter-games.json','utf8')!==readFileSync('public/data/games.json','utf8'))throw new Error('Mission drift');
const require=createRequire(import.meta.url);const keys=Object.keys(require('../functions/main.js'));for(const name of ['gameLibrary','saveGameRun','getGameRuns','clearGameRuns','gameStudio','generateNewsGame'])if(!keys.includes(name))throw new Error(`Missing backend: ${name}`);
console.log('Checked JavaScript syntax, asset links, Firebase configuration and shared rules.');
