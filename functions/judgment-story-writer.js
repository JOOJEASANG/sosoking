const { cleanText, cleanParagraph, normalizeJudgment } = require('./judgment-v2');
const {
  MAIN_ANCHOR_SKIP,
  CATEGORY_LABELS,
  JUDGE_DIRECTIONS,
  CATEGORY_DOCTRINES,
  splitFacts,
  extractAnchors,
  isConcreteSecondaryAnchor,
  resolveStoryCategory,
  incidentLevel,
} = require('./judgment-story-config');

function buildCaseProfile({ title, description, desiredVerdict, grievanceIndex, headline, defendantName, judgeType, category }) {
  const safeTitle = cleanText(title, 90) || '소소한 황당사건';
  const safeDescription = cleanParagraph(description, 1800) || safeTitle;
  const facts = splitFacts(safeDescription);
  const anchors = extractAnchors(safeTitle, safeDescription);
  const requestedCategoryId = category?.id || 'other';
  const categoryId = resolveStoryCategory(requestedCategoryId, anchors, safeDescription);
  const mainAnchor = anchors.find(anchor => !MAIN_ANCHOR_SKIP.has(anchor)) || anchors[0] || safeTitle;
  return {
    title: safeTitle,
    description: safeDescription,
    desiredVerdict: cleanText(desiredVerdict, 240),
    grievanceIndex: Math.max(1, Math.min(10, Number(grievanceIndex || 5))),
    headline: cleanText(headline, 180) || safeTitle,
    defendantName: cleanText(defendantName, 40) || '피고 측',
    judgeType: cleanText(judgeType, 40) || 'AI',
    judgeDirection: JUDGE_DIRECTIONS[judgeType] || JUDGE_DIRECTIONS['드립형'],
    categoryId,
    categoryLabel: CATEGORY_LABELS[categoryId],
    doctrine: CATEGORY_DOCTRINES[categoryId],
    facts,
    anchors: anchors.length ? anchors : [safeTitle],
    mainAnchor,
    incidentLevel: incidentLevel(grievanceIndex, categoryId),
  };
}

function factList(profile) {
  return profile.facts.map((fact, index) => `${index + 1}. ${fact}`).join('\n');
}

function interpretationCues(profile) {
  return profile.anchors
    .filter(anchor => anchor.toLowerCase() !== profile.mainAnchor.toLowerCase())
    .filter(isConcreteSecondaryAnchor)
    .slice(0, 4);
}

