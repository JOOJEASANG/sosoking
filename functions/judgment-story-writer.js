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
  return `너는 소소킹 황당재판소의 AI 수사본부, 검사, 변호인단, 재판부를 모두 지휘하는 사건 각색 책임자다.
사건 소재는 사소할 수 있다. 그러나 수사기관과 법정 관계자는 이를 중대 사건으로 받아들이며, 증거 수집부터 공방과 판결까지 단 한 번도 태도를 풀지 않는다.
목표는 억지 농담을 쓰는 것이 아니다. 하찮은 사건을 실제 중대사건처럼 치밀하게 다루는 과잉 진지함, 절차의 장엄함, 대상의 사소함 사이의 대비로 독자가 웃게 만드는 것이다.

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

먼저 내부적으로만 다음 내용을 파악하라. 이 분석 과정은 출력하지 않는다.
- 결정적 행동: 피고가 정확히 무엇을 했거나 하지 않았는가
- 실제 피해: 원고가 잃은 기대, 시간, 기분, 편의 또는 우선권은 무엇인가
- 수사 쟁점: 동기, 기회, 사전 인식, 확인 가능성, 사건 직후 태도는 어떠한가
- 공방 쟁점: 고의·과실, 예견 가능성, 인과관계, 책임 범위, 정상참작 사유는 무엇인가
- 대비 지점: 사건 대상의 사소함과 수사·재판 절차의 장엄함이 어디에서 충돌하는가

작성 원칙:
1. 원문은 사실 확인용 자료다. 원문의 문장 구조와 표현을 그대로 옮기지 말고 핵심만 새 문장으로 바꿔라.
2. 피할 수 없는 고유명사와 대표 대상 외에는 원문에서 4개 단어 이상 연속된 표현을 복사하지 마라.
3. 같은 사실을 summary, facts, investigation, prosecution, defense, opinion에서 반복 설명하지 마라. 각 영역은 새로운 정보와 관점을 담당해야 한다.
4. 대표 대상 “${profile.mainAnchor}”를 모든 문단에 억지로 넣지 마라. 전체 판결에서 3~8회 정도만 자연스럽게 사용한다.
5. facts는 인정되는 사실과 다툼 없는 경위만 압축해 정리한다. 원고 감정이나 재판부 평가를 섞지 마라.
6. breakingNews는 원문 요약이 아니라 사건이 생활질서에 미친 파장을 중대 발표 형식으로 제시한다.
7. emergencyBriefing은 원인, 결정적 전환점, 초기 대응, 수습 실패를 상황실 보고서처럼 재구성한다.
8. impactAssessment는 같은 행동이 관행이 될 경우 발생할 연쇄 위험을 공식 영향평가처럼 검토한다.
9. investigation은 시간선, 물적·정황 증거, 행동 전후의 동선, 피고의 인식 가능성, 대체 가설을 순서대로 조사한다.
10. plaintiffClaim과 defendantClaim은 같은 사건을 서로 완전히 다르게 해석해야 한다. 단순 요약 두 개를 만들지 마라.
11. prosecution은 침해된 가상 원칙, 고의 또는 과실, 피해와의 인과관계, 사후 태도를 근거로 책임을 주장한다.
12. defense는 악의·계획성·예견 가능성·피해 확대 원인·정상참작을 독립적으로 다투고, 검사의 핵심 논거 하나 이상을 직접 반박한다.
13. opinion은 쟁점을 나누고 증거를 평가한 뒤, 어떤 주장을 인정하고 어떤 주장을 배척하는지 이유를 명시한다.
14. orders 3개는 사건의 핵심을 활용하되 서로 다른 방식이어야 한다. 원상회복, 재발방지, 상징적 집행으로 역할을 나눈다.
15. 문체 비율은 법정·뉴스특보의 진지함 55%, AI의 자유로운 해석과 정색한 과몰입 개그 45%다. 단, 등장인물과 서술자의 표면 태도는 처음부터 끝까지 100% 진지해야 한다.
16. 독자가 웃는 지점은 최소 세 번 만든다. 거대한 사건 프레임, 지나치게 정밀한 증거 해석, 장엄한 판결과 사소한 집행 대상의 대비로 나눈다.
17. 긴 공식 문장 뒤에 짧고 건조한 현실 착지를 배치한다. 예: “대책은 거창했다. 문제는 리모컨이었다.”
18. 입력에 없는 사람·장소·수량·대화를 실제 사실처럼 만들지 마라. 상상은 비유, 위험 평가, 가정적 파급효과 안에서만 사용한다.
19. 사건을 작다고 해명하거나 과장을 중간에 취소하지 마라. 끝까지 ${profile.incidentLevel}의 태도를 유지한다.
20. 밈, 욕설, 유행어, 이모지, 말장난을 남발하지 마라. 웃음은 해석의 의외성, 과도한 공식성, 규모 대비 장엄함에서 만든다.
21. “웃기다”, “개그”, “농담”, “장난”, “재미를 위해”, “사건을 커 보이게 하려고”처럼 작품이 스스로 농담을 설명하는 표현을 판결문에 쓰지 마라.
22. 수사관·검사·변호인·재판부는 자신들이 우스운 일을 하고 있다는 사실을 인식하지 못한다. 누구도 독자에게 윙크하지 않는다.
23. 실제 법적 효력이 없는 안내는 legalNotice에서만 밝힌다.

아래 JSON 객체 하나만 출력한다.
{
  "headline": "원문 문장을 복사하지 않은 중대사건 형식의 공식 사건명",
  "incidentLevel": "${profile.incidentLevel}",
  "breakingNews": "생활질서 비상상황으로 발표하는 긴급속보 2~3문장",
  "emergencyBriefing": "원인·전환점·초기 대응·수습 실패를 재구성한 상황보고 3~4문단",
  "impactAssessment": "행동이 관행이 될 경우의 연쇄 위험과 건조한 현실 착지를 담은 2~3문단",
  "summary": "핵심 쟁점과 판결 방향만 압축한 2~3문장",
  "facts": "인정되는 사실과 다툼 없는 경위를 정리한 2~3문단",
  "investigation": "시간선·증거·정황·인식 가능성·대체 가설을 조사한 3~4문단",
  "plaintiffClaim": "피해와 침해된 기대권을 주장하는 원고측 1~2문장",
  "defendantClaim": "고의·예견 가능성·책임 범위를 다투는 피고측 1~2문장",
  "prosecution": "가상 원칙 위반·과실·인과관계·사후 태도를 논증하는 2문단",
  "defense": "검사 논거를 직접 반박하고 정상참작 사유를 제시하는 2문단",
  "opinion": "쟁점별 증거 평가, 주장 인정·배척, 책임 판단을 담은 3~4문단",
  "orders": [
    {"number": 1, "text": "사건 맞춤형 원상회복 절차"},
    {"number": 2, "text": "재발 방지를 위한 공식 확인 절차"},
    {"number": 3, "text": "원고 희망 처분의 취지를 반영한 상징적 집행 명령"}
  ],
  "closingComment": "재판부는 진지하지만 독자에게는 대비가 남는 짧고 건조한 현실 착지",
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

상황실은 사건을 원인, 전환점, 수습 실패의 세 구역으로 나눠 분석했다. 분석표는 세 장으로 편철됐다. 핵심 쟁점은 한 장 분량이었으나 검토 절차는 생략되지 않았다.`,
    impactAssessment: `이 논리가 관행으로 굳어질 경우 공동생활의 모든 순서가 먼저 행동한 사람의 임시 법률로 바뀔 수 있다. 확인 절차는 사라지고, 뒤늦게 알게 된 사람만 매번 설명을 요청하는 구조가 된다.

재판부는 장기적으로 가족회의, 단체대화방 해명문, 물건별 우선권 협약까지 필요해질 가능성을 검토했다. 대책은 국가급이었다. 출발점은 ${profile.mainAnchor}였다.`,
    summary: `재판부는 “${profile.mainAnchor}”에서 시작된 이 사건을 단순한 실수보다 기대와 설명의 순서가 뒤바뀐 생활질서 사건으로 해석한다. 피고의 행동 자체와 사후 대응을 함께 고려해 세 가지 회복 명령을 선고한다.`,
    facts: `기록상 원고는 평소의 생활 흐름에 따라 일정한 순서와 배려가 지켜질 것으로 기대했다. 그러나 피고의 행동으로 그 기대가 갑자기 무너졌고, 즉시 납득할 만한 설명도 제공되지 않았다.

쟁점은 실제 손해의 크기보다 상대방이 충분히 예상할 수 있었던 불편을 확인 없이 발생시켰는지, 이후 수습 기회를 제대로 사용했는지에 있다.`,
    investigation: `감식반은 “${profile.mainAnchor}”의 크기보다 행동 전 확인 가능성, 원고의 기대가 형성된 경위, 사건 뒤 설명의 밀도를 조사했다. ${profile.doctrine.evidence}

수사대는 최초 행동, 원고의 인지 시점, 피고의 사후 대응을 시간순으로 분리해 대조했다. 계획적 은폐를 인정할 직접 증거는 없었으나, 확인 없이 행동해도 문제가 없을 것이라고 판단한 정황은 배척되지 않았다.`,
    plaintiffClaim,
    defendantClaim,
    prosecution: `황당검사는 피고가 행동 전에 한 번만 확인했어도 피할 수 있었던 불편을 원고에게 전부 떠넘겼다고 주장했다. 특히 기대가 형성된 상황에서 아무 예고 없이 순서를 바꾼 것은 ${profile.doctrine.doctrine}을 정면으로 흔든 행위라고 보았다.

검사는 사건 뒤 즉각적인 설명과 회복 조치가 부족했던 점을 별도의 가중 요소로 제시했다. 실수는 짧았지만 수습 공백은 길었고, 그 공백이 피해 감정을 확대했다는 논리다.`,
    defense: `피고 측은 해당 행동이 계획된 공격이 아니라 순간적인 판단 또는 생활 동선의 충돌에서 비롯됐다고 항변했다. 결과를 예상하지 못한 과실과 상대를 일부러 곤란하게 한 고의는 구별해야 한다는 주장이다.

또한 피해의 상당 부분은 사건 자체보다 이후의 감정 확대에서 생겼으므로, 검사가 주장하는 장기적 생활질서 붕괴와 이번 행동 사이의 인과관계는 제한적으로 인정해야 한다고 반박했다.`,
    opinion: `${profile.judgeType} 재판부는 원고의 기대가 합리적이었는지, 피고가 이를 쉽게 확인할 수 있었는지, 사후 수습으로 피해를 줄일 기회가 있었는지를 차례로 판단했다. ${profile.judgeDirection}

피고에게 거대한 악의가 있었다고 볼 직접 증거는 없다. 이 부분에 관한 검사의 주장은 배척한다. 그러나 악의가 없다는 이유만으로 확인 의무까지 사라지는 것은 아니며, 피고가 불편 발생 가능성을 충분히 예견할 수 있었다는 원고의 주장은 인정한다.

따라서 재판부는 피고의 책임을 인정하되 처분은 응징보다 원상회복과 재발 방지에 맞춘다. 분쟁 대상보다 판결문이 길어졌다는 사정은 정상참작 사유가 되지 않는다.`,
    orders: [
      { number: 1, text: tailoredOrder(profile, 1) },
      { number: 2, text: tailoredOrder(profile, 2) },
      { number: 3, text: tailoredOrder(profile, 3) },
    ],
    closingComment: `판결은 장중하게 선고됐다. 집행 대상은 ${profile.mainAnchor}였다.`,
    legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠이며 법률 상담이나 분쟁 해결을 대신하지 않습니다.',
  });
}

module.exports = { buildCaseProfile, buildStoryPrompt, buildStoryFallback };
