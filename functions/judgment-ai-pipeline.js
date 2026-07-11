const { cleanText, cleanParagraph } = require('./case-analysis');
const { normalizeJudgment, parseJudgmentJson } = require('./judgment-contract');

function cleanList(value, maxItems = 6, maxLength = 180) {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  return value
    .map(item => cleanText(item, maxLength))
    .filter(item => {
      const key = item.toLowerCase();
      if (!item || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, maxItems);
}

function parseJsonObject(value) {
  const source = String(value || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('JSON object not found');
  return JSON.parse(source.slice(start, end + 1));
}

function judgeStyle(judgeType) {
  if (judgeType === '과몰입형') {
    return '실제 법정처럼 엄숙한 문장으로 사소한 장면을 과하게 진지하게 다루되 국가적 재난 같은 뻔한 과장은 쓰지 않는다.';
  }
  if (judgeType === '논리집착형') {
    return '시간, 순서, 거리, 선택 가능성처럼 원문에 있는 조건을 집요하게 따져 논리의 빈틈에서 웃음을 만든다. 원문에 없는 숫자는 만들지 않는다.';
  }
  return '짧고 자연스러운 관찰과 한 번의 정확한 비틀기로 웃긴다. 억지 운율, 단어 합성, 아재개그를 의무적으로 만들지 않는다.';
}

function normalizeAiAnalysis(raw = {}, fallback = {}) {
  const humorAngles = cleanList(raw.humorAngles, 5, 180);
  const defenseAngles = cleanList(raw.defenseAngles, 4, 180);
  const evidenceAnchors = cleanList(raw.evidenceAnchors, 8, 80);
  const keyFacts = cleanList(raw.keyFacts, 7, 220);
  const forbiddenInventions = cleanList(raw.forbiddenInventions, 7, 160);

  return {
    ...fallback,
    actor: cleanText(raw.actor, 50) || fallback.actor,
    target: cleanText(raw.target, 50) || fallback.target,
    action: cleanText(raw.action, 220) || fallback.action,
    consequence: cleanText(raw.consequence, 220) || fallback.consequence,
    conflict: cleanText(raw.conflict, 240) || `${fallback.action}. ${fallback.consequence}`,
    defendantType: cleanText(raw.defendantType, 30) || fallback.defendantType,
    keyFacts: keyFacts.length ? keyFacts : [fallback.action, fallback.consequence].filter(Boolean),
    evidenceAnchors: evidenceAnchors.length ? evidenceAnchors : fallback.evidenceAnchors,
    forbiddenInventions,
    humorAngles,
    defenseAngles,
    remedy: cleanText(raw.remedy, 240) || fallback.remedy,
    defenseAngle: defenseAngles[0] || fallback.defenseAngle,
    comedyFrame: humorAngles[0] || fallback.comedyFrame,
    wordplaySeed: '',
    drySeed: '',
    analysisMode: 'gemini-grounded',
  };
}

function buildAnalysisPrompt(caseData) {
  return `너는 코미디 작가가 아니라 먼저 사실을 정확히 정리하는 사건 분석관이다.
아래 원문에 명시된 사실만 사용해 사건의 중심을 구조화하라. 웃기려고 사실을 만들지 말고, 모호하면 모호하다고 표시하라.

[접수 내용]
제목: ${cleanText(caseData.title, 90)}
원문: ${cleanParagraph(caseData.caseDescription, 1500)}
사용자가 지정한 피고: ${cleanText(caseData.defendantName, 50) || '없음'}
사건 분류: ${cleanText(caseData.category, 20)}
원하는 해결: ${cleanParagraph(caseData.desiredVerdict, 240) || '없음'}

규칙:
1. actor는 실제 행동 주체다. 기계·동물도 가능하다.
2. target은 사건에서 가장 중요한 물건·행동·약속 중 하나다.
3. action은 누가 무엇을 어떻게 했는지 한 문장으로 쓴다.
4. consequence는 원고가 실제로 잃거나 겪은 결과만 쓴다.
5. keyFacts는 원문에서 확인되는 구체적 장면만 3~6개 적는다.
6. evidenceAnchors는 판결에 반드시 다시 등장해야 할 고유 명사·수량·행동을 적는다.
7. forbiddenInventions에는 원문에 없는 것으로 만들면 안 되는 대화·수량·인물·동기를 적는다.
8. humorAngles는 완성된 농담이 아니라 이 사건에서만 보이는 행동의 모순, 타이밍, 장면을 3~5개 적는다.
9. humorAngles에 다른 사건에도 붙일 수 있는 '질서가 무너짐', '평화가 사라짐', '보고서가 커짐' 같은 표현을 넣지 않는다.
10. defenseAngles는 피고가 할 법한 서로 다른 반박 논리 2~3개다. 황당하지만 말은 되는 논리로 쓴다.
11. JSON 외에는 출력하지 않는다.

{
  "actor": "행동 주체",
  "target": "핵심 대상",
  "action": "구체적 행동",
  "consequence": "구체적 결과",
  "conflict": "사건의 모순 또는 억울함 한 문장",
  "defendantType": "person|animal|device|organization|unknown",
  "keyFacts": ["구체적 사실"],
  "evidenceAnchors": ["반드시 판결에 등장할 단서"],
  "forbiddenInventions": ["만들면 안 되는 사실"],
  "humorAngles": ["이 사건 전용 관찰 지점"],
  "defenseAngles": ["피고 반박 논리"],
  "remedy": "사용자 요구와 사건 결과에 맞는 회복 방향"
}`;
}

function buildConceptPrompt(caseData, analysis) {
  const style = judgeStyle(cleanText(caseData.judgeType, 20));
  return `너는 소소킹 황당재판소의 코미디 기획자다.
같은 사건을 서로 다른 관찰 방식 3개로 해석하라. 말장난을 억지로 만들지 말고, 실제 장면을 정확히 짚었을 때 생기는 웃음을 우선한다.

[사건 원문]
${cleanParagraph(caseData.caseDescription, 1500)}

[확정된 사건 분석]
행위자: ${analysis.actor}
핵심 대상: ${analysis.target}
행동: ${analysis.action}
결과: ${analysis.consequence}
핵심 모순: ${analysis.conflict}
구체적 사실: ${JSON.stringify(analysis.keyFacts || [])}
필수 단서: ${JSON.stringify(analysis.evidenceAnchors || [])}
만들면 안 되는 사실: ${JSON.stringify(analysis.forbiddenInventions || [])}
관찰 가능한 웃음 지점: ${JSON.stringify(analysis.humorAngles || [])}
피고 반박 후보: ${JSON.stringify(analysis.defenseAngles || [])}
판사 성향: ${cleanText(caseData.judgeType, 20)}
판사 문체: ${style}

세 방향은 반드시 다르게 만든다.
- A: 원문 속 가장 구체적인 장면이나 타이밍을 그대로 확대해 웃기는 관찰형
- B: 선택 가능성과 책임을 실제 판결처럼 집요하게 따지는 법정 과몰입형
- C: 짧은 두 문장 사이의 예상 차이로 웃기는 건조한 반전형

금지:
- 생활질서, 대응체계, 사회적 신뢰, 관계기관, 국가적 재난, 정식 분쟁 같은 공통 문구
- '사건은 끝났지만', '성공했지만 실패했다', '증거는 이미 소화 중', '평화는 사라졌다'처럼 여러 사건에 반복 가능한 공식
- 핵심 명사 뒤에 아무 단어나 붙인 억지 합성어
- 제목의 명사만 바꾼 동일한 문장 3개
- 원문에 없는 대화·감정·수량·고의성 창작

좋은 문장 기준:
- 핵심 명사를 다른 명사로 바꾸면 성립하지 않아야 한다.
- 원문을 읽은 사람이 '바로 그 장면'이라고 느껴야 한다.
- 설명 없이 한 번에 이해되어야 한다.

JSON 외에는 출력하지 않는다.

{
  "concepts": [
    {
      "id": "A",
      "angle": "이 방향의 핵심 관찰",
      "headline": "짧고 구체적인 사건 제목",
      "opening": "첫 문장에 사건 전체, 둘째 문장에 반전",
      "comedyLines": ["가장 강한 문장", "다른 방식의 문장", "예비 문장"],
      "defendantLogic": "이 방향에 맞는 독립 반박",
      "orderIdeas": ["사과", "회복", "재발방지"],
      "whySpecific": "왜 이 사건에만 통하는지"
    }
  ]
}`;
}

function normalizeConcepts(raw = {}) {
  const concepts = Array.isArray(raw.concepts) ? raw.concepts : [];
  return concepts.slice(0, 3).map((item, index) => ({
    id: cleanText(item.id, 8) || String.fromCharCode(65 + index),
    angle: cleanText(item.angle, 220),
    headline: cleanText(item.headline, 100),
    opening: cleanParagraph(item.opening, 500),
    comedyLines: cleanList(item.comedyLines, 3, 180),
    defendantLogic: cleanParagraph(item.defendantLogic, 360),
    orderIdeas: cleanList(item.orderIdeas, 3, 240),
    whySpecific: cleanParagraph(item.whySpecific, 300),
  })).filter(item => item.headline && item.comedyLines.length >= 2);
}

function buildEditorPrompt(caseData, analysis, concepts, previous = null, evaluation = null) {
  const style = judgeStyle(cleanText(caseData.judgeType, 20));
  return `너는 소소킹 황당재판소의 최종 편집장이다.
아래 기획 중 가장 사건에 정확한 재료를 골라 하나의 짧은 판결로 다시 써라. 웃기려고 애쓴 흔적보다 정확한 관찰을 우선한다.

[원문]
제목: ${cleanText(caseData.title, 90)}
내용: ${cleanParagraph(caseData.caseDescription, 1500)}
원하는 해결: ${cleanParagraph(caseData.desiredVerdict, 240) || '없음'}
판사 성향: ${cleanText(caseData.judgeType, 20)}
판사 문체: ${style}

[확정 사실]
${JSON.stringify({
    actor: analysis.actor,
    target: analysis.target,
    action: analysis.action,
    consequence: analysis.consequence,
    conflict: analysis.conflict,
    keyFacts: analysis.keyFacts,
    evidenceAnchors: analysis.evidenceAnchors,
    forbiddenInventions: analysis.forbiddenInventions,
    defenseAngles: analysis.defenseAngles,
    remedy: analysis.remedy,
  })}

[코미디 기획 3안]
${JSON.stringify(concepts)}

${previous ? `[이전 판결]\n${JSON.stringify(previous)}\n` : ''}
${evaluation ? `[기계 검사 탈락 사유]\n${JSON.stringify(evaluation)}\n` : ''}

최종 작성 원칙:
1. opening 첫 문장은 행동과 결과를 함께 보여주고, 둘째 문장은 가장 정확한 반전 하나만 둔다.
2. comedyLines는 3개 후보를 쓰되 첫째와 둘째가 실제 화면에 공개되는 가장 강한 문장이다.
3. 첫째와 둘째는 웃음 방식이 달라야 하며, 둘 다 원문의 고유 장면을 직접 사용한다.
4. 억지 말장난보다 구체적인 타이밍, 행동의 모순, 피고의 황당한 논리를 우선한다.
5. headline에 '관련', '처리', '이탈', '예상 밖' 같은 행정 문구를 쓰지 않는다.
6. 원고와 피고 주장은 각각 한 문장으로 쓴다. 피고는 독립적인 방어 논리를 제시한다.
7. facts는 사실만, investigation은 단서의 의미만, opinion은 책임과 이유만 쓴다.
8. 같은 문장을 다른 항목에서 표현만 바꿔 반복하지 않는다.
9. 주문은 실제로 실행 가능하고 사건 대상이 직접 들어가야 한다.
10. 원문에 없는 대화·수량·동기·감정을 만들지 않는다.
11. '사건은 끝났지만', '성공했지만 실패했다', '증거는 소화 중', '평화가 사라졌다' 같은 공식 문장을 쓰지 않는다.
12. review에서 specificity, humor, repetitionControl 중 하나라도 8점 미만이면 스스로 다시 고쳐서 출력한다.
13. JSON 외에는 출력하지 않는다.

길이 제한:
- headline 32자 이하
- opening 정확히 2문장, 150자 이하
- comedyLines 각 48자 이하
- summary 2문장, 150자 이하
- facts 3문장 이하, 260자 이하
- investigation 2문장 이하, 210자 이하
- 원고·피고 주장 각각 1문장, 150자 이하
- opinion 3문장 이하, 300자 이하
- closingComment 38자 이하

{
  "judgment": {
    "engineVersion": 3,
    "headline": "",
    "incidentLevel": "${analysis.incidentLevel}",
    "opening": "",
    "comedyLines": ["화면 공개 1순위", "화면 공개 2순위", "예비 문장"],
    "summary": "",
    "facts": "",
    "investigation": "",
    "plaintiffClaim": "",
    "defendantClaim": "",
    "opinion": "",
    "orders": [
      {"number": 1, "text": "사건 맞춤형 사과"},
      {"number": 2, "text": "실제 회복"},
      {"number": 3, "text": "구체적 재발방지"}
    ],
    "closingComment": "",
    "legalNotice": "본 판결은 실제 법적 효력이 없는 오락 콘텐츠입니다."
  },
  "review": {
    "clarity": 1,
    "specificity": 1,
    "humor": 1,
    "defenseDistinctness": 1,
    "repetitionControl": 1,
    "fabricationRisk": 1,
    "selectedConcept": "A|B|C",
    "reason": "선택 및 수정 이유"
  }
}`;
}

function parseEditorPackage(value, fallbackJudgment = {}) {
  const parsed = parseJsonObject(value);
  const rawJudgment = parsed.judgment || parseJudgmentJson(value);
  const review = parsed.review || {};
  return {
    judgment: normalizeJudgment(rawJudgment, fallbackJudgment),
    review: {
      clarity: Number(review.clarity || 0),
      specificity: Number(review.specificity || 0),
      humor: Number(review.humor || 0),
      defenseDistinctness: Number(review.defenseDistinctness || 0),
      repetitionControl: Number(review.repetitionControl || 0),
      fabricationRisk: Number(review.fabricationRisk || 0),
      selectedConcept: cleanText(review.selectedConcept, 8),
      reason: cleanParagraph(review.reason, 500),
    },
  };
}

function editorReviewPassed(review = {}) {
  return Number(review.clarity) >= 8
    && Number(review.specificity) >= 8
    && Number(review.humor) >= 8
    && Number(review.defenseDistinctness) >= 7
    && Number(review.repetitionControl) >= 8
    && Number(review.fabricationRisk) <= 3;
}

module.exports = {
  parseJsonObject,
  normalizeAiAnalysis,
  buildAnalysisPrompt,
  buildConceptPrompt,
  normalizeConcepts,
  buildEditorPrompt,
  parseEditorPackage,
  editorReviewPassed,
};