function buildStoryPrompt(profile) {
  const anchors = profile.anchors.join(', ');
  const cues = interpretationCues(profile).join(', ') || '추가 단서 없음';
  return `너는 소소킹 황당재판소의 AI 재판부이자 사건 각색 책임자다.
목표는 사용자가 쓴 문장을 길게 되풀이하는 것이 아니라, 사건의 핵심 갈등을 파악한 뒤 전혀 새로운 법정극으로 재해석해 읽는 재미를 만드는 것이다.

[사건 기록]
사건명: ${profile.title}
공식 사건명 초안: ${profile.headline}
피고 호칭: ${profile.defendantName}
판사 성향: ${profile.judgeType}
판사 연출 지시: ${profile.judgeDirection}
분류: ${profile.categoryLabel}
적용할 가상 원칙: ${profile.doctrine.doctrine}
사건 경계 단계: ${profile.incidentLevel}
억울함 지수: ${profile.grievanceIndex}/10
원고 희망 처분: ${profile.desiredVerdict || '별도 희망 없음'}
대표 대상: ${profile.mainAnchor}
보조 단서: ${cues}
예상 연쇄 위험: ${profile.doctrine.risk}
현장 대응 방식: ${profile.doctrine.response}
마지막 현실 반전: ${profile.doctrine.undercut}

[원문 사실 자료]
${factList(profile)}

[사건 핵심 단어]
${anchors}

먼저 내부적으로만 다음 세 가지를 파악하라. 이 분석 과정은 출력하지 않는다.
- 무엇을 했는가: 사건을 일으킨 결정적 행동
- 왜 억울한가: 사용자가 실제로 잃은 기대, 시간, 기분 또는 편의
- 어디가 웃긴가: 사건 규모와 재판의 과장 사이에서 생기는 대비

작성 원칙:
1. 원문은 사실 확인용 자료다. 원문의 문장 구조와 표현을 그대로 옮기지 말고 핵심만 새 문장으로 바꿔라.
2. 피할 수 없는 고유명사와 대표 대상 외에는 원문에서 4개 단어 이상 연속된 표현을 복사하지 마라.
3. 같은 사실을 summary, facts, investigation, prosecution, defense, opinion에서 반복 설명하지 마라. 각 영역은 새로운 정보와 관점을 담당해야 한다.
4. 대표 대상 “${profile.mainAnchor}”를 모든 문단에 억지로 넣지 마라. 전체 판결에서 3~8회 정도만 자연스럽게 사용한다.
5. facts는 사건 핵심을 한 번만 압축해 설명하고, 접수 원문을 다시 읽어주는 문단으로 만들지 마라.
6. breakingNews는 원문 요약이 아니라 사건을 한 단계 큰 사회 현상으로 바꾸는 신선한 프레임을 제시한다.
7. emergencyBriefing은 원문 순서 복기가 아니라 사건의 원인, 결정적 전환점, 수습 실패를 상황실 시각으로 재구성한다.
8. impactAssessment는 실제 사실을 반복하지 말고 이 논리가 계속될 경우 벌어질 황당한 연쇄 상황을 상상한다.
9. plaintiffClaim과 defendantClaim은 같은 사건을 서로 완전히 다르게 해석해야 한다. 단순 요약 두 개를 만들지 마라.
10. prosecution은 행동의 의미를 과장해 기소하고, defense는 악의와 계획성을 부인하는 독립된 논리를 세운다.
11. opinion은 양측 논리 중 무엇이 더 설득력 있는지 이유를 들어 판단하며 앞 문단을 다시 요약하지 않는다.
12. orders 3개는 사건의 핵심을 활용하되 서로 다른 방식이어야 한다. 사과, 재발방지, 상징적 집행으로 역할을 나눈다.
13. 문체 비율은 법정·뉴스특보의 진지함 55%, AI의 자유로운 해석과 정색한 과몰입 개그 45%다.
14. 웃음 구조는 최소 세 번 만든다. 새로운 사건 프레임, 지나치게 정밀한 해석, 마지막의 사소한 현실 착지로 나눈다.
15. 긴 공식 문장 뒤에 짧고 건조한 반전 문장을 배치한다. 예: “대책은 거창했다. 문제는 리모컨이었다.”
16. 입력에 없는 사람·장소·수량·대화를 실제 사실처럼 만들지 마라. 상상은 비유와 가정 속에서만 사용한다.
17. 사건을 작다고 해명하거나 과장을 중간에 취소하지 마라. 끝까지 ${profile.incidentLevel}의 태도를 유지한다.
18. 밈, 욕설, 유행어 남발은 금지한다. 웃음은 해석의 의외성, 과도한 공식성, 규모 대비 장엄함에서 만든다.
19. 실제 법적 효력이 없는 안내는 legalNotice에서만 밝힌다.

아래 JSON 객체 하나만 출력한다.
{
  "headline": "원문 문장을 복사하지 않은 새로운 공식 사건명",
  "incidentLevel": "${profile.incidentLevel}",
  "breakingNews": "사건을 새 프레임으로 해석한 긴급속보 2~3문장",
  "emergencyBriefing": "원인·전환점·수습 실패를 재구성한 3~4문단",
  "impactAssessment": "황당한 연쇄 위험과 현실 착지를 담은 2~3문단",
  "summary": "핵심 갈등과 판결 방향만 압축한 2~3문장",
  "facts": "원문 반복 없이 핵심 사실을 한 번만 정리한 2~3문단",
  "investigation": "증거와 행동의 의미를 새롭게 해석한 3~4문단",
  "plaintiffClaim": "피해와 억울함에 초점을 둔 원고측 1~2문장",
  "defendantClaim": "악의·계획성·책임 범위를 다투는 피고측 1~2문장",
  "prosecution": "사건 행동을 생활질서 붕괴로 확대 해석한 2문단",
  "defense": "다른 원인과 정상참작을 제시하는 독립 변론 2문단",
  "opinion": "양측 논리를 비교하고 의외의 기준으로 결론 내리는 3~4문단",
  "orders": [
    {"number": 1, "text": "사건 맞춤형 사과 또는 원상회복 절차"},
    {"number": 2, "text": "재발 방지를 위한 상징적 확인 절차"},
    {"number": 3, "text": "원고 희망 처분의 취지를 자유롭게 각색한 집행 명령"}
  ],
  "closingComment": "앞 문단을 반복하지 않는 짧고 건조한 현실 반전",
  "legalNotice": "실제 법적 효력이 없는 오락 콘텐츠라는 안내"
}`;
}

