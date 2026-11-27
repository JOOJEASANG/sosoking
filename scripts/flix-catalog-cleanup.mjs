import fs from 'node:fs/promises';
import {initializeApp,applicationDefault} from 'firebase-admin/app';
import {getFirestore,FieldValue} from 'firebase-admin/firestore';
import {lookupLinks} from './flix-link-lookup.mjs';
import {validateCatalog} from './flix-catalog-validation.mjs';
import {auditCatalog} from './flix-catalog-cleanup-policy.mjs';
import {hideAgeRestricted} from './flix-auto-publish.mjs';
const key=process.env.YOUTUBE_API_KEY;
if(!key){console.log('Existing catalog cleanup skipped: YouTube API key unavailable');process.exit(0)}
initializeApp({credential:applicationDefault(),projectId:'sosoking-481e6'});
const db=getFirestore(),ref=db.doc('flixPublic/catalog'),marker=db.doc('flixSeedImports/2026-11-26-long-form-cleanup-v1');
const [snap,mark]=await Promise.all([ref.get(),marker.get()]);
const d=snap.data(),items=validateCatalog(d?JSON.parse(d.json):JSON.parse(await fs.readFile('public/flix/catalog.json','utf8')));
const ids=[...new Set(items.filter(w=>!w.hidden).flatMap(w=>w.episodes.map(e=>e.videoId)))],metadata=new Map(),health=[];
for(let i=0;i<ids.length;i+=50){const x=await lookupLinks(ids.slice(i,i+50).join(' '),{key});if(!x.verified)throw Error('Verified metadata required');for(const c of x.items)metadata.set(c.videoId,c);health.push(...x.rejected.map(c=>({...c,available:false})))}
const age=hideAgeRestricted(items,health);const result=mark.exists?{items:age.items,hidden:[],review:[],retained:age.items.filter(w=>!w.hidden).map(w=>w.id)}:auditCatalog(age.items,metadata);const json=JSON.stringify(validateCatalog(result.items));if(Buffer.byteLength(json)>700000)throw Error('Catalog size limit');
const record={ageHidden:age.hidden,hidden:result.hidden.map(x=>({id:x.id,title:x.title,reasons:[...new Set(x.reasons.map(y=>y.reason))]})),review:result.review.map(x=>({id:x.id,title:x.title,reasons:x.reasons.slice(0,20)})),retained:result.retained.length,originalRevision:d?.revision||0,checked:ids.length,metadata:metadata.size};
let applied=false;await db.runTransaction(async tx=>{const [current,done]=await Promise.all([tx.get(ref),tx.get(marker)]);if(done.exists!==mark.exists)throw Error('Audit marker changed; retry');if(current.exists!==snap.exists||current.data()?.revision!==d?.revision||current.data()?.json!==d?.json)throw Error('Catalog changed during audit; retry with new snapshot');if(result.hidden.length||age.hidden.length)tx.set(ref,{json,revision:(d?.revision||0)+1,updatedAt:FieldValue.serverTimestamp()});if(!done.exists)tx.set(marker,{...record,checkedAt:FieldValue.serverTimestamp()});applied=true});
console.log('Existing catalog cleanup:',JSON.stringify({applied,...record}));
