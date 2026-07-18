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
  assert.ok(prompt.includes(input.description.split('.')[0]), `${input.title}: 원문 사실 자료가 프롬프트에 없습니다.`);
  assert.ok(prompt.includes('원문은 사실 확인용 자료'), `${input.title}: 원문 복사 금지 지시가 없습니다.`);
  assert.ok(prompt.includes('4개 단어 이상 연속된 표현을 복사하지 마라'), `${input.title}: 연속 문구 복사 방지 지시가 없습니다.`);
  assert.ok(prompt.includes('전체 판결에서 3~8회'), `${input.title}: 핵심어 반복 제한이 없습니다.`);
  assert.ok(prompt.includes('AI의 자유로운 해석과 정색한 과몰입 개그 45%'), `${input.title}: 자유 해석 비율 지시가 없습니다.`);
  assert.ok(prompt.includes('표면 태도는 처음부터 끝까지 100% 진지'), `${input.title}: 완전 진지한 서술 태도 지시가 없습니다.`);
  assert.ok(prompt.includes('수사관·검사·변호인·재판부는 자신들이 우스운 일을 하고 있다는 사실을 인식하지 못한다'), `${input.title}: 자기해설 금지 지시가 없습니다.`);
  assert.ok(prompt.includes('시간선·증거·정황·인식 가능성·대체 가설'), `${input.title}: 수사 절차 지시가 부족합니다.`);
  assert.ok(prompt.includes('같은 사건을 서로 완전히 다르게 해석'), `${input.title}: 양측 독립 해석 지시가 없습니다.`);
  assert.ok(prompt.includes('주장 인정·배척'), `${input.title}: 재판부 증거 판단 지시가 없습니다.`);
  assert.ok(prompt.includes('orders 3개는 사건의 핵심을 활용하되 서로 다른 방식'), `${input.title}: 주문 역할 분리 지시가 없습니다.`);
  assert.ok(isCompleteJudgment(judgment), `${input.title}: 로컬 판결이 V2 계약을 충족하지 못합니다.`);
  assert.equal(evaluation.passed, true, `${input.title}: 재해석 품질 검사 실패 ${JSON.stringify(evaluation)}`);
  assert.ok(evaluation.mainAnchorMentions >= 3 && evaluation.mainAnchorMentions <= 10, `${input.title}: 대표 핵심어 반복 수가 과도합니다.`);
  assert.ok(evaluation.echoSectionHits <= 2, `${input.title}: 접수 원문을 여러 영역에서 반복했습니다.`);
  assert.ok(evaluation.heavyEchoSectionHits <= 1, `${input.title}: 접수 원문의 긴 구절이 반복됐습니다.`);
  assert.ok(evaluation.copiedPhraseHits <= 7, `${input.title}: 원문 연속 문구 복사가 과도합니다.`);
  assert.ok(evaluation.distinctSectionCount >= 10, `${input.title}: 판결 영역 간 문장 차별화가 부족합니다.`);
  assert.ok(evaluation.opposingClaimOverlap <= 0.72, `${input.title}: 원고·피고 주장이 같은 말을 반복합니다.`);
  assert.notEqual(judgment.plaintiffClaim, judgment.defendantClaim, `${input.title}: 양측 주장이 대립하지 않습니다.`);
  assert.ok(evaluation.seriousHumorHits >= 4, `${input.title}: 과잉 진지함에서 생기는 대비가 부족합니다.`);
  assert.ok(evaluation.courtroomProcedureHits >= 6, `${input.title}: 수사·공방·판단 절차가 부족합니다.`);
  assert.equal(evaluation.selfAwareJokeHits, 0, `${input.title}: 판결문이 스스로 농담을 설명하고 있습니다.`);
  assert.ok(judgment.incidentLevel.includes('소소위기'), `${input.title}: 사건 경계 단계가 없습니다.`);
  assert.ok(judgment.emergencyBriefing.length >= 170, `${input.title}: 재구성 브리핑 디테일이 부족합니다.`);
  assert.ok(judgment.impactAssessment.length >= 110, `${input.title}: 연쇄 피해 평가가 부족합니다.`);
  assert.ok(evaluation.tailoredOrders >= 2, `${input.title}: 사건 맞춤형 주문이 부족합니다.`);
}

console.log('Verified fully serious investigations, adversarial courtroom reasoning, dry contrast humor and tailored orders.');
