const assert = require('node:assert/strict');
const {
  buildCaseProfile,
  buildStoryPrompt,
  buildStoryFallback,
  evaluateStorySpecificity,
} = require('./judgment-story-v2');
const { isCompleteJudgment } = require('./judgment-v2');

const cases = [
  {
    title: '마지막 만두 선점 사건',
    description: '저녁 식탁에 만두가 한 개 남아 있었는데 남편이 내가 젓가락을 드는 순간 먼저 집어 먹었다. 먹고 나서 미안하다는 말도 없이 단무지만 권했다.',
    desiredVerdict: '다음 만두 주문 때 마지막 두 개는 내 몫으로 해줬으면 좋겠다.',
    grievanceIndex: 8,
    headline: '마지막 만두 선점 관련 식생활질서 및 최후섭취권 침해 사건',
    defendantName: '남편',
    judgeType: '과몰입형',
    category: { id: 'food', label: '음식·식탐' },
  },
  {
    title: '리모컨 소파 틈 은닉 사건',
    description: '동생이 TV를 보다가 리모컨을 소파 틈에 넣어두고 방으로 들어갔다. 나는 20분 동안 거실과 주방을 찾았고 동생은 위치를 알면서도 웃고만 있었다.',
    desiredVerdict: '앞으로 리모컨을 제자리에 두게 해달라.',
    grievanceIndex: 7,
    headline: '리모컨 소파 틈 은닉 관련 공동생활질서 침해 사건',
    defendantName: '동생',
    judgeType: '논리집착형',
    category: { id: 'family', label: '가족·생활' },
  },
];

for (const input of cases) {
  const profile = buildCaseProfile(input);
  const prompt = buildStoryPrompt(profile);
  const judgment = buildStoryFallback(profile);
  const evaluation = evaluateStorySpecificity(judgment, profile);

  assert.ok(profile.facts.length >= 2, `${input.title}: 사건 사실 분리가 부족합니다.`);
  assert.ok(profile.anchors.length >= 2, `${input.title}: 사건 핵심어 추출이 부족합니다.`);
  assert.ok(prompt.includes(input.description.split('.')[0]), `${input.title}: 원문 사실이 프롬프트에 없습니다.`);
  assert.ok(prompt.includes('판결문 80%'), `${input.title}: 진지함/개그 비율 지시가 없습니다.`);
  assert.ok(prompt.includes('orders 3개 중 최소 2개'), `${input.title}: 맞춤형 주문 지시가 없습니다.`);
  assert.ok(isCompleteJudgment(judgment), `${input.title}: 로컬 판결이 V2 계약을 충족하지 못합니다.`);
  assert.equal(evaluation.passed, true, `${input.title}: 사건 고유성 검사 실패 ${JSON.stringify(evaluation)}`);
  assert.ok(judgment.facts.includes(profile.mainAnchor), `${input.title}: 사건 경위에 핵심어가 없습니다.`);
  assert.ok(judgment.investigation.includes(profile.mainAnchor), `${input.title}: 수사 과정에 핵심어가 없습니다.`);
  assert.ok(judgment.prosecution.includes(profile.mainAnchor), `${input.title}: 검사 주장에 핵심어가 없습니다.`);
  assert.ok(judgment.defense.includes(profile.mainAnchor), `${input.title}: 변호인 주장에 핵심어가 없습니다.`);
  assert.ok(judgment.opinion.includes(profile.mainAnchor), `${input.title}: 재판부 판단에 핵심어가 없습니다.`);
  assert.ok(judgment.orders.filter(order => order.text.includes(profile.mainAnchor)).length >= 2, `${input.title}: 사건 맞춤형 주문이 부족합니다.`);
}

console.log('Verified case-specific facts, serious tone, over-investigation humor and tailored orders.');