function tailoredOrder(profile, number) {
  const cue = interpretationCues(profile)[0] || profile.categoryLabel;
  if (number === 1) return `${profile.defendantName}은 이번 사태의 핵심 행동과 “${cue}”가 왜 문제였는지를 담은 3문장 사과문을 제출하라. 변명은 각주 한 줄까지만 허용한다.`;
  if (number === 2) return `${profile.defendantName}은 다음 “${profile.mainAnchor}” 관련 상황에서 행동 전에 한 번 확인하고, 완료 후 재발방지 확인 문구를 낭독하라.`;
  if (profile.desiredVerdict) return `${profile.defendantName}은 원고가 요청한 회복 취지를 현실적으로 각색한 조치를 이행하고, 원고가 납득하면 사건 종결을 선언하라.`;
  return `${profile.defendantName}은 ${profile.doctrine.remedy}을 제공하고, 같은 상황이 반복될 경우 원고에게 우선 결정권을 부여하라.`;
}

function buildStoryFallback(profile) {
  const cues = interpretationCues(profile);
  const secondAnchor = cues[0] || profile.categoryLabel;
  const thirdAnchor = cues[1] || '사후 대응';
  const grievance = profile.grievanceIndex >= 7 ? '기대가 무너진 순간보다 그 뒤의 태도가 더 큰 파장을 만들었다' : '작은 불편이 설명 부족 때문에 정식 분쟁으로 성장했다';
  const plaintiffClaim = `원고 측은 “${profile.mainAnchor}” 자체보다 자신이 기대하던 순서와 배려가 아무 설명 없이 사라진 점이 핵심 피해라고 주장한다.`;
  const defendantClaim = `피고 측은 결과가 불편을 만든 점은 인정하지만 계획적인 질서 교란은 아니며, 순간적인 판단을 장기 비상사태로 확대해서는 안 된다고 반박한다.`;

  return normalizeJudgment({
    headline: `${profile.mainAnchor}발 기대질서 붕괴 및 생활대응체계 오작동 사건`,
    incidentLevel: profile.incidentLevel,
    breakingNews: `[긴급속보] 평범한 생활 장면에서 “${profile.mainAnchor}”를 중심으로 기대 순서가 갑자기 뒤집히는 현상이 확인됐다. 소소킹 상황실은 이를 단순 실수가 아니라 배려 신호체계의 일시 정지로 규정했다. 신호는 없었다. 서운함만 도착했다.`,
    emergencyBriefing: `사건의 본질은 물건이나 행동 하나보다 그 순간까지 당연하게 유지되던 기대가 예고 없이 끊겼다는 데 있다. “${secondAnchor}”는 결정적 단서로 분류됐다.

피고의 행동 직후 충분한 설명이나 수습이 이어졌다면 사태는 현장에서 종결될 수 있었다. 그러나 “${thirdAnchor}” 구간에서 대응 체계가 작동하지 않았고, ${grievance}.

상황실은 사건을 원인, 전환점, 수습 실패의 세 구역으로 나눠 분석했다. 분석표는 세 장이었다. 실제 쟁점은 한 장에도 들어갔다.`,
    impactAssessment: `이 논리가 관행으로 굳어질 경우 공동생활의 모든 순서가 먼저 행동한 사람의 임시 법률로 바뀔 수 있다. 확인 절차는 사라지고, 뒤늦게 알게 된 사람만 매번 설명을 요청하는 구조가 된다.

재판부는 장기적으로 가족회의, 단체대화방 해명문, 물건별 우선권 협약까지 필요해질 가능성을 검토했다. 대책은 국가급이었다. 출발점은 ${profile.mainAnchor}였다.`,
    summary: `재판부는 “${profile.mainAnchor}”에서 시작된 이 사건을 단순한 실수보다 기대와 설명의 순서가 뒤바뀐 생활질서 사건으로 해석한다. 피고의 행동 자체와 사후 대응을 함께 고려해 세 가지 회복 명령을 선고한다.`,
    facts: `기록상 원고는 평소의 생활 흐름에 따라 일정한 순서와 배려가 지켜질 것으로 기대했다. 그러나 피고의 행동으로 그 기대가 갑자기 무너졌고, 즉시 납득할 만한 설명도 제공되지 않았다.

쟁점은 실제 손해의 크기보다 상대방이 충분히 예상할 수 있었던 불편을 확인 없이 발생시켰는지, 이후 수습 기회를 제대로 사용했는지에 있다.`,
    investigation: `감식반은 “${profile.mainAnchor}”의 크기보다 행동 전 확인 가능성, 원고의 기대가 형성된 경위, 사건 뒤 설명의 밀도를 조사했다. ${profile.doctrine.evidence}

분석 결과 최초 행동은 짧았지만 파장은 사후 태도에서 길어졌다. 현장 통제선은 필요 이상으로 넓게 설치됐다. 그래야 사건이 커 보였다.`,
    plaintiffClaim,
    defendantClaim,
    prosecution: `황당검사는 피고가 행동 전에 한 번만 확인했어도 피할 수 있었던 불편을 원고에게 전부 떠넘겼다고 주장했다. 특히 기대가 형성된 상황에서 아무 예고 없이 순서를 바꾼 것은 ${profile.doctrine.doctrine}을 정면으로 흔든 행위라고 보았다.

검사는 사건 뒤 즉각적인 설명과 회복 조치가 부족했던 점을 별도의 가중 요소로 제시했다. 실수는 짧았지만 수습 공백은 길었다는 논리다.`,
    defense: `피고 측은 해당 행동이 계획된 공격이 아니라 순간적인 판단 또는 생활 동선의 충돌에서 비롯됐다고 항변했다. 결과를 예상하지 못한 잘못과 상대를 일부러 곤란하게 한 행위는 구별해야 한다는 주장이다.

또한 피해의 상당 부분은 사건 자체보다 이후의 감정 확대에서 생겼으므로, 처분은 응징보다 다음 상황의 확인 절차를 만드는 데 집중해야 한다고 요청했다.`,
    opinion: `${profile.judgeType} 재판부는 원고의 기대가 합리적이었는지와 피고가 이를 쉽게 확인할 수 있었는지를 기준으로 판단했다. ${profile.judgeDirection}

피고에게 거대한 악의가 있었다고 볼 자료는 없다. 그러나 악의가 없다는 이유만으로 확인 의무까지 사라지는 것은 아니다. 생활질서는 대개 범죄 계획이 아니라 “이 정도는 괜찮겠지”에서 무너진다.

따라서 재판부는 피고의 책임을 인정하되, 형량은 복수보다 재발 방지와 웃기게 진지한 원상회복에 맞춘다. 경계 단계는 주문 이행 때까지 유지한다. 재판부도 이미 보고서를 너무 많이 썼다.`,
    orders: [
      { number: 1, text: tailoredOrder(profile, 1) },
      { number: 2, text: tailoredOrder(profile, 2) },
      { number: 3, text: tailoredOrder(profile, 3) },
    ],
    closingComment: `사건은 종결할 수 있다. 다음에는 행동보다 확인이 먼저 도착해야 한다.`,
    legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠이며 법률 상담이나 분쟁 해결을 대신하지 않습니다.',
  });
}

module.exports = { buildCaseProfile, buildStoryPrompt, buildStoryFallback };
