import {test} from 'node:test';import assert from 'node:assert/strict';import {dayOf,summarizeStats,samplePlayback,statsPayload,STATS_FLUSH_MS} from './flix-stats-core.mjs';
test('Korean calendar boundaries',()=>{assert.equal(dayOf(Date.parse('2026-11-26T15:00:00Z')),dayOf(Date.parse('2026-11-27T00:01:00+09:00')));assert.equal(dayOf(Date.parse('2026-11-26T14:59:59Z'))+1,dayOf(Date.parse('2026-11-26T15:00:00Z')))});
test('visible playing intervals only, cap suspended timers',()=>{const b={active:0,watch:0,works:Object.create(null)};samplePlayback(b,1,{visible:true,playing:true,workId:'a'});samplePlayback(b,1,{visible:true,playing:false,workId:'a'});samplePlayback(b,50,{visible:false,playing:true,workId:'a'});samplePlayback(b,50,{visible:true,playing:true,workId:'a'});assert.equal(b.active,4.5);assert.equal(b.watch,3.5);assert.equal(b.works.a,3.5)});
test('dedup browsers, live expiry, daily and work aggregates',()=>{const now=Date.now(),d=dayOf(now);const a={uid:'a',day:d,firstDay:d-1,updatedMs:now-1000,activeSeconds:100,watchSeconds:80,playing:true},b={uid:'b',day:d,firstDay:d,updatedMs:now-390000,activeSeconds:20,watchSeconds:0,playing:true};const s=summarizeStats([a,a,b,{...a,day:d-1,updatedMs:now-86400000}], [{uid:'a',day:d,workId:'test',watchSeconds:80}],d,now);assert.equal(s.live,1);assert.equal(s.watching,1);assert.equal(s.todayVisitors,2);assert.equal(s.newToday,1);assert.equal(s.unique30,2);assert.equal(s.avgWatch,80);assert.equal(s.returning30,.5);assert.equal(s.rankings[0].viewers,1)});
test('five minute batches retain watch duration and bound work totals',()=>{
 const b={active:0,watch:0,works:{}};
 for(let i=0;i<300;i++)samplePlayback(b,1,{visible:true,playing:true,workId:i<180?'a':'b'});
 assert.deepEqual(statsPayload(b),{active:300,watch:300,works:[['a',180],['b',120]]});
 assert.equal(3600000/STATS_FLUSH_MS,12);
 const capped=statsPayload({active:1000,watch:1000,works:{a:500,b:500}});
 assert.equal(capped.active,305);assert.equal(capped.works.reduce((n,[,s])=>n+s,0),capped.watch);
});
