const assert = require('node:assert/strict');
const { buildCaseAnalysis } = require('./case-analysis');
const { normalizeJudgment, evaluateJudgment, isCompleteJudgment } = require('./judgment-contract');
const {
  normalizeAiAnalysis,
  buildAnalysisPrompt,
  buildConceptPrompt,
  normalizeConcepts,
  buildEditorPrompt,
  parseEditorPackage,
  editorReviewPassed,
} = require('./judgment-ai-pipeline');

const input = {
  title: '공원 빵 리트리버 무단취식 사건',
  caseDescription: '공원에서 빵을 먹고 있었는데 산책하던 리트리버 한마리가 내가 한눈판 사이 내 빵을 먹어버렸음',
  desiredVerdict: '보호자가 같은 빵을 물어줬으면 좋겠다.',
  grievanceIndex: 7,
  defendantName: '',
  judgeType: '드립형',
  category: 'food',
};

const fallback = buildCaseAnalysis(input);
const analysis = normalizeAiAnalysis({
  actor: '리트리버',
  target: '빵',
  action: '리트리버가 원고가 한눈판 사이 공원에서 빵을 먹어버렸다',
  consequence: '원고가 먹으려던 빵이 사라졌다',
  conflict: '산책 중인 개의 식욕이 타인의 간식 소유권을 앞질렀다',
  defendantType: 'animal',
  keyFacts: ['공원에서 발생', '원고가 한눈판 사이', '리트리버가 빵을 먹음'],
  evidenceAnchors: ['리트리버', '빵', '한눈판'],
  forbiddenInventions: ['보호자의 실제 발언', '빵의 가격', '고의로 훈련했다는 동기'],
  humorAngles: ['공공장소와 개인 빵의 경계', '증거가 소화기관으로 이동', '목줄은 잡았지만 식욕은 놓침'],
  defenseAngles: ['냄새가 너무 가까워 간식으로 오인했다는 반박', '보호자보다 식욕이 먼저 반응했다는 반박'],
  remedy: '동일한 빵을 배상하고 보호자가 사과하는 조치',
}, fallback);

assert.equal(analysis.actor, '리트리버');
assert.equal(analysis.target, '빵');
assert.equal(analysis.analysisMode, 'gemini-grounded');
assert.equal(analysis.humorAngles.length, 3);
assert.ok(buildAnalysisPrompt(input).includes('forbiddenInventions'));
assert.ok(buildConceptPrompt(input, analysis).includes('서로 완전히 다른 코미디 방향 3개'));

const concepts = normalizeConcepts({
  concepts: [
    { id: 'A', angle: '공공장소와 개인 빵', headline: '공원 빵 소유권 사건', opening: '사건 설명', comedyLines: ['공공빵은 아니다', '증거는 소화 중', '목줄과 식욕'], defendantLogic: '오인', orderIdeas: ['사과', '빵 배상', '거리 확보'], whySpecific: '공원과 빵' },
    { id: 'B', angle: '증거물 이송', headline: '증거 소화 사건', opening: '사건 설명', comedyLines: ['증거물 이동', '감식 불가', '배 속 보관'], defendantLogic: '본능', orderIdeas: ['사과', '배상', '재발방지'], whySpecific: '리트리버' },
    { id: 'C', angle: '건조한 반전', headline: '산책과 간식 사건', opening: '사건 설명', comedyLines: ['산책 완료', '빵 종료', '원고 공복'], defendantLogic: '착오', orderIdeas: ['사과', '빵', '목줄'], whySpecific: '한눈판 사이' },
  ],
});
assert.equal(concepts.length, 3);
assert.ok(buildEditorPrompt(input, analysis, concepts).includes('specificity와 humor가 각각 8점 미만'));

