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
 for(const p of ['life.js','life-core.js','life-shared.js','life-board.js','life-polls.js','life-local.js','phone.js']){
  const r=spawnSync(process.execPath,['--check','public/js/'+p],{encoding:'utf8'});assert.equal(r.status,0,p+': '+r.stderr);
 }
 const home=fs.readFileSync('public/index.html','utf8');assert.equal((home.match(/class="tool" data-tool=/g)||[]).length,6);assert.match(home,/class="mobilebar"/);
 const ferry=fs.readFileSync('public/ferry.html','utf8');assert.match(ferry,/name="checked"/);assert.match(ferry,/name="departure"/);assert.match(ferry,/mtis\.komsa\.or\.kr/);
 const rules=fs.readFileSync('firestore.rules','utf8');assert.equal((rules.match(/match \/\{document=\*\*\}/g)||[]).length,1);assert.match(rules,/match \/lifeComments\/\{id\}/);assert.match(rules,/match \/lifeReports\/\{id\}/);assert.match(rules,/function validVote/);
});
