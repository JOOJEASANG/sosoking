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
    expectedMainAnchor: '만두',
    expectedCategoryId: 'food',
  },
  {
    title: '리모컨 소파 틈 은닉 사건',
    description: '동생이 TV를 보다가 리모컨을 소파 틈에 넣어두고 방으로 들어갔다. 나는 20분 동안 거실과 주방을 찾았고 동생은 위치를 알면서도 웃고만 있었다.',
    desiredVerdict: '앞으로 리모컨을 제자리에 두게 해달라.',
    grievanceIndex: 7,
    headline: '리모컨 소파 틈 은닉 관련 공동생활질서 침해 사건',
    defendantName: '동생',
    judgeType: '논리집착형',
    category: { id: 'digital', label: '디지털·연락' },
    expectedMainAnchor: '리모컨',
    expectedCategoryId: 'family',
  },
  {
    title: 'YouTube 자동재생 독점 사건',
    description: '친구가 내 휴대폰으로 YouTube를 보다가 자동재생을 켜 둔 채 돌려주었다. 다음 날 추천 영상이 전부 친구 취향으로 바뀌었다.',
    desiredVerdict: '내 추천 알고리즘을 원래대로 복구하는 데 협조했으면 한다.',
    grievanceIndex: 6,
    headline: 'YouTube 추천질서 교란 사건',
    defendantName: '친구',
    judgeType: '드립형',
    category: { id: 'digital', label: '디지털·연락' },
    expectedMainAnchor: 'YouTube',
    expectedCategoryId: 'digital',
  },
];

for (const input of cases) {
  const profile = buildCaseProfile(input);
  const prompt = buildStoryPrompt(profile);
  const judgment = buildStoryFallback(profile);
  const evaluation = evaluateStorySpecificity(judgment, profile);

  assert.equal(profile.mainAnchor, input.expectedMainAnchor, `${input.title}: 대표 핵심어가 실제 물건이 아닙니다.`);
  assert.equal(profile.categoryId, input.expectedCategoryId, `${input.title}: 사건 맥락 분류가 맞지 않습니다.`);
  assert.ok(profile.facts.length >= 2, `${input.title}: 사건 사실 분리가 부족합니다.`);
  assert.ok(profile.anchors.length >= 2, `${input.title}: 사건 핵심어 추출이 부족합니다.`);
  assert.ok(prompt.includes(input.description.split('.')[0]), `${input.title}: 원문 사실이 프롬프트에 없습니다.`);
  assert.ok(prompt.includes('진지함 60%'), `${input.title}: 조정된 진지함 비율 지시가 없습니다.`);
  assert.ok(prompt.includes('과몰입 개그 40%'), `${input.title}: 강화된 개그 비율 지시가 없습니다.`);
  assert.ok(prompt.includes('웃음 구조는 세 번'), `${input.title}: 세 번의 웃음 구조 지시가 없습니다.`);
  assert.ok(prompt.includes('plaintiffClaim'), `${input.title}: 원고측 짧은 주장 지시가 없습니다.`);
  assert.ok(prompt.includes('defendantClaim'), `${input.title}: 피고측 짧은 반박 지시가 없습니다.`);
  assert.ok(prompt.includes('orders 3개 모두 사건 맞춤형'), `${input.title}: 맞춤형 주문 지시가 없습니다.`);
  assert.ok(isCompleteJudgment(judgment), `${input.title}: 로컬 판결이 V2 계약을 충족하지 못합니다.`);
  assert.equal(evaluation.passed, true, `${input.title}: 긴급 과몰입 검사 실패 ${JSON.stringify(evaluation)}`);
  assert.equal(evaluation.emergencyAnchorHits, 3, `${input.title}: 긴급 브리핑 전 영역에 대표 물건이 없습니다.`);
  assert.equal(evaluation.claimAnchorHits, 2, `${input.title}: 양측 핵심 주장에 대표 물건이 없습니다.`);
  assert.ok(evaluation.plaintiffClaimLength >= 55 && evaluation.plaintiffClaimLength <= 320, `${input.title}: 원고측 주장이 너무 짧거나 깁니다.`);
  assert.ok(evaluation.defendantClaimLength >= 55 && evaluation.defendantClaimLength <= 320, `${input.title}: 피고측 반박이 너무 짧거나 깁니다.`);
  assert.notEqual(judgment.plaintiffClaim, judgment.defendantClaim, `${input.title}: 양측 주장이 대립하지 않습니다.`);
  assert.ok(evaluation.seriousHumorHits >= 4, `${input.title}: 큰일처럼 부풀리는 장치가 부족합니다.`);
  assert.ok(judgment.incidentLevel.includes('소소위기'), `${input.title}: 사건 경계 단계가 없습니다.`);
  assert.ok(judgment.breakingNews.toLowerCase().includes(profile.mainAnchor.toLowerCase()), `${input.title}: 긴급속보에 핵심어가 없습니다.`);
  assert.ok(judgment.emergencyBriefing.length >= 180, `${input.title}: 긴급 브리핑 디테일이 부족합니다.`);
  assert.ok(judgment.impactAssessment.length >= 120, `${input.title}: 연쇄 피해 평가가 부족합니다.`);
  assert.ok(judgment.facts.toLowerCase().includes(profile.mainAnchor.toLowerCase()), `${input.title}: 사건 경위에 핵심어가 없습니다.`);
  assert.ok(judgment.investigation.toLowerCase().includes(profile.mainAnchor.toLowerCase()), `${input.title}: 수사 과정에 핵심어가 없습니다.`);
  assert.ok(judgment.prosecution.toLowerCase().includes(profile.mainAnchor.toLowerCase()), `${input.title}: 검사 주장에 핵심어가 없습니다.`);
  assert.ok(judgment.defense.toLowerCase().includes(profile.mainAnchor.toLowerCase()), `${input.title}: 변호인 주장에 핵심어가 없습니다.`);
  assert.ok(judgment.opinion.toLowerCase().includes(profile.mainAnchor.toLowerCase()), `${input.title}: 재판부 판단에 핵심어가 없습니다.`);
  assert.ok(judgment.orders.filter(order => order.text.toLowerCase().includes(profile.mainAnchor.toLowerCase())).length >= 2, `${input.title}: 사건 맞춤형 주문이 부족합니다.`);
}

console.log('Verified detailed emergency briefing, short opposing claims, courtroom escalation and tailored orders.');
