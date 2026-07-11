const { cleanText, cleanParagraph } = require('./case-analysis');
const { normalizeJudgment } = require('./judgment-contract');

function buildFallbackJudgment(caseData, analysis) {
  const actor = analysis.actor;
  const target = analysis.target;
  return normalizeJudgment({
    headline: `${actor}의 ${target} 관련 생활질서 이탈 사건`,
    incidentLevel: analysis.incidentLevel,
    opening: `[긴급속보] ${analysis.action}. 그 결과 원고는 ${analysis.consequence} 소소킹 재판부는 사건의 크기보다 확인 한 번으로 막을 수 있었는지를 핵심 쟁점으로 지정했다. ${analysis.drySeed}`,
    comedyLines: [analysis.wordplaySeed, analysis.drySeed],
    summary: `${actor}의 행동으로 ${target}과(와) 관련된 계획이 어긋났고 원고에게 실제 불편이 생겼다. 재판부는 고의성보다 행동 전 확인 가능성과 사건 후 회복 책임을 기준으로 피고 측 책임을 인정한다.`,
    facts: `기록상 ${analysis.action}. 원고는 이 행동을 예상하거나 동의하지 않았고 그 결과 ${analysis.consequence}\n\n이 사건의 쟁점은 결과가 사소해 보이는지가 아니라, 피고가 행동 전에 상대의 몫·목적·시간을 확인할 수 있었는지다.`,
    investigation: `감식 결과 ${(analysis.evidenceAnchors || []).join(', ')}이(가) 핵심 단서로 확인됐다. 행동은 짧았지만 결과는 분명했고, 사건 뒤 설명이나 원상회복이 즉시 이뤄졌다는 자료도 충분하지 않았다. ${analysis.drySeed}`,
    plaintiffClaim: `원고는 ${target} 자체만이 아니라 그 일로 ${analysis.consequence}는 점이 실제 피해라고 주장한다. 한 번의 확인이면 피할 수 있었으므로 사과와 구체적인 회복조치가 필요하다는 입장이다.`,
    defendantClaim: `피고 측은 계획적인 방해가 아니며 ${analysis.defenseAngle}을(를) 정상참작해야 한다고 반박한다. 결과는 인정하지만 모든 책임을 악의로 해석해서는 안 된다는 주장이다.`,
    opinion: `재판부는 원고가 입은 실제 결과와 피고가 행동 전에 확인할 수 있었는지를 기준으로 판단한다. 악의가 크지 않더라도 확인할 기회가 있었고 그 기회를 사용하지 않았다면 생활상 책임은 남는다.\n\n따라서 피고 측 책임을 인정하되 처분은 응징보다 원상회복과 재발방지에 집중한다. ${analysis.wordplaySeed}`,
    orders: [
      { number: 1, text: `${actor}은(는) ${target} 사건에서 자신이 한 행동과 실제 결과를 정확히 적은 3문장 사과를 원고에게 전달하라.` },
      { number: 2, text: `${actor}은(는) ${analysis.remedy}을 이행해 원고의 실제 손해를 회복하라.` },
      { number: 3, text: `${actor}은(는) 같은 상황이 반복되지 않도록 “확인 먼저, 행동 나중” 절차를 지키고 ${target} 관련 결정권을 원고에게 한 차례 우선 부여하라.` },
    ],
    closingComment: analysis.drySeed,
    legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠이며 법률 상담이나 분쟁 해결을 대신하지 않습니다.',
  });
}

function rewriteInstruction(analysis, evaluation) {
  if (!evaluation) return '';
  return `\n[재작성 명령]\n이전 응답은 사건 명확성 또는 웃음 품질 검사에서 탈락했다.\n첫 두 문장에 행위자 “${analysis.actor}”, 대상 “${analysis.target}”, 실제 행동과 결과를 모두 구체적으로 적어라.\ncomedyLines 중 하나는 사건 명사를 직접 이용한 말장난, 하나는 70자 이하의 건조한 반전으로 작성하라.\n검사값: ${JSON.stringify(evaluation)}\n`;
}

