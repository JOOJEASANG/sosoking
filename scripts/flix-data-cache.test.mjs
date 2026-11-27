import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cachedRead,cachedRecord,cachePublicValue,CATALOG_TTL,RECOMMENDATIONS_TTL} from '../public/flix/data-cache.js';
const memory=()=>{const rows=new Map();return {getItem:key=>rows.get(key)??null,setItem:(key,value)=>rows.set(key,value),removeItem:key=>rows.delete(key)}};

test('repeated visits reuse catalog for five minutes; recommendations for one hour',async()=>{
 const store=memory();let at=1000000,calls=0;
 const options={ttl:CATALOG_TTL,store,now:()=>at,locks:null},fetch=async()=>({revision:++calls});
 assert.equal((await cachedRead('catalog-test',fetch,options)).revision,1);
 at+=CATALOG_TTL-1;assert.equal((await cachedRead('catalog-test',fetch,options)).revision,1);
 at++;assert.equal((await cachedRead('catalog-test',fetch,options)).revision,2);
 assert.equal((await cachedRead('catalog-test',fetch,{...options,force:true})).revision,3);
 assert.equal(RECOMMENDATIONS_TTL,3600000);
});
test('concurrent requests and tabs share one underlying read',async()=>{
 const second=await import('../public/flix/data-cache.js?second-tab');const store=memory();let calls=0,tail=Promise.resolve();
 const locks={request:(_key,fn)=>{const next=tail.then(fn);tail=next.catch(()=>{});return next}},options={ttl:10000,store,now:()=>1000,locks};
 const fetch=async()=>{calls++;await new Promise(r=>setTimeout(r,10));return ['shared'];};
 const values=await Promise.all([cachedRead('shared',fetch,options),cachedRead('shared',fetch,options),second.cachedRead('shared',fetch,options)]);
 assert.equal(calls,1);assert.deepEqual(values,[['shared'],['shared'],['shared']]);
});
test('failures and corrupt cache never become successful cached reads',async()=>{
 const store=memory();store.setItem('broken','not json');let calls=0;
 await assert.rejects(cachedRead('broken',async()=>{calls++;throw Error('offline')},{ttl:1000,store,locks:null}));
 assert.equal((await cachedRead('broken',async()=>{calls++;return 4},{ttl:1000,store,locks:null})),4);assert.equal(calls,2);
 cachePublicValue('future',9,{store,now:2000});assert.equal(cachedRecord('future',10000,{store,now:1000}),null);
 cachePublicValue('empty',null,{store,now:1000});assert.equal(cachedRecord('empty',10000,{store,now:1001}).value,null);
 const blocked={getItem(){throw Error('blocked')},setItem(){throw Error('full')}};
 assert.equal(await cachedRead('private-mode',async()=>7,{ttl:1000,store:blocked,locks:null}),7);
});
test('a pending read cannot overwrite a newer publication in another tab',async()=>{
 const store=memory();let now=1000,resolve;
 const pending=cachedRead('publication-race',()=>new Promise(r=>resolve=r),{ttl:10000,store,now:()=>now,locks:null});
 await Promise.resolve();now=2000;cachePublicValue('publication-race',['new'],{now,store});resolve(['old']);
 assert.deepEqual(await pending,['new']);assert.deepEqual(cachedRecord('publication-race',10000,{now,store}).value,['new']);
});
