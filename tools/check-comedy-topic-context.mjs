import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  CONTEXT_MARKER,
  GAME_PROFILES,
  BASE_COMEDY_DIRECTION,
  GENERIC_GAME_DIRECTION,
  detectGameContext,
  buildComedyDirection,
  isVerdictPrompt,
  appendComedyContextRules
} = require('../functions/comedy-topic-context.js');

const pubg = detectGameContext('배틀그라운드에서 친구가 파밍만 하다가 자기장에 늦게 합류했다.');
assert.equal(pubg?.id, 'pubg');
assert.match(pubg.mechanics, /생존 경쟁/);
const pubgDirection = buildComedyDirection('배그에서 스쿼드원이 혼자 파밍하다가 합류가 늦었다.');
for (const term of ['치킨', '뚝배기', '자기장', '파밍', '존버', '보급', '스쿼드']) {
  assert.match(pubgDirection, new RegExp(term), `PUBG context is missing ${term}`);
}
assert.match(pubgDirection, /전체 결과에서 0~2개/);
assert.match(pubgDirection, /가상 재연/);
assert.match(pubgDirection, /실제 플레이 기록/);

const lol = detectGameContext('롤에서 정글이 갱을 안 와서 친구랑 싸웠다.');
assert.equal(lol?.id, 'lol');
for (const term of ['라인', '정글', '갱', '와드', '한타']) {
  assert.match(buildComedyDirection('리그 오브 레전드에서 친구가 한타에 계속 늦었다.'), new RegExp(term));
}

const unknownGame = detectGameContext('처음 해본 게임에서 길드 레이드 약속을 깜빡했다.');
assert.equal(unknownGame?.id, 'generic-game');
assert.match(buildComedyDirection('처음 해본 게임에서 길드 레이드 약속을 깜빡했다.'), /확실히 아는 용어만 3~5개/);

const ordinary = buildComedyDirection('남편이 양말을 세탁바구니 옆에 또 벗어놨다.');
assert.match(ordinary, new RegExp(CONTEXT_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(ordinary, /감지된 게임 컨텍스트/);
assert.ok(BASE_COMEDY_DIRECTION.includes('공문서가 지나치게 진지해서 웃긴 글'));
assert.ok(GENERIC_GAME_DIRECTION.includes('게임의 핵심 플레이 구조'));
assert.ok(GAME_PROFILES.length >= 8);

const verdictPrompt = `당신은 소소킹 판결소 작가다.\n[사건 내용]\n배틀그라운드에서 친구가 스쿼드 합류를 안 했다.\nreception investigation plaintiffArg defendantArg verdict`;
assert.equal(isVerdictPrompt(verdictPrompt), true);
const payload = { contents: [{ role: 'user', parts: [{ text: verdictPrompt }] }] };
assert.equal(appendComedyContextRules(payload), true);
const injected = payload.contents[0].parts[0].text;
assert.match(injected, /감지된 게임 컨텍스트: 배틀그라운드/);
assert.match(injected, /마지막 두 문장이 가장 강한 콜백/);
assert.equal((injected.match(new RegExp(CONTEXT_MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length, 1);
assert.equal(appendComedyContextRules(payload), false);

const main = fs.readFileSync('functions/main.js', 'utf8');
const humorIndex = main.indexOf("require('./humor-prompt')");
const contextIndex = main.indexOf("require('./comedy-topic-context')");
const qualityIndex = main.indexOf("require('./document-output-quality')");
assert.ok(humorIndex >= 0 && contextIndex > humorIndex && qualityIndex > contextIndex);

console.log('Comedy topic context validation passed: deadpan comedy DNA, hypothetical investigation scenes, restrained puns, PUBG terminology, known-game profiles, generic-game fallback, and prompt deduplication are connected.');
