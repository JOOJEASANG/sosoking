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

function buildStoryPrompt(profile) {
  const anchors = profile.anchors.join(', ');
  return `너는 소소킹 판결소의 AI 재판부이자 긴급사건 브리핑 담당관이다.
목표는 “실제 사건은 놓치지 않고, 규모는 국가적 재난처럼 부풀리며, 수사·양측 공방·판결의 모든 과정을 읽는 재미가 있는 사건 기록”을 만드는 것이다.

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
대표 사건 물건·대상: ${profile.mainAnchor}
예상 연쇄 위험: ${profile.doctrine.risk}
현장 대응 방식: ${profile.doctrine.response}
마지막 현실 반전: ${profile.doctrine.undercut}

[반드시 반영할 실제 사건 사실]
${factList(profile)}

[사건 핵심 단어]
${anchors}

작성 원칙:
1. 실제 입력 사실이 모든 문단의 중심이어야 한다. 입력에 없는 사람·장소·수량·대화는 사실처럼 만들지 마라.
2. 문체 비율은 법정·뉴스특보의 진지함 60%, 정색한 재난 과몰입 개그 40%다.
3. 첫 문장부터 이미 큰일이 난 것처럼 시작한다. “긴급속보”, “상황실 가동”, “경계 단계 격상” 중 하나를 사용한다.
4. 사건을 작다고 미리 해명하거나 “국가적 비상은 아니지만”처럼 과장을 스스로 취소하지 마라. 끝까지 큰일처럼 밀어붙인다.
5. 웃음 구조는 세 번 만든다. breakingNews에서 물건을 재난 중심물로 격상하고, emergencyBriefing 또는 investigation에서 지나치게 정밀 분석하며, impactAssessment 또는 closingComment에서 사소한 현실로 착지한다.
6. 긴 공식 문장 두 개 뒤에 짧고 건조한 한 문장을 배치한다. 예: “상황은 통제되지 않았다. 만두는 이미 없었다.”
7. incidentLevel은 위 사건 경계 단계를 사용한다.
8. breakingNews는 2~3문장으로 쓰고 대표 물건 “${profile.mainAnchor}”와 실제 행동을 포함한다.
9. emergencyBriefing은 사건 발생 전 → 결정적 순간 → 사건 후 대응의 3단계로 3~5문단 작성한다. ${profile.doctrine.response}
10. impactAssessment는 “이 사태를 방치할 경우”라는 가정 아래 연쇄 피해를 과장하고, 마지막은 ${profile.doctrine.undercut}는 식으로 현실에 착지한다.
11. facts는 실제 사실을 3~5문단으로 풀어 장면이 보이게 작성한다.
12. investigation에는 핵심어 최소 3개, 증거물 지정, 통제선 또는 상황실, 0.1초·초 단위·프레임 단위 중 하나를 넣는다. ${profile.doctrine.evidence}
13. plaintiffClaim은 원고가 법정에서 직접 말하는 듯한 1~2문장 핵심 주장이다. “${profile.mainAnchor}”와 실제 피해 장면을 넣고 70~220자로 작성한다.
14. defendantClaim은 피고가 사실관계는 인정하면서도 악의·계획성·과도한 책임은 부인하는 1~2문장 핵심 반박이다. “${profile.mainAnchor}”를 넣고 70~220자로 작성한다.
15. prosecution은 plaintiffClaim을 법률 문체로 확대해 실제 행동을 생활질서 붕괴의 직접 원인처럼 강하게 기소한다.
16. defense는 defendantClaim을 과도하게 진지한 정상참작 논리로 확장하되 실제 사실을 부정하지 않는다.
17. opinion은 재판부가 야간 비상근무까지 한 것처럼 구체적으로 판단한다.
18. orders 3개 모두 사건 맞춤형이어야 한다. 최소 2개에 “${profile.mainAnchor}”를 넣고 낭독·확인·우선권 같은 실행 장면을 작성한다.
19. “사소하지만”, “관계 회복”, “생활형 의무” 같은 상투어는 각각 최대 한 번만 사용한다.
20. “${profile.mainAnchor}”는 breakingNews·emergencyBriefing·impactAssessment·plaintiffClaim·defendantClaim과 기존 본문 최소 4곳, orders 최소 2곳에 적는다.
21. 밈, 욕설, 유행어 남발은 금지한다. 웃음은 과도한 공식성, 정밀 감식, 규모 대비 장엄한 대응에서 만든다.
22. 실제 법적 효력이 없는 안내는 legalNotice에서만 밝힌다.

아래 JSON 객체 하나만 출력한다.
{
  "headline": "사건 물건과 행동이 드러나는 재난급 공식 사건명",
  "incidentLevel": "${profile.incidentLevel}",
  "breakingNews": "긴급속보 형식의 2~3문장",
  "emergencyBriefing": "발생 전·결정적 순간·사후 대응을 담은 3~5문단",
  "impactAssessment": "방치 시 연쇄 피해를 과장하고 사소한 현실로 끝나는 2~3문단",
  "summary": "사건 사실과 결론, 과장된 위기감이 들어간 2~3문장",
  "facts": "실제 사건의 경위 3~5문단",
  "investigation": "현장 통제와 정밀 감식을 포함한 3~5문단",
  "plaintiffClaim": "원고측 1~2문장 핵심 주장",
  "defendantClaim": "피고측 1~2문장 핵심 반박",
  "prosecution": "원고측 핵심 주장을 확대해 구체적 행동을 생활질서 붕괴로 기소하는 2문단",
  "defense": "피고측 핵심 반박을 확장한 과도하게 진지한 정상참작 변론 2문단",
  "opinion": "웃음과 판단이 함께 있는 재판부 결정 3~5문단",
  "orders": [
    {"number": 1, "text": "사건 맞춤형 공개 사과 또는 원상회복 절차"},
    {"number": 2, "text": "대표 물건을 언급한 재발 방지 절차"},
    {"number": 3, "text": "${profile.desiredVerdict || profile.doctrine.remedy}를 반영한 과장된 집행 명령"}
  ],
  "closingComment": "거대한 위기를 대표 물건으로 착지시키는 짧은 한마디",
  "legalNotice": "실제 법적 효력이 없는 오락 콘텐츠라는 안내"
}`;
}

