import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {aggregatePoll,csvText,makeShift,shiftIcs,validDate,routeStatus,filterPosts,uniqueOptions} from '../public/js/life-core.js';
import {convertOldNumber} from '../public/js/phone-rules.js';
test('attendance counts people separately from responses and preserves old votes',()=>{
 const s=aggregatePoll({mode:'attendance',options:['참석','불참','미정']},[{choices:[0],party:4,alias:'A'},{choice:0},{choices:[1],party:1},{choices:[2],party:1}]);
 assert.deepEqual(s.counts,[2,1,1]);assert.deepEqual(s.people,[5,1,1]);assert.equal(s.responses,4);
});
test('multi-date choices are unique and totals need not equal respondent count',()=>{
 const s=aggregatePoll({mode:'dateMulti',options:['A','B','C']},[{choices:[0,1,1]},{choices:[1,2]}]);assert.deepEqual(s.counts,[1,2,1]);assert.equal(s.responses,2);
});
test('order aggregation calculates quantities and price totals',()=>{
 const s=aggregatePoll({mode:'order',options:['A','B'],prices:[5000,7000]},[{quantities:[2,1]},{quantities:[1,0]}]);assert.equal(s.quantity,4);assert.equal(s.total,22000);assert.deepEqual(s.counts,[3,1]);assert.deepEqual(s.people,[2,1]);
});
test('CSV escapes quotes and spreadsheet formulas',()=>{
 const s=csvText([['=SUM(1)','"x"','한글'],[' @test',0,'a,b']]);assert.ok(s.startsWith('\ufeff'));assert.ok(s.includes("\"'=SUM(1)\""));assert.ok(s.includes('"""x"""'));assert.ok(s.includes("\"' @test\""));
});
test('calendar uses UTC arithmetic across month boundaries and before pattern start',()=>{
 const days=makeShift('2028-03-01','2028-02',['주간','야간','휴무']);assert.equal(days.length,29);assert.equal(days[28].kind,'휴무');assert.equal(days[27].kind,'야간');assert.equal(validDate('2026-02-29'),false);assert.throws(()=>makeShift('2026-02-30','2026-02',['A']));
 const ics=shiftIcs(days.slice(-1),new Date('2026-11-24T00:00:00Z'));assert.ok(ics.includes('DTSTART;VALUE=DATE:20280229'));assert.ok(ics.includes('DTEND;VALUE=DATE:20280301'));assert.ok(ics.includes('SUMMARY:휴무'));
});
test('ferry status and regional route search preserve source-based dates',()=>{
 const p={title:'섬 운항 안내',body:'월요일',category:'선박 시간표',meta:{region:'전남',departure:'목포',arrival:'흑산도',checked:'2026-11-01',validUntil:'2026-12-01'},createdAt:{seconds:1}};
 assert.equal(routeStatus(p.meta,'2026-11-24'),'확인일 등록');assert.equal(routeStatus(p.meta,'2026-12-02'),'유효기간 경과');assert.equal(routeStatus({checked:'2026-01-01'},'2026-11-24'),'재확인 필요');assert.equal(filterPosts([p],{region:'전남',departure:'목포',arrival:'흑산',search:'섬 월요일'}).length,1);assert.equal(filterPosts([p],{region:'제주'}).length,0);assert.deepEqual(uniqueOptions(' A,B\n A, C '),['A','B','C']);
});
test('historical phone rule returns a calculation, not a contact lookup',()=>{
 assert.equal(convertOldNumber('011-234-5678').estimated,'010-5234-5678');assert.equal(convertOldNumber('010-1234-5678').ok,false);assert.equal(convertOldNumber('011-100-1234').ok,false);
});
test('each JavaScript module is syntactically valid and portal uses focused services',()=>{
 for(const p of ['life.js','life-core.js','life-shared.js','life-board.js','life-polls.js','life-local.js','phone.js','local-ferry.js','field-info.js','group-plan.js','memory-core.js','memories.js','election-core.js','election.js']){
  const r=spawnSync(process.execPath,['--check','public/js/'+p],{encoding:'utf8'});assert.equal(r.status,0,p+': '+r.stderr);
 }
 const home=fs.readFileSync('public/index.html','utf8');const catalog=fs.readFileSync('public/tools.html','utf8');assert.equal((catalog.match(/class="tool" data-tool=/g)||[]).length,10);assert.equal((home.match(/class="tool" data-tool=/g)||[]).length,0);assert.match(home,/소<\/b>소한 불편/);assert.match(home,/class="mobilebar"/);
 const ferry=fs.readFileSync('public/ferry.html','utf8');assert.match(ferry,/name="checked"/);assert.match(ferry,/name="departure"/);assert.match(ferry,/localFerryResults/);
 const rules=fs.readFileSync('firestore.rules','utf8');assert.equal((rules.match(/match \/\{document=\*\*\}/g)||[]).length,1);assert.match(rules,/match \/lifeComments\/\{id\}/);assert.match(rules,/match \/lifeReports\/\{id\}/);assert.match(rules,/function validVote/);
});

