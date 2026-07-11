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
  title: '공원 간식 무단취식 사건',
  caseDescription: '공원에서 간식을 먹다가 한눈판 사이 산책 중인 반려견이 남은 간식을 먹었다.',
  desiredVerdict: '보호자가 같은 간식을 배상했으면 한다.',
  grievanceIndex: 7,
  defendantName: '반려견',
  judgeType: '드립형',
  category: 'food',
};

const fallback = buildCaseAnalysis(input);
const analysis = normalizeAiAnalysis({
  actor: '반려견',
  target: '간식',
  action: '반려견이 원고가 한눈판 사이 간식을 먹었다',
  consequence: '원고가 먹으려던 간식이 사라졌다',
  conflict: '산책 중 식욕이 타인의 간식보다 먼저 움직였다',
  keyFacts: ['공원', '한눈판 사이', '간식을 먹음'],
  evidenceAnchors: ['반려견', '간식', '한눈판'],
  humorAngles: ['한눈판 순간의 속도', '목줄과 식욕의 통제 차이'],
  defenseAngles: ['가까운 간식을 자신의 몫으로 오인했다는 반박'],
  remedy: '같은 간식 배상',
}, fallback);

const analysisPrompt = buildAnalysisPrompt(input);
const conceptPrompt = buildConceptPrompt(input, analysis);
const concepts = normalizeConcepts({ concepts: [
  { id: 'A', headline: '한눈판 사이 간식 사건', comedyLines: ['구체 장면 1', '구체 장면 2'] },
  { id: 'B', headline: '목줄과 식욕 사건', comedyLines: ['법정 관찰 1', '법정 관찰 2'] },
  { id: 'C', headline: '산책 중 간식 사건', comedyLines: ['건조 반전 1', '건조 반전 2'] },
] });
const editorPrompt = buildEditorPrompt(input, analysis, concepts);

assert.ok(analysisPrompt.includes('다른 사건에도 붙일 수 있는'));
assert.ok(conceptPrompt.includes('억지 합성어'));
assert.ok(conceptPrompt.includes('핵심 명사를 다른 명사로 바꾸면 성립하지 않아야'));
assert.ok(editorPrompt.includes('첫째와 둘째가 실제 화면에 공개'));
assert.ok(editorPrompt.includes('원고와 피고 주장은 각각 한 문장'));
assert.ok(editorPrompt.includes('repetitionControl'));
assert.equal(concepts.length, 3);

const judgment = normalizeJudgment({
  engineVersion: 3,
  headline: '반려견의 한눈판 간식 사건',
  incidentLevel: analysis.incidentLevel,
  opening: '반려견이 원고가 한눈판 사이 공원에서 간식을 먹어 원고의 몫이 사라졌다. 목줄은 잡혀 있었지만 간식까지 지켜주지는 못했다.',
  comedyLines: [
    '원고가 고개를 돌린 시간은 짧았고 반려견의 판단은 더 짧았다.',
    '산책 동선에는 간식 소유권 확인 절차가 없었다.',
    '피고는 냄새를 확인했고 원고는 빈손을 확인했다.',
  ],
  summary: '원고는 먹으려던 간식을 잃었다. 보호자는 접근을 막지 못한 책임이 있다.',
  facts: '원고는 공원에서 간식을 먹고 있었다. 한눈판 사이 반려견이 남은 간식을 먹었다. 원고의 간식은 남지 않았다.',
  investigation: '핵심 단서는 공원, 한눈판 사이, 반려견의 접근이다. 원문에 없는 고의나 대화는 판단에 넣지 않았다.',
  plaintiffClaim: '원고는 자신의 간식을 잃었으므로 같은 간식 배상을 요구한다.',
  defendantClaim: '피고 측은 가까운 간식을 자신의 몫으로 오인했다고 항변한다.',
  opinion: '반려견의 본능은 이해할 수 있다. 다만 타인의 음식에 접근하지 않도록 관리할 책임은 보호자에게 있다. 같은 간식 배상과 재발방지가 필요하다.',
  orders: [
    { number: 1, text: '보호자는 간식 무단취식에 관해 원고에게 사과하라.' },
    { number: 2, text: '보호자는 원고가 잃은 것과 같은 간식을 배상하라.' },
    { number: 3, text: '다음 산책부터 반려견이 타인의 간식에 접근하지 않도록 거리를 확보하라.' },
  ],
  closingComment: '다음 산책에는 목줄과 간식 모두 지켜야 한다.',
  legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠입니다.',
});

const quality = evaluateJudgment(judgment, analysis);
assert.equal(isCompleteJudgment(judgment), true);
assert.equal(quality.passed, true, JSON.stringify(quality));
assert.equal(isCompleteJudgment(normalizeJudgment({ ...judgment, engineVersion: 2 })), false);

const parsed = parseEditorPackage(JSON.stringify({
  judgment,
  review: { clarity: 9, specificity: 9, humor: 8, defenseDistinctness: 8, repetitionControl: 8, fabricationRisk: 1 },
}), judgment);
assert.equal(editorReviewPassed(parsed.review), true);

console.log('Verified scene-specific humor, judge-style editing, concise claims and engine migration.');
