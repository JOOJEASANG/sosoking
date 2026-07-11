const assert = require('node:assert/strict');
const { buildCaseAnalysis } = require('./case-analysis');
const { normalizeJudgment, evaluateJudgment, parseJudgmentJson, isCompleteJudgment } = require('./judgment-contract');
const { buildFallbackJudgment, buildJudgmentPrompt } = require('./judgment-writer');

const cases = [
  {
    title: '공원 빵 리트리버 무단취식 사건',
    caseDescription: '공원에서 빵을 먹고 있었는데 산책하던 리트리버 한마리가 내가 한눈판 사이 내 빵을 먹어버렸음',
    desiredVerdict: '보호자가 같은 빵을 물어줬으면 좋겠다.',
    grievanceIndex: 7,
    defendantName: '',
    judgeType: '드립형',
    category: 'food',
    expectedActor: '리트리버',
    expectedTarget: '빵',
    expectedKit: 'animal-food',
  },
  {
    title: '네비게이션 목적지 오안내 사건',
    caseDescription: '약속장소로 가기위해 차량 네비게이션 설정을 했는데 도착해보니 다른 장소를 알려줌 그래서 약속 펑크남.',
    desiredVerdict: '다음에는 정확한 장소를 확인해줬으면 한다.',
    grievanceIndex: 8,
    defendantName: '차량 네비게이션',
    judgeType: '드립형',
    category: 'late',
    expectedActor: '차량 네비게이션',
    expectedTarget: '네비게이션',
    expectedKit: 'navigation',
  },
  {
    title: '마지막 만두 선점 사건',
    caseDescription: '저녁 식탁에 만두가 한 개 남아 있었는데 남편이 내가 젓가락을 드는 순간 먼저 집어 먹었다. 먹고 나서 미안하다는 말도 없이 단무지만 권했다.',
    desiredVerdict: '다음 만두 주문 때 마지막 두 개는 내 몫으로 해줬으면 좋겠다.',
    grievanceIndex: 8,
    defendantName: '남편',
    judgeType: '과몰입형',
    category: 'food',
    expectedActor: '남편',
    expectedTarget: '만두',
    expectedKit: 'food',
  },
  {
    title: '리모컨 소파 틈 은닉 사건',
    caseDescription: '동생이 TV를 보다가 리모컨을 소파 틈에 넣어두고 방으로 들어갔다. 나는 20분 동안 거실과 주방을 찾았고 동생은 위치를 알면서도 웃고만 있었다.',
    desiredVerdict: '앞으로 리모컨을 제자리에 두게 해달라.',
    grievanceIndex: 7,
    defendantName: '동생',
    judgeType: '논리집착형',
    category: 'family',
    expectedActor: '동생',
    expectedTarget: '리모컨',
    expectedKit: 'hidden-object',
  },
];

for (const input of cases) {
  const analysis = buildCaseAnalysis(input);
  const fallback = buildFallbackJudgment(input, analysis);
  const evaluation = evaluateJudgment(fallback, analysis);
  const prompt = buildJudgmentPrompt(input, analysis);

  assert.equal(analysis.actor, input.expectedActor, `${input.title}: 행위자 추출 실패`);
  assert.equal(analysis.target, input.expectedTarget, `${input.title}: 핵심 대상 추출 실패`);
  assert.equal(analysis.comedyKitId, input.expectedKit, `${input.title}: 코미디 프레임 선택 실패`);
  assert.ok(analysis.action.includes(input.expectedActor), `${input.title}: 행동에 행위자가 없음`);
  assert.ok(analysis.action.includes(input.expectedTarget) || input.expectedKit === 'navigation', `${input.title}: 행동에 대상이 없음`);
  assert.ok(isCompleteJudgment(fallback), `${input.title}: 로컬 대체 판결 불완전`);
  assert.equal(evaluation.passed, true, `${input.title}: 품질검사 실패 ${JSON.stringify(evaluation)}`);
  assert.ok(evaluation.openingAnchorHits >= 2, `${input.title}: 첫 화면 사건 명확성 부족`);
  assert.ok(evaluation.comedyAnchorHits >= 1, `${input.title}: 사건 소재와 무관한 개그`);
  assert.ok(evaluation.contrastComedyHits >= 1, `${input.title}: 건조한 반전 없음`);
  assert.ok(evaluation.tailoredOrders >= 2, `${input.title}: 맞춤형 주문 부족`);
  assert.ok(evaluation.opposingClaimOverlap <= 0.78, `${input.title}: 원고·피고 주장 중복`);
  assert.ok(prompt.includes('opening 첫 문장'), `${input.title}: 사건 명확성 프롬프트 없음`);
  assert.ok(prompt.includes('comedyLines'), `${input.title}: 코미디 출력 계약 없음`);
  assert.ok(prompt.includes('주문은 정확히 3개'), `${input.title}: 주문 계약 없음`);
}

const sampleAnalysis = buildCaseAnalysis(cases[0]);
const sample = buildFallbackJudgment(cases[0], sampleAnalysis);
const withoutComedy = normalizeJudgment({ ...sample, comedyLines: [] });
assert.equal(evaluateJudgment(withoutComedy, sampleAnalysis).passed, false, '코미디가 없는 판결이 통과하면 안 됩니다.');

const parsed = parseJudgmentJson(`\n\`\`\`json\n${JSON.stringify({ judgment: sample })}\n\`\`\``);
assert.equal(parsed.headline, sample.headline, 'Gemini JSON 포장 해제 실패');

console.log('Verified Stage 2 case analysis, tailored comedy, quality rejection, fallback judgments and JSON contract.');
