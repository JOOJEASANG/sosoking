import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readLookupRequest,withUnappliedSeed} from './flix-cost-reads.mjs';

test('idle lookup polls exclude large completed results and preserve pending fields',async()=>{
 const ref={path:'flixAutomation/lookup'}, pending={status:'pending',owner:'admin',id:'request',requestedAt:{toMillis:()=>123},links:'series:video'};
 let stored={...pending,status:'done',result:'x'.repeat(600000)}, calls=0;
 const db={getAll:async(r,opts)=>{calls++;assert.equal(r,ref);assert.deepEqual(opts.fieldMask,['status','owner','id','requestedAt','links']);return [{data:()=>stored&&Object.fromEntries(opts.fieldMask.filter(k=>k in stored).map(k=>[k,stored[k]]))}]}};
 assert.equal(await readLookupRequest(db,ref),null);
 stored={...stored,status:'error'};assert.equal(await readLookupRequest(db,ref),null);
 stored=null;assert.equal(await readLookupRequest(db,ref),null);
 stored=pending;assert.deepEqual(await readLookupRequest(db,ref),pending);
 assert.equal(calls,4);
});
test('seed marker skips catalog reads and writes on repeat deployments',async()=>{
 const marker={path:'marker'},catalog={path:'catalog'},reads=[],writes=[];
 let exists=true;const snapshot={exists:true,data:()=>({revision:7})};
 const tx={get:async r=>{reads.push(r.path);return r===marker?{exists}:snapshot},set:(r,value)=>writes.push([r.path,value])};
 const db={runTransaction:async fn=>fn(tx)};
 const apply=async(t,s)=>{assert.equal(t,tx);assert.equal(s,snapshot);t.set(marker,{added:0})};
 assert.equal(await withUnappliedSeed(db,marker,catalog,apply),false);
 assert.deepEqual(reads,['marker']);assert.deepEqual(writes,[]);
 exists=false;reads.length=0;
 assert.equal(await withUnappliedSeed(db,marker,catalog,apply),true);
 assert.deepEqual(reads,['marker','catalog']);assert.deepEqual(writes,[['marker',{added:0}]]);
});
test('seed failure propagates rather than pretending import succeeded',async()=>{
 const db={runTransaction:fn=>fn({get:async()=>({exists:false})})};
 await assert.rejects(withUnappliedSeed(db,'marker','catalog',async()=>{throw Error('failed')}),/failed/);
});
