import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { MARKER, RULES, isVerdictPrompt, appendFiveStageTopicRules } = require('../functions/five-stage-topic-comedy.js');

for (const required of [
  '게임, 음식, 직장, 가족, 연애·친구, 학교, 스포츠, 쇼핑·배달, IT·기기',
  '게임은 목록 제한 없이 문맥으로 인식',
  '게임 목록에 없어도 제목, 약칭, 플레이 행동',
  '다섯 단계는 모두 재미있어야 한다',
  '1막 reception 사건접수',
  '2막 investigation 수사보고',
  '3막 plaintiffArg 원고측 변론',
  '4막 defendantArg 피고측 변론',
  '5막 verdict 재판부 판결',
  '셀프 역전',
  '마지막 두 문장은 사건명만 바꿔 다른 사건에 붙일 수 없어야'
]) {
  assert.match(RULES, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), `five-stage topic comedy rule missing: ${required}`);
}

const unknownGamePrompt = `당신은 소소킹 판결소 작가다.\n[사건 내용]\n던파에서 친구가 파티 약속 시간에 안 왔다.\nreception investigation plaintiffArg defendantArg verdict`;
assert.equal(isVerdictPrompt(unknownGamePrompt), true);
const payload = { contents: [{ role: 'user', parts: [{ text: unknownGamePrompt }] }] };
assert.equal(appendFiveStageTopicRules(payload), true);
const injected = payload.contents[0].parts[0].text;
assert.match(injected, new RegExp(MARKER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(injected, /게임 목록에 없어도/);
assert.match(injected, /다섯 결과 중 어느 하나도 단순 설명문/);
assert.equal(appendFiveStageTopicRules(payload), false);

const ordinaryPrompt = `당신은 소소킹 판결소 작가다.\n[사건 내용]\n남편이 양말을 세탁바구니 옆에 또 벗어놨다.\nreception investigation plaintiffArg defendantArg verdict`;
const ordinaryPayload = { contents: [{ role: 'user', parts: [{ text: ordinaryPrompt }] }] };
assert.equal(appendFiveStageTopicRules(ordinaryPayload), true);
assert.match(ordinaryPayload.contents[0].parts[0].text, /집안일/);
assert.match(ordinaryPayload.contents[0].parts[0].text, /각 단계는 서로 다른 방식의 '상황 코미디 보상'/);

const main = fs.readFileSync('functions/main.js', 'utf8');
const humor = main.indexOf("require('./humor-prompt')");
const topic = main.indexOf("require('./comedy-topic-context')");
const fiveStage = main.indexOf("require('./five-stage-topic-comedy')");
const quality = main.indexOf("require('./document-output-quality')");
assert.ok(humor >= 0 && topic > humor && fiveStage > topic && quality > fiveStage, 'prompt patch load order is incorrect');

console.log('Five-stage topic comedy validation passed: every case gets domain-aware humor, unknown games are handled conditionally without a fixed-list dependency, and all five output stages have distinct comic duties.');