const judgment = normalizeJudgment({
  engineVersion: 3,
  headline: '리트리버의 공원 빵 긴급회수 사건',
  incidentLevel: analysis.incidentLevel,
  opening: '리트리버가 원고가 한눈판 사이 공원 벤치의 빵을 먹어버려 원고의 간식이 사라졌다. 산책은 계속됐지만 증거는 피고의 소화기관으로 이동했다.',
  comedyLines: [
    '공원은 공공장소지만 원고의 빵까지 공공빵은 아니었다.',
    '리트리버는 산책을 마쳤고, 빵은 생을 마쳤다.',
    '목줄은 잡혀 있었지만 식욕은 현장에서 풀려 있었다.',
  ],
  summary: '원고는 먹으려던 빵을 잃었다. 피고의 본능은 이해되지만 보호 책임까지 사라지지는 않는다.',
  facts: '원고는 공원에서 빵을 먹고 있었다. 원고가 한눈판 사이 산책 중이던 리트리버가 빵을 먹었다. 빵은 원고에게 돌아오지 않았다.',
  investigation: '핵심 단서는 한눈판 사이와 이미 사라진 빵이다. 현장 회수는 불가능하지만 소유권까지 피고에게 이전된 것은 아니다.',
  plaintiffClaim: '원고는 자신의 간식을 허락 없이 잃었다. 보호자가 같은 빵을 배상하고 사과해야 한다고 주장한다.',
  defendantClaim: '피고 측은 빵 냄새가 산책 동선 안으로 들어와 간식으로 오인했다고 항변한다. 다만 그 오인을 관리할 책임은 보호자에게 남는다.',
  opinion: '리트리버의 식욕 자체를 처벌할 수는 없다. 그러나 타인의 빵과 산책 간식을 구분하도록 관리할 책임은 보호자에게 있다. 따라서 배상과 사과는 필요하되 피고에게 추가 간식을 지급하는 방식은 허용하지 않는다.',
  orders: [
    { number: 1, text: '보호자는 원고에게 리트리버의 빵 무단취식에 관해 짧고 분명하게 사과하라.' },
    { number: 2, text: '보호자는 원고가 잃은 것과 같은 빵 또는 원고가 고른 동급 간식을 배상하라.' },
    { number: 3, text: '다음 산책부터 리트리버가 타인의 음식에 접근하지 않도록 거리를 확보하라.' },
  ],
  closingComment: '빵은 돌아오지 않지만 다음 산책의 선은 그을 수 있다.',
  legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠입니다.',
});

const quality = evaluateJudgment(judgment, analysis);
assert.equal(isCompleteJudgment(judgment), true);
assert.equal(quality.passed, true, JSON.stringify(quality));
assert.equal(quality.engineVersion, 3);
assert.equal(quality.cannedPhraseHits, 0);
assert.equal(quality.comedyLineCount, 3);
assert.ok(quality.comedyMaxOverlap <= 0.6);
assert.ok(quality.sectionMaxOverlap <= 0.68);

const legacy = normalizeJudgment({ ...judgment, engineVersion: 2 });
assert.equal(isCompleteJudgment(legacy), false, '구형 판결은 새 엔진에서 다시 생성되어야 합니다.');

const stale = normalizeJudgment({ ...judgment, opening: '사건의 크기보다 한 번의 확인이면 막을 수 있었는지가 중요하다. 확인 먼저, 행동 나중이 필요하다.' });
assert.equal(evaluateJudgment(stale, analysis).passed, false, '상투문구 판결이 통과하면 안 됩니다.');

const parsed = parseEditorPackage(JSON.stringify({
  judgment,
  review: { clarity: 9, specificity: 9, humor: 8, defenseDistinctness: 8, repetitionControl: 8, fabricationRisk: 1, selectedConcept: 'C', reason: '구체적 장면을 사용함' },
}), judgment);
assert.equal(editorReviewPassed(parsed.review), true);

console.log('Verified grounded AI analysis, three distinct comedy concepts, editorial review, engine version migration and rejection of canned judgments.');
