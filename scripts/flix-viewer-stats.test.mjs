import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as core from './flix-stats-core.mjs';

test('viewer batches five minutes, flushes a hidden tab and stops on consent withdrawal',async()=>{
 let now=Date.parse('2026-11-27T03:00:00Z'),allowed=true,writes=0;
 const intervals=new Map(),rows=new Map(),document=new EventTarget(),window=new EventTarget();document.visibilityState='visible';
 const auth={authStateReady:async()=>{},currentUser:{isAnonymous:true,uid:'viewer',metadata:{creationTime:new Date(now).toISOString()}}};
 const args={...core,dayOf:(ms=now)=>core.dayOf(ms),initializeApp:()=>({}),getApps:()=>[],firebaseApp:async()=>({options:{}}),getAuth:()=>auth,setPersistence:async()=>{},browserLocalPersistence:{},signInAnonymously:async()=>({user:auth.currentUser}),signOut:async()=>{},getFirestore:()=>({}),doc:(_db,c,id)=>c+'/'+id,serverTimestamp:()=>{const at=now;return {toMillis:()=>at}},document,window,performance:{now:()=>now},Date:class extends Date{static now(){return now}},setInterval:(fn,ms)=>{intervals.set(ms,fn);return ms},clearInterval:id=>intervals.delete(id),runTransaction:async(_db,fn)=>fn({get:async ref=>({data:()=>rows.get(ref)}),set:(ref,data)=>{writes++;rows.set(ref,data)}})};
 const source=(await fs.readFile(new URL('./flix-viewer-stats.mjs',import.meta.url),'utf8')).replace(/import\s+[^;]+;/g,'').replace(/export /g,'');
 const api=await new (Object.getPrototypeOf(async function(){}).constructor)(...Object.keys(args),source+'\nreturn {startViewerStats,stopViewerStats};')(...Object.values(args));
 await api.startViewerStats(()=>({playing:true,workId:'work'}),()=>allowed);
 assert.equal(writes,1);
 const advance=async seconds=>{for(let i=0;i<seconds;i++){now+=1000;intervals.get(1000)?.();}await intervals.get(core.STATS_FLUSH_MS)?.();};
 await advance(300);assert.equal(writes,3);
 let d=rows.get('flixViewerDays/viewer_'+core.dayOf(now));assert.equal(d.watchSeconds,300);assert.equal(d.activeSeconds,300);
 for(let i=0;i<100;i++){now+=1000;intervals.get(1000)();}
 document.visibilityState='hidden';document.dispatchEvent(new Event('visibilitychange'));
 await new Promise(r=>setImmediate(r));assert.equal(writes,5);d=rows.get('flixViewerDays/viewer_'+core.dayOf(now));assert.equal(d.watchSeconds,400);assert.equal(d.playing,false);
 document.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));
 now=Date.parse('2026-11-27T15:00:00Z');intervals.get(1000)();await advance(300);
 assert.equal(rows.get('flixViewerDays/viewer_'+core.dayOf(now)).watchSeconds,300);
 allowed=false;await advance(300);assert.equal(writes,7);
 await api.stopViewerStats();assert.equal(intervals.size,0);
});