test('settlement exactly reconciles every won including indivisible amounts',async()=>{
 const {settlePayments}=await import('../public/js/life-core.js');
 const s=settlePayments([{name:'A',paid:10000},{name:'B',paid:1},{name:'C',paid:0}]);
 assert.equal(s.total,10001);assert.deepEqual(s.people.map(p=>p.share),[3334,3334,3333]);assert.equal(s.transfers.reduce((a,t)=>a+t.amount,0),6666);assert.equal(s.people.reduce((a,p)=>a+p.balance,0),0);
 assert.throws(()=>settlePayments([{name:'A',paid:1},{name:'A',paid:0}]));
});
test('small-port ferry records contain source metadata and separate season and return times',()=>{
 const data=JSON.parse(fs.readFileSync('public/data/local-ferry.json','utf8'));assert.equal(data.rows.length,24);assert.equal(new Set(data.rows.map(r=>r.id)).size,24);assert.ok(data.rows.some(r=>r.sourceType==='블로그'));
 for(const r of data.rows){assert.match(r.sourceUrl,/^https:\/\//);assert.match(r.checked,/^2026-11-2[45]$/);assert.ok(r.note);assert.ok(r.variants.length);for(const v of r.variants){assert.ok(v.out.length||v.back.length||/호출|수시/.test(v.label));assert.ok([...v.out,...v.back].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))}}
 const jukdo=data.rows.find(r=>r.id==='hongseong-jukdo');assert.equal(jukdo.variants.length,4);assert.ok(jukdo.note.includes('화요일'));assert.ok(!jukdo.variants[0].out.includes('17:00'));
 for(const name of ['index','event','ferry','community','orders','old-phone','shift','my','help','info','settlement']){const html=fs.readFileSync('public/'+name+'.html','utf8');assert.ok(!html.includes('data-nav="ferry"'),name);assert.ok(html.includes('data-nav="info"'),name)}
});

test('field information has a real source and confirmation date',()=>{const data=JSON.parse(fs.readFileSync('public/data/field-info.json','utf8'));assert.equal(data.rows.length,12);for(const r of data.rows){assert.match(r.source,/^https:/);assert.ok(r.checked&&r.body&&r.kind)}});

test('allocation respects group capacity and reports overflow',async()=>{const {allocateGroups}=await import('../public/js/life-core.js');const a=allocateGroups(['A','B','C','D'],[{name:'1',capacity:1},{name:'2',capacity:2}]);assert.equal(a.groups[0].people.length,1);assert.equal(a.groups[1].people.length,2);assert.deepEqual(a.unassigned,['D']);assert.throws(()=>allocateGroups(['A','A'],[{name:'1',capacity:2}]))});

test('little memories: month end and leap year, elapsed days, due override, backup validation',async()=>{
 const {addInterval,memoryState,normalizeMemory,parseMemoryBackup}=await import('../public/js/memory-core.js');
 assert.equal(addInterval('2026-01-31','month',1),'2026-02-28');assert.equal(addInterval('2028-02-29','year',1),'2029-02-28');assert.equal(addInterval('2026-12-31','day',1),'2027-01-01');
 const item=normalizeMemory({id:'test',title:'미용실',category:'생활·미용',unit:'month',interval:1,due:'',memo:'',history:[{date:'2026-10-01',amount:null,note:''},{date:'2026-10-31',amount:25000,note:'커트'}]});
 assert.deepEqual(memoryState(item,'2026-11-25'),{last:'2026-10-31',due:'2026-11-30',elapsed:25,remaining:5});
 assert.equal(memoryState({...item,due:'2026-11-20'},'2026-11-25').remaining,-5);
 assert.deepEqual(parseMemoryBackup(JSON.stringify({schema:1,items:[item]})),[item]);
 assert.throws(()=>parseMemoryBackup(JSON.stringify({schema:1,items:[item,item]})));assert.throws(()=>normalizeMemory({...item,history:[{date:'2026-02-30',amount:null,note:''}]}));
});

test('individual burden settlement balances and validates total',async()=>{const {settlePayments}=await import('../public/js/life-core.js');const s=settlePayments([{name:'A',paid:10000,share:3000},{name:'B',paid:0,share:7000}],true);assert.deepEqual(s.transfers,[{from:'B',to:'A',amount:7000}]);assert.throws(()=>settlePayments([{name:'A',paid:10000,share:0},{name:'B',paid:0,share:0}],true))});
test('election tally handles abstention, ties and one-candidate approval',async()=>{const {candidateNames,countElection,makeCode,codeHash}=await import('../public/js/election-core.js');assert.deepEqual(candidateNames(' A\nB '),['A','B']);assert.throws(()=>candidateNames('A\nA'));assert.match(countElection(['A','B'],[0,1,-1]).summary,/동점/);assert.equal(countElection(['A'],[0,0,1,-1]).summary,'찬성 과반');assert.equal(countElection(['A'],[-1]).summary,'유효표 없음');const code=makeCode();assert.match(code,/^[0-9a-f]{32}$/);assert.match(await codeHash(code),/^[0-9a-f]{64}$/);assert.equal(await codeHash(code),await codeHash(code.toUpperCase()));await assert.rejects(codeHash('bad'))});