function buildJudgmentPrompt(caseData, analysis, evaluation = null) {
  return `너는 소소킹 황당재판소의 수석 코미디 판사다.
목표는 긴 글을 쓰는 것이 아니라 첫 두 문장만 읽어도 무슨 사건인지 알 수 있고 사건 소재 자체로 최소 두 번 웃기게 만드는 것이다.

[접수 사건]
사건명: ${cleanText(caseData.title, 90)}
원문: ${cleanParagraph(caseData.caseDescription, 1500)}
피고: ${analysis.actor}
분류: ${analysis.category}
판사 성향: ${cleanText(caseData.judgeType, 20)}
억울함: ${Number(caseData.grievanceIndex || 5)}/10
원하는 해결: ${cleanParagraph(caseData.desiredVerdict, 240) || '별도 요청 없음'}

[사건 분석]
행위자: ${analysis.actor}
핵심 대상: ${analysis.target}
결정적 행동: ${analysis.action}
실제 결과: ${analysis.consequence}
피고 유형: ${analysis.defendantType}
코미디 프레임: ${analysis.comedyFrame}
말장난 방향: ${analysis.wordplaySeed}
건조한 반전 방향: ${analysis.drySeed}
피고 변명 방향: ${analysis.defenseAngle}
회복 방향: ${analysis.remedy}
${rewriteInstruction(analysis, evaluation)}
작성 규칙:
1. opening 첫 문장에 누가 무엇을 어떻게 해서 어떤 결과가 생겼는지 적는다.
2. 추상적인 질서·체계 설명으로 시작하지 않는다.
3. comedyLines는 2~3개다. 첫 줄은 사건 명사를 비튼 말장난, 둘째 줄은 짧고 건조한 반전이다.
4. 제시된 예시는 방향만 참고하고 그대로 복사하지 않는다.
5. 원고와 피고 주장은 같은 요약을 말투만 바꿔 반복하지 않는다.
6. 피고 주장은 황당하지만 독립적인 논리 하나를 세운다.
7. 주문은 정확히 3개이며 사과, 실제 회복, 재발방지 순서로 작성한다.
8. 주문에는 실제 사건 대상이나 행동을 활용한다.
9. 원문에 없는 사람·수량·대화를 사실처럼 만들지 않는다.
10. 같은 사실을 여러 항목에서 장황하게 반복하지 않는다.
11. JSON 외의 설명이나 마크다운은 출력하지 않는다.

{
  "headline": "행위자와 대상을 포함한 짧고 웃긴 사건명",
  "incidentLevel": "${analysis.incidentLevel}",
  "opening": "첫 문장에 사건 전체가 보이고 둘째 문장에 짧은 반전이 있는 속보",
  "comedyLines": ["사건 소재 말장난", "짧고 건조한 반전"],
  "summary": "사건과 책임 판단을 두 문장으로 압축",
  "facts": "행위자·대상·행동·결과를 한 번만 정리한 사실관계",
  "investigation": "현장 단서와 우스운 증거 해석",
  "plaintiffClaim": "원고가 실제 잃은 것과 억울함을 말하는 독립 주장",
  "defendantClaim": "피고의 황당하지만 논리적인 독립 반박",
  "opinion": "책임 판단과 이유, 처분 방향을 담은 두 문단",
  "orders": [
    {"number": 1, "text": "사건 맞춤형 사과 명령"},
    {"number": 2, "text": "실제 손해 회복 명령"},
    {"number": 3, "text": "웃기지만 실행 가능한 재발방지 명령"}
  ],
  "closingComment": "사건 소재를 다시 비트는 마지막 한마디",
  "legalNotice": "실제 법적 효력이 없는 오락 콘텐츠라는 안내"
}`;
}

module.exports = { buildFallbackJudgment, buildJudgmentPrompt };