function tailoredOrder(profile, number) {
  const fact = profile.facts[Math.min(number - 1, profile.facts.length - 1)] || profile.description;
  if (number === 1) return `${profile.defendantName}은 “${cleanText(fact, 170)}”에 관한 3문장 사과문을 작성하라. 제2문장에는 “${profile.mainAnchor}”를 넣고 낭독 중 웃음으로 책임을 희석해서는 아니 된다.`;
  if (number === 2) return `${profile.defendantName}은 다음 “${profile.mainAnchor}” 관련 상황에서 행동 전 원고에게 확인하고, 결과를 한 줄짜리 비상대응 기록으로 남겨 상황실에 보고하라.`;
  if (profile.desiredVerdict) return `${profile.defendantName}은 “${profile.desiredVerdict}”를 이행하라. 완료 후 “${profile.mainAnchor} 사태 종결”을 선언하고 평온 회복 여부를 확인하라.`;
  return `${profile.defendantName}은 ${profile.doctrine.remedy}을 제공하고 “${profile.mainAnchor} 사태 종결 보고”를 구두로 제출하라.`;
}

function buildStoryFallback(profile) {
  const firstFact = cleanText(profile.facts[0] || profile.description, 260);
  const secondFact = cleanText(profile.facts[1] || profile.facts[0] || profile.description, 260);
  const remainingFacts = profile.facts.slice(2).map((fact, index) => `${index + 3}단계: ${fact}`).join(' ');
  const factSequence = profile.facts.map((fact, index) => `${index + 1}단계: ${fact}`).join('\n');
  const laterFacts = profile.facts.slice(1).join(' ');
  const secondAnchor = profile.anchors
    .filter(anchor => anchor.toLowerCase() !== profile.mainAnchor.toLowerCase() && isConcreteSecondaryAnchor(anchor))
    .filter(anchor => laterFacts.includes(anchor))
    .sort((left, right) => right.length - left.length)[0]
    || profile.anchors.filter(anchor => anchor.toLowerCase() !== profile.mainAnchor.toLowerCase() && isConcreteSecondaryAnchor(anchor)).sort((left, right) => right.length - left.length)[0]
    || profile.mainAnchor;
  const plaintiffClaim = `원고 측은 “${profile.mainAnchor}”와 관련해 ${firstFact}라는 일이 실제로 벌어졌고, 이어 ${secondFact}라는 대응까지 겹치면서 단순한 착오가 아니라 설명과 배려가 동시에 사라진 사건이 됐다고 주장한다.`;
  const defendantClaim = `피고 측은 “${profile.mainAnchor}” 사태의 사실관계는 인정하지만 계획적인 생활질서 전복은 아니었으며, 순간적 판단 착오와 상황 대응 실패를 국가적 비상행위와 동일하게 볼 수는 없다고 반박한다.`;

  return normalizeJudgment({
    headline: `${profile.mainAnchor}발 생활질서 붕괴 및 ${profile.doctrine.doctrine} 비상사건`,
    incidentLevel: profile.incidentLevel,
    breakingNews: `[긴급속보] “${profile.mainAnchor}”를 둘러싼 생활질서 붕괴 징후가 포착됐다. ${firstFact}. 소소킹 판결소는 사건 경계 단계를 “${profile.incidentLevel}” 수준으로 격상하고 관계자 전원의 표정과 손 이동 경로를 확보했다.`,
    emergencyBriefing: `상황 발생 전, 현장은 겉보기에는 평온했다. 그러나 “${profile.mainAnchor}”를 둘러싼 잠재적 긴장은 이미 축적되고 있었다. 재판부는 이 시점을 사태 발생 전야로 분류했다.\n\n결정적 순간은 다음과 같다. ${firstFact}. 이어 ${secondFact}. 이 짧은 구간에서 생활질서는 흔들렸고 원고의 어이없음은 긴급 브리핑 대상이 됐다.\n\n사건 직후 ${profile.doctrine.response}했다. “${profile.mainAnchor}”는 증거물 제1호로 지정됐고 핵심어 “${secondAnchor}”를 참고자료 제2호로 편철했다. 상황실은 야간 비상근무에 돌입했다. 아무도 요청하지 않았지만 이미 돌입했다.`,
    impactAssessment: `이 사태를 방치할 경우 ${profile.doctrine.risk}이 있다. 한 번의 예외가 관행이 되고 관행이 규칙이 되면 다음 피해자는 아직 모습을 드러내지 않은 다른 간식·약속·공용 물건이 될 수 있다.\n\n재판부는 가족회의 장기화, 단톡방 성명 발표, 냉랭한 침묵의 확대까지 검토했다. 다만 모든 보고서를 덮고 나면 “${profile.mainAnchor}” 기록만 남고, ${profile.doctrine.undercut}.`,
    summary: `“${profile.mainAnchor}” 사태는 ${profile.incidentLevel}로 분류됐다. 재판부는 ${firstFact}라는 장면이 생활질서 붕괴의 직접 계기가 됐다고 판단하고 사건 맞춤 명령 3개를 선고한다.`,
    facts: `사건 기록은 다음 순서다.\n${factSequence}\n\n첫 장면인 “${firstFact}”와 이어진 “${secondFact}” 사이에서 사태가 확대됐다. ${remainingFacts || '추가 단계는 없었으나 원고의 평온은 이미 흔들렸다.'}\n\n재판부는 사건명 “${profile.title}”, 억울함 지수 ${profile.grievanceIndex}/10, 피고의 사후 태도를 검토했다. 핵심은 “${profile.mainAnchor}”가 걸린 순간에 원고의 기대와 설명 기회가 동시에 사라졌다는 점이다.`,
    investigation: `${profile.doctrine.evidence} 임시 통제선 아래 “${profile.mainAnchor}”, “${secondAnchor}”, 행동 순서를 분석했다.\n\n감식반은 “${firstFact}”를 0.1초 단위로 복원하고 “${secondFact}”가 사태를 진정시켰는지 검토했다. 결론은 후자였다.\n\n수사대는 “${profile.mainAnchor}” 전후의 태도가 피해를 키웠다고 판단했다. 증거는 거창했다. 대상은 여전히 ${profile.mainAnchor}였다.`,
    plaintiffClaim,
    defendantClaim,
    prosecution: `황당검사는 원고 측 핵심 주장인 “${plaintiffClaim}”을 토대로 “${firstFact}”가 ${profile.doctrine.doctrine}을 흔들었다고 기소했다. 피고가 “${profile.mainAnchor}”의 중요성을 확인하지 않은 순간 생활질서 붕괴가 시작됐다는 주장이다.\n\n검사는 “${secondFact}”를 중대한 사후 태도로 지적했다. 수습 골든타임을 놓쳐 재판부가 야간 비상근무에 들어갔다고 논고했다.`,
    defense: `피고 측 변호인은 “${defendantClaim}”이라고 항변했다. “${firstFact}”에 악의가 없었고 순간적 판단 착오와 생활 동선의 충돌이 겹쳤다는 취지다.\n\n변호인은 “${profile.mainAnchor}” 하나로 상황실을 가동한 절차가 장엄하다고 지적했다. 재판부는 기록에 남겼다. 그리고 상황실 운영을 계속했다.`,
    opinion: `${profile.judgeType} 재판부는 기록과 원고·피고 양측의 짧은 주장을 과도하게 진지하게 검토했다. ${profile.judgeDirection}\n\n기록상 다음 사실이 인정된다.\n${factSequence}\n\n“${profile.mainAnchor}” 자체는 작아 보일 수 있다. 그러나 작은 대상일수록 “그것 때문에 왜 이렇게까지?”라는 말이 나오는 순간 과몰입 재판의 필요성이 완성된다.\n\n현재의 경계 단계는 해제하지 않는다. 공식 분류명은 “${profile.incidentLevel}”이다. 주문이 이행될 때까지 상황실은 유지된다. 재판부의 퇴근도 그 뒤다.\n\n판결문이 “${profile.mainAnchor}”보다 훨씬 커졌다. 그것이 이번 사태의 규모다.`,
    orders: [
      { number: 1, text: tailoredOrder(profile, 1) },
      { number: 2, text: tailoredOrder(profile, 2) },
      { number: 3, text: tailoredOrder(profile, 3) },
    ],
    closingComment: `상황실은 해산할 수 있다. 다만 “${profile.mainAnchor}”는 다음부터 제자리에 있거나 최소한 먼저 물어봐야 한다.`,
    legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠이며 법률 상담이나 분쟁 해결을 대신하지 않습니다.',
  });
}

module.exports = { buildCaseProfile, buildStoryPrompt, buildStoryFallback };
