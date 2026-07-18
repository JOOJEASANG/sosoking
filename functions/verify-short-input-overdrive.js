const assert = require('node:assert/strict');
const {
  buildCaseProfile,
  buildStoryPrompt,
  buildStoryFallback,
  isSparseProfile,
  evaluateStorySpecificity,
} = require('./judgment-story-v2');
const { isCompleteJudgment } = require('./judgment-v2');

const shortCases = [
  {
    title: '라면 국물 한입 사건',
    description: '친구가 내 라면 국물 한입 먹음',
    desiredVerdict: '다음 라면은 건드리지 않기',
    grievanceIndex: 7,
    headline: '라면 국물 선점 관련 식탁질서 침해 사건',
    defendantName: '친구',
    judgeType: '과몰입형',
    category: { id: 'food', label: '음식·식탐' },
  },
  {
    title: '리모컨 원위치 불이행 사건',
    description: '동생이 리모컨 안 갖다 놓음',
    desiredVerdict: '보고 나면 제자리에 두기',
    grievanceIndex: 6,
    headline: '리모컨 관리체계 이탈 사건',
    defendantName: '동생',
    judgeType: '논리집착형',
    category: { id: 'family', label: '가족·생활' },
  },
  {
    title: '카톡 답장 실종 사건',
    description: '친구가 카톡 읽고 답장 안함',
    desiredVerdict: '확인했으면 짧게라도 답하기',
    grievanceIndex: 5,
    headline: '디지털 응답망 장기 공백 사건',
    defendantName: '친구',
    judgeType: '드립형',
    category: { id: 'digital', label: '디지털·연락' },
  },
];

for (const input of shortCases) {
  const profile = buildCaseProfile(input);
  const prompt = buildStoryPrompt(profile);
  const judgment = buildStoryFallback(profile);
  const evaluation = evaluateStorySpecificity(judgment, profile);

  assert.equal(isSparseProfile(profile), true, `${input.title}: 짧은 접수로 감지되지 않았습니다.`);
  assert.ok(prompt.includes('[짧은 접수 확장 규칙]'), `${input.title}: 짧은 입력 전용 확장 지시가 없습니다.`);
  assert.ok(prompt.includes('판결을 축약하거나 일반적인 문장으로 채우지 마라'), `${input.title}: 짧은 입력 축약 방지 지시가 없습니다.`);
  assert.ok(prompt.includes('수사 쟁점과 대체 가설로 확장하라'), `${input.title}: 부족한 사실을 안전하게 확장하는 지시가 없습니다.`);
  assert.ok(prompt.includes('다섯 관점으로 분해하라'), `${input.title}: 단일 행동의 다각도 해석 지시가 없습니다.`);
  assert.ok(prompt.includes('최소 세 번의 웃음 지점'), `${input.title}: 과잉 진지함의 대비 지시가 없습니다.`);
  assert.ok(prompt.includes('처음부터 끝까지 실제 중대사건처럼 대응'), `${input.title}: 진지한 역할극 유지 지시가 없습니다.`);
  assert.ok(isCompleteJudgment(judgment), `${input.title}: 짧은 입력에서도 완성 판결 구조가 유지되지 않습니다.`);
  assert.ok(evaluation.seriousHumorHits >= 4, `${input.title}: 과잉 진지함과 사소함의 대비가 부족합니다.`);
  assert.ok(evaluation.courtroomProcedureHits >= 6, `${input.title}: 수사·공방·판단 절차가 부족합니다.`);
  assert.ok(evaluation.tailoredOrders >= 2, `${input.title}: 사건 맞춤 주문이 부족합니다.`);
  assert.equal(evaluation.selfAwareJokeHits, 0, `${input.title}: 판결이 스스로 농담임을 설명합니다.`);
}

console.log('Verified short inputs expand into serious, exaggerated and case-specific courtroom stories.');