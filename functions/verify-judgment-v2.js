const assert = require('node:assert/strict');
const {
  JUDGMENT_SCHEMA_VERSION,
  cleanParagraph,
  extractJson,
  normalizeJudgment,
  isCompleteJudgment,
  ordersAsText,
} = require('./judgment-v2');

const sample = {
  headline: '마지막 만두 배분질서 침해 사건',
  incidentLevel: '소소위기 2단계 · 관계기관 긴급 소집',
  breakingNews: '긴급속보. 마지막 만두가 예고 없이 사라지면서 식탁 질서가 흔들렸다.',
  emergencyBriefing: '사건 발생 전 식탁은 평온했다. 결정적 순간 피고의 젓가락이 진입했고 마지막 만두는 현장에서 사라졌다. 감식반은 즉시 이동 경로를 복원했다.',
  impactAssessment: '이 사태를 방치할 경우 다음 반찬과 디저트까지 소유권 분쟁이 확산될 수 있다. 그러나 모든 보고서의 중심에는 만두 한 개가 있다.',
  summary: '재판부는 마지막 만두가 공동체 평화를 시험하는 중대한 생활 증거라고 판단하였다.',
  facts: '원고와 피고는 식탁 위에 마지막으로 남은 만두 한 개를 동시에 발견하였다. 원고는 먼저 눈으로 점유했다고 주장하였고 피고는 젓가락이 먼저 도달했다고 항변하였다. 사건은 만두 한 개보다 훨씬 큰 정적을 남겼다.',
  investigation: '수사팀은 젓가락의 이동 거리와 시선의 선점 시점을 분석하였다. 현장 분위기를 0.1초 단위로 복원한 결과 양측 모두 마지막 만두에 상당한 기대를 가지고 있었음이 확인되었다.',
  plaintiffClaim: '원고 측은 마지막 만두를 먹으려 젓가락을 드는 순간 피고가 선점했고, 이후 단무지만 제시해 기대와 사과의 기회를 동시에 빼앗았다고 주장한다.',
  defendantClaim: '피고 측은 마지막 만두에 이름표가 없었고 젓가락이 먼저 도달했을 뿐이며, 계획적인 식탁 질서 전복은 아니었다고 반박한다.',
  prosecution: '검사는 피고가 원고의 시각적 선점 상태를 알면서도 젓가락을 진입시켰다고 주장하였다.',
  defense: '변호인은 만두에 이름표가 없었고 식탁은 공동 이용 구역이었다고 항변하였다.',
  opinion: '재판부는 시선만으로 완전한 소유권이 생기지는 않지만 마지막 하나를 발견한 사람들 사이에는 최소한의 협의 의무가 발생한다고 판단한다. 피고가 이를 생략한 점은 생활형 책임의 근거가 된다.',
  orders: [
    { number: 1, text: '피고는 다음 만두 주문 시 원고에게 첫 선택권을 부여하라.' },
    { number: 2, text: '양측은 마지막 하나를 발견하면 즉시 반으로 나누는 협의를 시작하라.' },
    { number: 3, text: '소송 비용은 간장과 단무지의 평화로운 제공으로 갈음한다.' },
  ],
  closingComment: '마지막 하나는 음식이 아니라 인격을 시험한다.',
  legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠입니다.',
};

assert.equal(JUDGMENT_SCHEMA_VERSION, 2);
assert.equal(cleanParagraph('첫 줄\n둘째 줄'), '첫 줄\n둘째 줄');
assert.deepEqual(extractJson(`\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``), sample);

const normalized = normalizeJudgment(sample);
assert.ok(isCompleteJudgment(normalized));
assert.equal(normalized.incidentLevel, sample.incidentLevel);
assert.equal(normalized.breakingNews, sample.breakingNews);
assert.equal(normalized.emergencyBriefing, sample.emergencyBriefing);
assert.equal(normalized.impactAssessment, sample.impactAssessment);
assert.equal(normalized.plaintiffClaim, sample.plaintiffClaim);
assert.equal(normalized.defendantClaim, sample.defendantClaim);
assert.equal(normalized.orders.length, 3);
assert.match(ordersAsText(normalized.orders), /^1\./);
assert.match(ordersAsText(normalized.orders), /\n2\./);
assert.match(ordersAsText(normalized.orders), /\n3\./);

const fallback = normalizeJudgment({ summary: '' }, sample);
assert.equal(fallback.summary, sample.summary);
assert.equal(fallback.breakingNews, sample.breakingNews);
assert.equal(fallback.plaintiffClaim, sample.plaintiffClaim);
assert.ok(isCompleteJudgment(fallback));

const legacyWithoutClaims = { ...sample };
delete legacyWithoutClaims.plaintiffClaim;
delete legacyWithoutClaims.defendantClaim;
assert.ok(isCompleteJudgment(normalizeJudgment(legacyWithoutClaims)), 'Old V2 judgments must stay valid without quick claims.');

const incomplete = normalizeJudgment({ headline: '짧음' });
assert.equal(isCompleteJudgment(incomplete), false);

console.log('Verified canonical judgment V2 contract, emergency fields and optional opposing claims.');
