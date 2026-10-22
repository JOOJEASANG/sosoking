import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CASES,CASE_BY_ID,dailyCase} from '../public/js/casefiles-data.js';
import {SCENES,matchesLink,getScene} from '../public/js/casefiles-scenes.js';
import {MAX_SCORE,scoreCase} from '../public/js/casefiles-engine.js';

assert.ok(CASES.length>=8,'최소 8개 검수 사건 필요');
assert.equal(new Set(CASES.map(c=>c.id)).size,CASES.length,'중복 사건 ID');
assert.equal(Object.keys(SCENES).length,CASES.length,'사건별 심화 스토리 누락');
assert.equal(MAX_SCORE,100,'점수 체계 변경 오류');
for(const c of CASES){
 const sc=getScene(c.id);
 assert.ok(sc,c.id+' 심화 스토리 누락');
 assert.ok(c.title&&c.intro&&c.reveal&&c.hint,c.id+' 내용 누락');
 assert.ok([1,2,3].includes(c.level),c.id+' 난이도 오류');
 assert.equal(c.clues.length,4,c.id+' 증거 4개 필요');
 assert.equal(c.witnesses.length,3,c.id+' 증인 3명 필요');
 assert.equal(new Set(c.clues.map(x=>x.id)).size,4,c.id+' 중복 증거');
 assert.equal(new Set(c.witnesses.map(x=>x.id)).size,3,c.id+' 중복 증인');
 assert.ok(c.witnesses.some(x=>x.id===c.answer),c.id+' 범인 ID 오류');
 assert.ok(c.clues.some(x=>x.id===c.keyClue),c.id+' 결정적 증거 오류');
 assert.ok(c.witnesses.some(x=>x.id===c.contradiction.witness),c.id+' 반박 대상 누락');
 assert.ok(c.clues.some(x=>x.id===c.contradiction.clue),c.id+' 반박 증거 누락');
 assert.equal(sc.links.length,2,c.id+' 증거 결합 2개 필요');
 const linkIds=sc.links.flatMap(x=>x.ids);
 assert.equal(linkIds.length,4,c.id+' 증거 조합 4개 연결 필요');
 assert.equal(new Set(linkIds).size,4,c.id+' 증거가 두 조합에 중복됨');
 for(const link of sc.links){
  assert.equal(link.ids.length,2,c.id+' 증거 조합 크기 오류');
  assert.ok(link.ids.every(id=>c.clues.some(x=>x.id===id)),c.id+' 미등록 증거 조합');
  assert.ok(matchesLink(link,link.ids[0],link.ids[1]),c.id+' 조합 검사 오류');
  assert.ok(matchesLink(link,link.ids[1],link.ids[0]),c.id+' 조합 순서 오류');
  assert.ok(!matchesLink(link,link.ids[0],link.ids[0]),c.id+' 자기 증거 조합 허용');
  assert.ok(link.title&&link.reason,c.id+' 결합 해설 누락');
 }
 assert.ok(sc.opening&&sc.tension&&sc.confession&&sc.epilogue&&sc.bench,c.id+' 스토리/반전 누락');
 assert.equal(sc.timeline.options.length,3,c.id+' 타임라인 선택지 3개 필요');
 assert.equal(new Set(sc.timeline.options).size,3,c.id+' 타임라인 선택지 중복');
 assert.ok([0,1,2].includes(sc.timeline.correct),c.id+' 타임라인 정답 범위 오류');
 const perfect={
   culprit:c.answer,keyClue:c.keyClue,timeline:String(sc.timeline.correct),
   found:c.clues.map(x=>x.id),links:[0,1],contradiction:true,mistakes:0,hint:false
 };
 const result=scoreCase(c,sc,perfect);
 assert.equal(result.score,100,c.id+' 완벽 추리 점수 오류');
 assert.equal(result.solved,true,c.id+' 정답 판정 오류');
 const wrong=scoreCase(c,sc,{...perfect,culprit:c.witnesses.find(x=>x.id!==c.answer).id});
 assert.equal(wrong.solved,false,c.id+' 오답 판정 오류');
 assert.equal(wrong.score,65,c.id+' 오답 감점 오류');
 const penalty=scoreCase(c,sc,{...perfect,mistakes:2,hint:true});
 assert.equal(penalty.score,84,c.id+' 힌트/실수 감점 오류');
 const noEvidence=scoreCase(c,sc,{...perfect,found:[]});
 assert.equal(noEvidence.solved,false,c.id+' 획득하지 않은 증거 제출 허용');
 assert.equal(noEvidence.score,74,c.id+' 미수집 증거 감점 오류');
}
assert.ok(CASE_BY_ID[dailyCase().id],'오늘의 추천 사건 없음');
const index=readFileSync('public/index.html','utf8');
assert.match(index,/casefiles-app\.js/);
assert.match(index,/casefiles\.css/);
const client=readFileSync('public/js/casefiles-app.js','utf8');
assert.doesNotMatch(client,/httpsCallable|generateTrial|GEMINI_API_KEY|generateContent|firebase-firestore/i,'게임 런타임에서 생성형 AI·Firestore 호출 금지');
for(const action of ['pair-pick','pair-check','witness','probe','challenge','timeline','culprit','key','submit']){
 assert.ok(client.includes("action==='"+action+"'"),action+' 인터랙션 누락');
}
assert.match(client,/localStorage/);
assert.match(client,/scoreCase\(c,getScene\(c\.id\),run\)/);
const css=readFileSync('public/css/casefiles.css','utf8');
assert.match(css,/deduction-lab/);
assert.match(css,/court-timeline/);
assert.match(css,/@media\(max-width:750px\)/);
console.log('CASEFILES V2 VALID: '+CASES.length+' cases, 16 playable evidence fusions, 8 timelines, structured cross examination, scoring and zero live AI calls.');
