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
8. humorAngles는 완성된 농담이 아니라 이 사건에서만 가능한 웃음의 관찰 지점 3~5개다.
9. defenseAngles는 피고가 할 법한 서로 다른 반박 논리 2~3개다. 악의적 거짓말보다 황당하지만 말은 되는 논리로 쓴다.
10. JSON 외에는 출력하지 않는다.

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
  return `너는 소소킹 황당재판소의 코미디 기획자다.
같은 사건을 억지 말장난 하나로 끝내지 말고, 서로 완전히 다른 코미디 방향 3개를 제안하라.

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

세 방향은 반드시 다르게 만든다.
- A: 사건 물건·행동의 언어적 모순을 이용한 정확한 드립
- B: 실제 법정처럼 진지하게 과몰입하되 원문 사실에서 벗어나지 않는 방식
- C: 짧고 건조한 관찰과 뒤집기로 웃기는 방식

금지:
- 생활질서, 대응체계, 사회적 신뢰, 관계기관, 국가적 재난, 정식 분쟁 같은 공통 문구
- “사건은 작았지만”, “한 번의 확인이면”, “확인 먼저 행동 나중” 같은 재사용 문장
- 제목의 명사만 바꾼 동일한 문장 3개
- 원문에 없는 대화·감정·수량·고의성 창작

각 concept는 완성 판결이 아니라 최종 작가가 선택할 수 있는 강한 재료여야 한다.
JSON 외에는 출력하지 않는다.

{
  "concepts": [
    {
      "id": "A",
      "angle": "이 방향의 핵심 관찰",
      "headline": "짧고 구체적인 사건 제목",
      "opening": "첫 문장에 사건 전체, 둘째 문장에 반전",
      "comedyLines": ["서로 다른 방식의 문장 1", "문장 2", "문장 3"],
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
  return `너는 소소킹 황당재판소의 최종 편집장이다.
아래 3개 기획 중 가장 사건에 정확하고 실제로 웃기는 재료를 고르되, 그대로 복사하지 말고 하나의 완성 판결로 다시 써라.

[원문]
제목: ${cleanText(caseData.title, 90)}
내용: ${cleanParagraph(caseData.caseDescription, 1500)}
원하는 해결: ${cleanParagraph(caseData.desiredVerdict, 240) || '없음'}
판사 성향: ${cleanText(caseData.judgeType, 20)}

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
1. 첫 문장만 읽어도 누가 무엇을 해서 어떤 결과가 났는지 알 수 있어야 한다.
2. comedyLines 3개는 각각 언어적 모순, 구체 장면 과몰입, 건조한 반전처럼 웃음 방식이 달라야 한다.
3. 웃음은 반드시 원문의 구체적 물건·시간·행동에서 나온다.
4. 피고 주장은 원고 주장 요약이 아니라 독립적인 방어 논리여야 한다.
5. 같은 사실을 opening, summary, facts, investigation, opinion에서 반복하지 않는다.
6. facts는 사실만, investigation은 단서 해석만, opinion은 책임 판단만 쓴다.
7. 주문은 실제로 실행 가능하면서 사건에 딱 맞아야 한다.
8. 원문에 없는 대화·수량·동기·감정을 만들지 않는다.
9. 모든 문장은 짧게 쓴다. 항목별 제한을 지킨다.
10. 아래 review 점수에서 specificity와 humor가 각각 8점 미만이면 스스로 다시 고쳐서 출력한다.
11. JSON 외에는 출력하지 않는다.

길이 제한:
- headline 36자 이하
- opening 정확히 2문장, 180자 이하
- comedyLines 각 55자 이하
- summary 2문장, 180자 이하
- facts 3문장 이하, 320자 이하
- investigation 2문장 이하, 260자 이하
- 원고·피고 주장 각각 2문장 이하, 220자 이하
- opinion 4문장 이하, 420자 이하
- closingComment 45자 이하

{
  "judgment": {
    "headline": "",
    "incidentLevel": "${analysis.incidentLevel}",
    "opening": "",
    "comedyLines": ["", "", ""],
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
    && Number(review.repetitionControl) >= 7
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
