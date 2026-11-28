import {test} from 'node:test';
import assert from 'node:assert/strict';
import {removedVideoIds,excludeOriginals,deleteWorksPlan} from './flix-moderation.mjs';
const a='aaaaaaa0001',b='bbbbbbb0001',c='ccccccc0001';
const work=(id,...ids)=>({id,episodes:ids.map(videoId=>({videoId}))});
test('deleting works preserves other works and excludes every unique removed original',()=>{
 const before=[work('one',a,a,b),work('two',c)];
 const p=deleteWorksPlan(before,['one'],{excluded:[c],held:[a],trusted:[]});
 assert.deepEqual(p.items,[before[1]]);assert.deepEqual(p.removed,[a,b]);
 assert.deepEqual(p.settings.excluded,[c,a,b]);assert.deepEqual(p.settings.held,[]);
 assert.equal(before.length,2);
});
test('a deleted chapter does not exclude the original if another chapter remains',()=>{
 assert.deepEqual(removedVideoIds([work('one',a,a,b)],[work('one',a)]),[b]);
});
test('stale selection and a full exclusion list fail without a partial deletion',()=>{
 assert.throws(()=>deleteWorksPlan([work('one',a)],['missing'],{}),/변경/);
 const settings={excluded:Array.from({length:500},(_,i)=>'x'+String(i).padStart(10,'0'))};
 assert.throws(()=>excludeOriginals(settings,[a]),/500/);
 assert.equal(settings.excluded.length,500);
});
