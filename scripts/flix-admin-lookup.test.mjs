import {test} from 'node:test';import assert from 'node:assert/strict';import {tryDirectLookup,lookupQueueStatus,queueConflict} from './flix-admin-lookup.mjs';
const link='https://youtu.be/abcdefghijk';
test('direct lookup uses only existing browser key for individual videos and falls back without key or API error',async()=>{
 const result={verified:true,items:[{videoId:'abcdefghijk'}],rejected:[]};let calls=0;
 const lookup=async(input,opts)=>{calls++;assert.equal(input,link);assert.equal(opts.key,'public');return result};
 assert.equal(await tryDirectLookup(link,{config:async()=>({publicApiKey:'public'}),lookup}),result);
 assert.equal(await tryDirectLookup(link,{config:async()=>({}),lookup}),null);
 assert.equal(await tryDirectLookup('https://youtube.com/playlist?list=PL1234567890',{config:async()=>({publicApiKey:'public'}),lookup}),null);
 assert.equal(await tryDirectLookup(link,{config:async()=>({publicApiKey:'public'}),lookup:async()=>{throw Error('quota')}}),null);
 assert.equal(calls,1);
 await assert.rejects(tryDirectLookup('bad link',{config:async()=>({})}),/유튜브/);
});
test('queue status exposes delayed execution and retains cooldowns',()=>{
 const row={status:'pending',requestedAt:{toMillis:()=>1000}};
 assert.match(lookupQueueStatus(row,1000+11*60000),/11분/);
 assert.match(lookupQueueStatus(row,1000+31*60000),/다시 요청/);
 assert.match(queueConflict(row,1000+29*60000),/대기/);
 assert.equal(queueConflict(row,1000+31*60000),'');
 assert.match(queueConflict({...row,status:'done'},31000),/1분/);
 assert.equal(queueConflict({...row,status:'done'},62000),'');
});
