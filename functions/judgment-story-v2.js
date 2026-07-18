const writer = require('./judgment-story-writer');
const {
  evaluateStorySpecificity,
  buildRewriteInstruction,
} = require('./judgment-story-quality');

function isSparseProfile(profile = {}) {
  const description = String(profile.description || '').trim();
  const facts = Array.isArray(profile.facts) ? profile.facts : [];
  const anchors = Array.isArray(profile.anchors) ? profile.anchors : [];
  return description.length <= 45 || facts.length <= 1 || anchors.length <= 2;
}

function shortInputGuidance(profile) {
  if (!isSparseProfile(profile)) return '';
  return `

[짧은 접수 확장 규칙]
이번 접수는 정보가 짧다. 짧다는 이유로 판결을 축약하거나 일반적인 문장으로 채우지 마라.
- 입력에 없는 인물, 장소, 수량, 대화를 확정 사실로 만들지 마라.
- 부족한 정보는 확인되지 않음, 기록상 특정되지 않음, 가능성을 배제할 수 없음으로 표시하고 수사 쟁점과 대체 가설로 확장하라.
- 하나의 행동을 행동 전 확인 가능성, 결정적 순간, 사건 직후 대응, 원고의 기대 손상, 반복될 위험의 다섯 관점으로 분해하라.
- 긴급속보, 상황실, 감식반, 검사, 변호인, 재판부가 처음부터 끝까지 실제 중대사건처럼 대응하게 하라.
- 최소 세 번의 웃음 지점은 비상대책의 거대한 규모, 지나치게 정밀한 증거 분석, 장엄한 명령과 사소한 집행 대상의 대비로 만들어라.
- 모든 영역은 이 사건의 핵심 대상과 행동을 활용한 새 문장으로 작성하고, 다른 사건에도 그대로 붙일 수 있는 상투 문구를 반복하지 마라.`;
}

function buildStoryPrompt(profile) {
  return `${writer.buildStoryPrompt(profile)}${shortInputGuidance(profile)}`;
}

module.exports = {
  buildCaseProfile: writer.buildCaseProfile,
  buildStoryPrompt,
  buildStoryFallback: writer.buildStoryFallback,
  isSparseProfile,
  evaluateStorySpecificity,
  buildRewriteInstruction,
};