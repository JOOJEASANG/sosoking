import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CASES, CASE_BY_ID, dailyCase} from '../public/js/casefiles-data.js';
assert.ok(CASES.length>=8, '최소 8개 사건이 있어야 합니다.');
assert.equal(new Set(CASES.map(c=>c.id)).size, CASES.length, '중복 ID');
for(const c of CASES){
  assert.ok(c.title&&c.intro&&c.reveal&&c.hint, c.id+' 내용 누락');
  assert.ok([1,2,3].includes(c.level),c.id+' 잘못된 난이도');
  assert.equal(c.clues.length,4,c.id+' 증거가 4개인지 확인');
  assert.equal(c.witnesses.length,3,c.id+' 증인이 3명인지 확인');
  assert.equal(new Set(c.clues.map(x=>x.id)).size,4,c.id+' 중복 증거');
  assert.equal(new Set(c.witnesses.map(x=>x.id)).size,3,c.id+' 중복 증인');
  assert.ok(c.witnesses.some(x=>x.id===c.answer),c.id+' 범인 ID 오류');
  assert.ok(c.clues.some(x=>x.id===c.keyClue),c.id+' 결정적 증거 ID 오류');
  assert.ok(c.witnesses.some(x=>x.id===c.contradiction.witness),c.id+' 반박 대상 없음');
  assert.ok(c.clues.some(x=>x.id===c.contradiction.clue),c.id+' 반박 증거 없음');
}
assert.ok(CASE_BY_ID[dailyCase().id], '오늘의 사건 없음');
const index=readFileSync('public/index.html','utf8');
assert.match(index,/casefiles-app\.js/);
assert.match(index,/casefiles\.css/);
const client=readFileSync('public/js/casefiles-app.js','utf8');
assert.doesNotMatch(client,/httpsCallable|generateTrial|GEMINI_API_KEY|generateContent/,'게임 런타임에서 AI 호출 금지');
assert.match(client,/localStorage/);
const css=readFileSync('public/css/casefiles.css','utf8');
assert.match(css,/@media\(max-width:750px\)/);
console.log('CASEFILES VALID: '+CASES.length+' cases, 4 clues and 3 witnesses each, static play with zero AI calls.');