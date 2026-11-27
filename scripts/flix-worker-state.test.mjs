import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {shouldReadScan} from './flix-worker-state.mjs';
import {POLICY_VERSION} from './flix-discovery-policy.mjs';

const stamp=ms=>({toMillis:()=>ms,toDate:()=>new Date(ms)});
test('idle scans wait six hours, with publication, retry and manual exceptions',()=>{
 const now=Date.now(),state={policyVersion:POLICY_VERSION,state:'ok',checkedAt:stamp(now),signalRevision:2};
 assert.equal(shouldReadScan(state,{revision:2},POLICY_VERSION,now+600000),false);
 assert.equal(shouldReadScan(state,{revision:2},POLICY_VERSION,now+21600000),true);
 assert.equal(shouldReadScan(state,{revision:3},POLICY_VERSION,now),true);
 assert.equal(shouldReadScan(state,{revision:2},POLICY_VERSION,now,true),true);
 assert.equal(shouldReadScan({...state,pendingCatalogChange:true},{revision:2},POLICY_VERSION,now),true);
 const partial={...state,state:'partial',retryAfter:stamp(now+3600000)};
 assert.equal(shouldReadScan(partial,{revision:2},POLICY_VERSION,now+600000),false);
 assert.equal(shouldReadScan(partial,{revision:2},POLICY_VERSION,now+3600000),true);
 assert.equal(shouldReadScan({...state,state:'api-key-missing'},{revision:2},POLICY_VERSION,now,false,true),true);
});

// Run the actual worker with an in-memory Admin SDK. No production credentials or reads.
async function runWorker(initial={},env={},fetchImpl=async()=>({ok:false,status:503})){
 const source=await fs.readFile(new URL('./flix-online-worker.mjs',import.meta.url),'utf8');
 const rows=new Map(Object.entries(initial)),reads=[],writes=[],logs=[];
 const snap=path=>({exists:rows.has(path),data:()=>rows.get(path)});
 const ref=path=>({path,get:async()=>{reads.push(path);return snap(path)},set:async value=>{writes.push(path);rows.set(path,value)}});
 const db={doc:ref,runTransaction:async fn=>fn({get:r=>r.get(),set:(r,v)=>{writes.push(r.path);rows.set(r.path,v)}}),collection:()=>{const q={where:()=>q,limit:()=>q,get:async()=>({size:0,docs:[]})};return q}};
 const process={env,exitCode:0};
 const args={fs,process,initializeApp:()=>{},applicationDefault:()=>({}),getFirestore:()=>db,FieldValue:{serverTimestamp:()=>stamp(Date.now())},Timestamp:{fromMillis:stamp},getAuth:()=>({getUser:async()=>({disabled:false})}),fetch:fetchImpl,console:{log:(...x)=>logs.push(x),error:(...x)=>logs.push(x)},dispatchPush:async()=>{throw Error('Unexpected push')}};
 for(const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*'([^']+)'/g)){
  if(!match[2].startsWith('.')||match[2].includes('push-worker'))continue;
  const module=await import(new URL(match[2],import.meta.url));
  for(const name of match[1].split(',').map(x=>x.trim()))args[name]=module[name];
 }
 const body=source.replace(/import\s+[^;]+;/g,'');
 await new (Object.getPrototypeOf(async function(){}).constructor)(...Object.keys(args),body)(...Object.values(args));
 return {reads,writes,rows,exitCode:process.exitCode,logs};
}
test('idle worker reads only four small queue/state documents and writes nothing',async()=>{
 const state={policyVersion:POLICY_VERSION,state:'ok',checkedAt:stamp(Date.now()),signalRevision:0};
 const r=await runWorker({'flixAutomation/scanState':state});
 assert.deepEqual(r.reads.sort(),['flixAutomation/catalogSignal','flixAutomation/lookup','flixAutomation/refresh','flixAutomation/scanState']);
 assert.deepEqual(r.writes,[]);assert.equal(r.exitCode,0);
});
test('missing API key is a failed execution, then idle retries avoid heavy reads',async()=>{
 const r=await runWorker({'flixPublic/catalog':{json:'[]',revision:1}});
 assert.equal(r.exitCode,1);assert.equal(r.rows.get('flixAutomation/report').state,'api-key-missing');
 assert.ok(r.rows.has('flixAutomation/scanState'));
 const retry=await runWorker(Object.fromEntries(r.rows));
 assert.equal(retry.exitCode,0);assert.equal(retry.reads.includes('flixAutomation/report'),false);
});
test('API error yields partial failure and a bounded retry instead of a green run',async()=>{
 const r=await runWorker({'flixPublic/catalog':{json:'[]',revision:1}},{YOUTUBE_API_KEY:'test-only'});
 assert.equal(r.exitCode,1);assert.equal(r.rows.get('flixAutomation/report').state,'partial');
 assert.ok(r.rows.get('flixAutomation/scanState').retryAfter.toMillis()>Date.now());
});
