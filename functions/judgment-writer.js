const { cleanText, cleanParagraph } = require('./case-analysis');
const { normalizeJudgment } = require('./judgment-contract');

function buildFallbackJudgment(caseData, analysis) {
  const actor = analysis.actor;
  const target = analysis.target;
  const source = cleanText(caseData.caseDescription, 190);
  const evidence = (analysis.evidenceAnchors || []).filter(Boolean).slice(0, 4).join(', ') || `${actor}, ${target}`;
  const wordplay = analysis.wordplaySeed || `${target}은(는) 사건의 중심에 있었고, 설명은 그보다 늦게 도착했다.`;
  const dry = analysis.drySeed || `${actor}의 행동은 끝났지만 원고의 불편은 남았다.`;

  return normalizeJudgment({
    engineVersion: 3,
    headline: `${actor}의 ${target} 예상 밖 처리 사건`,
    incidentLevel: analysis.incidentLevel,
    opening: `${analysis.action}. 그 결과 ${analysis.consequence}.`,
    comedyLines: [
      wordplay,
      dry,
      `${actor}은(는) ${target} 앞에서 설명보다 행동이 먼저 나갔다.`,
    ],
    summary: `${actor}의 행동은 원문에 적힌 결과를 실제로 만들었다. 고의 여부와 별개로 사건 뒤 설명과 회복 책임은 남는다.`,
    facts: `접수 원문은 “${source}”라고 기록한다. 이를 정리하면 ${analysis.action}. 확인되는 결과는 ${analysis.consequence}.`,
    investigation: `핵심 단서는 ${evidence}이다. 재판부는 원문에 없는 대화나 동기를 보태지 않고, 행동과 결과 사이의 연결만 확인했다.`,
    plaintiffClaim: `원고는 ${target}과(와) 관련해 ${analysis.consequence}는 피해를 입었다고 주장한다. 원하는 해결은 ${cleanParagraph(caseData.desiredVerdict, 180) || '분명한 사과와 원상회복'}이다.`,
    defendantClaim: `피고 측은 ${analysis.defenseAngle || '계획적인 방해가 아니라 순간적인 착오였다'}고 반박한다. 다만 결과가 생긴 뒤의 설명과 회복까지 면제되는 것은 아니라는 점은 남는다.`,
    opinion: `재판부는 ${analysis.action}는 사실과 ${analysis.consequence}는 결과를 분리해 판단한다. 피고의 악의를 과장할 근거는 없지만, 원고가 실제로 잃은 몫·시간·편의는 무시할 수 없다. 따라서 처분은 과장된 벌보다 구체적인 사과, 회복, 같은 상황을 막는 행동에 집중한다.`,
    orders: [
      { number: 1, text: `${actor} 측은 ${target} 사건에서 한 행동과 생긴 결과를 빼놓지 말고 원고에게 사과하라.` },
      { number: 2, text: `${actor} 측은 ${analysis.remedy || `${target}과(와) 관련된 실제 손해를 회복하는 조치`}를 이행하라.` },
      { number: 3, text: `${actor} 측은 다음에 ${target}을(를) 건드리거나 결정하기 전에 원고의 의사를 먼저 확인하라.` },
    ],
    closingComment: dry,
    legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠입니다.',
  });
}

function rewriteInstruction(analysis, evaluation) {
  if (!evaluation) return '';
  return `\n[재작성 명령]\n이전 응답은 사건 명확성 또는 웃음 품질 검사에서 탈락했다.\n첫 두 문장에 행위자 “${analysis.actor}”, 대상 “${analysis.target}”, 실제 행동과 결과를 모두 구체적으로 적어라.\ncomedyLines 중 하나는 사건 명사를 직접 이용한 말장난, 하나는 70자 이하의 건조한 반전으로 작성하라.\n검사값: ${JSON.stringify(evaluation)}\n`;
}

function buildJudgmentPrompt(caseData, analysis, evaluation = null) {
  return `너는 소소킹 황당재판소의 수석 코미디 판사다.
목표는 첫 두 문장만 읽어도 무슨 사건인지 알 수 있고 사건 소재 자체로 최소 두 번 웃기게 만드는 것이다.

사건명: ${cleanText(caseData.title, 90)}
원문: ${cleanParagraph(caseData.caseDescription, 1500)}
행위자: ${analysis.actor}
핵심 대상: ${analysis.target}
결정적 행동: ${analysis.action}
실제 결과: ${analysis.consequence}
판사 성향: ${cleanText(caseData.judgeType, 20)}
원하는 해결: ${cleanParagraph(caseData.desiredVerdict, 240) || '별도 요청 없음'}
${rewriteInstruction(analysis, evaluation)}
JSON 외에는 출력하지 않는다.`;
}

module.exports = { buildFallbackJudgment, buildJudgmentPrompt };
