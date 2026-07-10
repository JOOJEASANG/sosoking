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
    title: '공원 빵 리트리버 무단취식 사건',
    description: '공원에서 빵을 먹고 있었는데 산책하던 리트리버 한마리가 내가 한눈판 사이 내 빵을 먹어버렸음',
    desiredVerdict: '보호자가 같은 빵을 물어줬으면 좋겠다.',
    grievanceIndex: 7,
    headline: '공원 빵 무단취식 사건',
    defendantName: '',
    judgeType: '드립형',
    category: { id: 'food', label: '음식·식탐' },
    expectedMainAnchor: '빵',
    expectedSubject: '리트리버',
    expectedComedyMode: 'animal-food',
  },
  {
    title: '네비게이션 목적지 오안내 사건',
    description: '약속장소로 가기위해 차량 네비게이션 설정을 했는데 도착해보니 다른 장소를 알려줌 그래서 약속 펑크남.',
    desiredVerdict: '다음에는 정확한 장소를 확인해줬으면 한다.',
    grievanceIndex: 8,
    headline: '목적지 오안내 사건',
    defendantName: '차량 네비게이션',
    judgeType: '드립형',
    category: { id: 'late', label: '약속·지각' },
    expectedMainAnchor: '네비게이션',
    expectedSubject: '차량 네비게이션',
    expectedComedyMode: 'navigation',
  },
  {
    title: '마지막 만두 선점 사건',
    description: '저녁 식탁에 만두가 한 개 남아 있었는데 남편이 내가 젓가락을 드는 순간 먼저 집어 먹었다. 먹고 나서 미안하다는 말도 없이 단무지만 권했다.',
    desiredVerdict: '다음 만두 주문 때 마지막 두 개는 내 몫으로 해줬으면 좋겠다.',
    grievanceIndex: 8,
    headline: '마지막 만두 선점 사건',
    defendantName: '남편',
    judgeType: '과몰입형',
    category: { id: 'food', label: '음식·식탐' },
    expectedMainAnchor: '만두',
    expectedSubject: '남편',
    expectedComedyMode: 'food',
  },
  {
    title: '리모컨 소파 틈 은닉 사건',
    description: '동생이 TV를 보다가 리모컨을 소파 틈에 넣어두고 방으로 들어갔다. 나는 20분 동안 거실과 주방을 찾았고 동생은 위치를 알면서도 웃고만 있었다.',
    desiredVerdict: '앞으로 리모컨을 제자리에 두게 해달라.',
    grievanceIndex: 7,
    headline: '리모컨 은닉 사건',
    defendantName: '동생',
    judgeType: '논리집착형',
    category: { id: 'digital', label: '디지털·연락' },
    expectedMainAnchor: '리모컨',
    expectedSubject: '동생',
    expectedComedyMode: 'general',
  },
];

for (const input of cases) {
  const profile = buildCaseProfile(input);
  const prompt = buildStoryPrompt(profile);
  const judgment = buildStoryFallback(profile);
  const evaluation = evaluateStorySpecificity(judgment, profile);

  assert.equal(profile.mainAnchor, input.expectedMainAnchor, `${input.title}: 대표 핵심어가 사건 물건이 아닙니다.`);
  assert.equal(profile.subjectCue, input.expectedSubject, `${input.title}: 행위 주체를 찾지 못했습니다.`);
  assert.equal(profile.comedyKit.id, input.expectedComedyMode, `${input.title}: 사건별 코미디 프레임이 맞지 않습니다.`);
  assert.ok(prompt.includes('첫 두 문장 안에'), `${input.title}: 첫 화면 사건 명확성 지시가 없습니다.`);
  assert.ok(prompt.includes('말장난·아재개그'), `${input.title}: 사건 맞춤형 말장난 지시가 없습니다.`);
  assert.ok(prompt.includes('"comedyLines"'), `${input.title}: 강제 코미디 출력 필드가 없습니다.`);
  assert.ok(prompt.includes('추상어를 쓰지 않는다'), `${input.title}: 추상적인 공통 판결 방지 지시가 없습니다.`);
  assert.ok(isCompleteJudgment(judgment), `${input.title}: 로컬 판결이 V2 계약을 충족하지 못합니다.`);
  assert.equal(evaluation.passed, true, `${input.title}: 구체적 코미디 품질 검사 실패 ${JSON.stringify(evaluation)}`);
  assert.ok(judgment.comedyLines.length >= 2, `${input.title}: 결정적 웃음 문장이 부족합니다.`);
  assert.ok(evaluation.openingConcreteHits >= 2, `${input.title}: 첫 문장만 읽어서는 사건이 보이지 않습니다.`);
  assert.equal(evaluation.subjectVisible, true, `${input.title}: 행위 주체가 첫 화면에 없습니다.`);
  assert.equal(evaluation.mainVisible, true, `${input.title}: 사건 대상이 첫 화면에 없습니다.`);
  assert.ok(evaluation.actionMarkerHits >= 1, `${input.title}: 실제 행동이 첫 화면에 없습니다.`);
  assert.equal(evaluation.consequenceVisible, true, `${input.title}: 실제 피해 결과가 첫 화면에 없습니다.`);
  assert.ok(evaluation.comedyAnchorHits >= 1, `${input.title}: 말장난이 사건 소재와 무관합니다.`);
  assert.ok(evaluation.contrastComedyHits >= 1, `${input.title}: 건조한 반전 문장이 없습니다.`);
  assert.ok(evaluation.shortPunchlineHits >= 2, `${input.title}: 짧은 웃음 타격점이 부족합니다.`);
  assert.ok(evaluation.echoSectionHits <= 2, `${input.title}: 접수 원문을 여러 영역에서 반복했습니다.`);
  assert.ok(evaluation.opposingClaimOverlap <= 0.7, `${input.title}: 원고·피고 주장이 같은 말을 반복합니다.`);
  assert.ok(evaluation.tailoredOrders >= 2, `${input.title}: 사건 맞춤형 주문이 부족합니다.`);
}

console.log('Verified clear case openings, mandatory case-specific comedy lines, distinct claims and shorter tailored judgments.');
