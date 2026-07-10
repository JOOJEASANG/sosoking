const { cleanText, cleanParagraph, normalizeJudgment } = require('./judgment-v2');

const STOPWORDS = new Set([
  '사건', '내용', '원고', '피고', '재판부', '판결', '관련', '상대방', '사람', '부분', '정도',
  '그냥', '정말', '너무', '제가', '나는', '내가', '저는', '저희', '우리', '그리고', '그런데',
  '그래서', '때문에', '했습니다', '했는데', '합니다', '하였다', '있습니다', '있었다', '없었다',
  '같습니다', '이라고', '라고', '하는', '하게', '되어', '되는', '이런', '그런', '있는', '없는',
]);

const PARTICLES = [
  '으로부터', '에게서', '한테서', '이라도', '라도', '에서', '에게', '한테', '께서', '처럼',
  '보다', '까지', '부터', '으로', '밖에', '마저', '조차', '이나', '나', '은', '는', '이', '가',
  '을', '를', '에', '로', '와', '과', '도', '만', '의',
];

const MAIN_ANCHOR_SKIP = new Set([
  '마지막', '최후', '먼저', '관련', '선점', '은닉', '실종', '무단', '침해', '중대', '반복',
  '장기', '공용', '공동', '앞으로', '다음', '순간', '사라짐', '분실', '방치',
]);

const CATEGORY_LABELS = {
  food: '음식·식탐',
  late: '약속·지각',
  love: '연인·관계',
  work: '직장·학교',
  digital: '디지털·연락',
  family: '가족·생활',
  other: '기타 생활분쟁',
};

const JUDGE_DIRECTIONS = {
  '엄벌주의형': '사소한 행위도 생활질서 붕괴의 전조로 보고, 표정 변화와 사후 태도까지 엄중하게 추궁한다.',
  '감성형': '원고가 느낀 서운함의 잔향을 과도하게 세밀히 묘사하되 감상문이 아니라 판결문 말투를 유지한다.',
  '현실주의형': '건조하고 냉정하게 책임을 나누고, 당장 실행할 수 있는 시정명령으로 웃음을 만든다.',
  '과몰입형': '사소한 장면을 국가적 비상사태나 대하 법정극처럼 확대하되 사건의 실제 사실을 중심에 둔다.',
  '피곤형': '재판부가 이 사소한 일 때문에 퇴근하지 못한 듯한 건조한 피로감을 섞되 판단은 정확하게 한다.',
  '논리집착형': '시간, 횟수, 거리, 남은 수량 등을 가능한 범위에서 계산하고, 소수점 단위의 과잉 논리로 웃음을 만든다.',
  '드립형': '인터넷 밈 대신 법률 문체 속 정색한 비유와 말장난을 한두 번만 사용한다.',
};

const CATEGORY_DOCTRINES = {
  food: {
    doctrine: '최후 한입 기대권 및 냉장고 평온권',
    evidence: '소소감식반은 남은 수량, 포장지의 위치, 마지막 한입을 기다린 시간을 증거물 제1호로 지정한다.',
    remedy: '동일 품목 또는 원고가 납득할 수 있는 상위 대체품의 우선 선택권',
  },
  late: {
    doctrine: '약속시각 신뢰보호원칙 및 대기시간 회복권',
    evidence: '시간감식관은 약속 시각과 실제 행동 사이의 공백을 분 단위로 복원하고, 기다림의 체감 길이를 별도 산정한다.',
    remedy: '다음 약속의 출발 인증 및 지각 시간만큼 원고가 정하는 보상 시간',
  },
  love: {
    doctrine: '정서응답 적시성 원칙 및 관계평온권',
    evidence: '감정감식반은 사건 전후의 말투, 침묵의 길이, 서운함이 발생한 결정적 순간을 기록한다.',
    remedy: '사건의 핵심 행동을 정확히 언급한 사과와 원고가 선택하는 관계 회복 행동',
  },
  work: {
    doctrine: '업무평온권 및 회의실 생존권',
    evidence: '업무질서수사대는 사건으로 낭비된 시간과 주변인의 무언의 한숨을 참고자료로 편철한다.',
    remedy: '다음 동일 상황에서 피고가 먼저 처리하고 결과를 공개 보고할 의무',
  },
  digital: {
    doctrine: '디지털 응답권 및 읽음 후 방치금지 원칙',
    evidence: '디지털감식반은 전송 시각, 확인 시각, 답변이 증발한 구간을 초 단위로 복원한다.',
    remedy: '다음 연락에 대한 명확한 응답과 읽었으나 답하지 못할 경우의 사전 통지',
  },
  family: {
    doctrine: '공동생활 평온권 및 가족 간 사전고지 원칙',
    evidence: '가정평온수사대는 공용 공간의 동선과 사건 직후 집안에 흐른 미묘한 정적을 현장 기록으로 남긴다.',
    remedy: '같은 생활 상황에서 원고에게 우선 확인하고 공동 규칙을 한 줄로 작성할 의무',
  },
  other: {
    doctrine: '사소함에도 불구하고 찝찝함을 남기지 않을 권리',
    evidence: '소소감식반은 사건의 결정적 순간을 0.1초 단위로 복원하고, 원고의 어이없음이 최고조에 이른 지점을 표시한다.',
    remedy: '사건의 핵심 행동을 바로잡는 맞춤형 조치와 재발 시 원고에게 우선 결정권을 부여하는 의무',
  },
};

const SERIOUS_HUMOR_MARKERS = [
  '0.1초', '감식반', '감식관', '수사대', '증거물 제', '국가적 비상', '비상대책', '헌법상',
  '사법 역사', '압수수색', '퇴근하지 못', '대하 법정극', '생활질서 붕괴', '현장 기록',
];

function splitFacts(description) {
  const source = cleanParagraph(description, 1800);
  const chunks = source
    .split(/(?:\n+|[.!?]+\s*|\s+(?:그리고|그런데|그러나|그래서)\s+)/)
    .map(item => cleanParagraph(item, 260))
    .filter(item => item.length >= 8);
  if (!chunks.length && source) return [source];
  return chunks.slice(0, 5);
}

function normalizeAnchorToken(value) {
  let token = String(value || '').trim();
  if (!token) return '';
  for (const particle of PARTICLES) {
    if (token.length > particle.length + 1 && token.endsWith(particle)) {
      token = token.slice(0, -particle.length);
      break;
    }
  }
  return token;
}

function extractAnchors(title, description) {
  const ordered = [];
  const seen = new Set();
  const sources = [title || '', description || ''];
  for (const source of sources) {
    const tokens = String(source).match(/[가-힣A-Za-z0-9]+/g) || [];
    for (const tokenValue of tokens) {
      const token = normalizeAnchorToken(tokenValue);
      if (token.length < 2 || STOPWORDS.has(token) || /^\d+$/.test(token) || seen.has(token)) continue;
      seen.add(token);
      ordered.push(token);
      if (ordered.length >= 10) return ordered;
    }
  }
  return ordered;
}

function resolveStoryCategory(categoryId, anchors, description) {
  const source = `${anchors.join(' ')} ${description}`;
  const householdTerms = ['리모컨', '소파', '거실', '주방', '세탁기', '청소', '방', '집안'];
  if (categoryId === 'digital' && householdTerms.some(term => source.includes(term))) return 'family';
  return CATEGORY_DOCTRINES[categoryId] ? categoryId : 'other';
}

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
  };
}

function factList(profile) {
  return profile.facts.map((fact, index) => `${index + 1}. ${fact}`).join('\n');
}

function buildStoryPrompt(profile) {
  const anchors = profile.anchors.join(', ');
  return `너는 소소킹 판결소의 AI 재판부다. 목표는 “사건은 실제 입력 그대로, 태도는 국가 중대사건처럼” 작성하는 것이다.

[사건 기록]
사건명: ${profile.title}
공식 사건명 초안: ${profile.headline}
피고 호칭: ${profile.defendantName}
판사 성향: ${profile.judgeType}
판사 연출 지시: ${profile.judgeDirection}
분류: ${profile.categoryLabel}
적용할 가상 원칙: ${profile.doctrine.doctrine}
억울함 지수: ${profile.grievanceIndex}/10
원고 희망 처분: ${profile.desiredVerdict || '별도 희망 없음'}
대표 사건 물건·대상: ${profile.mainAnchor}

[반드시 반영할 실제 사건 사실]
${factList(profile)}

[사건 핵심 단어]
${anchors}

작성 원칙:
1. 입력 사건의 고유 사실이 판결의 주인공이어야 한다. 일반적인 인간관계 조언문을 쓰지 마라.
2. facts에는 위 실제 사실을 빠뜨리지 말고 자연스럽게 재구성한다.
3. investigation, prosecution, defense, opinion의 첫 문장에는 실제 사건의 물건·행동·시간·상황 중 하나를 반드시 넣는다.
4. investigation에서는 최소 2개의 사건 핵심 단어를 증거처럼 분석한다. ${profile.doctrine.evidence}
5. prosecution은 실제 행동의 무엇이 문제인지 특정하고, defense는 같은 사실을 다른 시각에서 변명한다. 입력에 없는 새 사실은 만들지 마라.
6. opinion은 “사소하지만 왜 억울했는지”를 사건의 구체적 장면으로 판단한다.
7. orders 3개 중 최소 2개는 사건 핵심 단어 또는 실제 행동을 직접 언급해야 한다. 단순히 ‘사과하라’, ‘재발 방지하라’, ‘간식을 제공하라’로 끝내지 마라.
8. 문체 비율은 판결문 80%, 정색한 과몰입 개그 20%다. 밈, 욕설, 억지 유행어는 금지한다.
9. 웃음은 구체적 사실을 지나치게 감식하고 거창한 권리로 승격시키는 데서 만든다. 예: 마지막 만두는 ‘최후만두 점유권’, 늦은 답장은 ‘디지털 응답 공백 감식’, 사라진 리모컨은 ‘가정방송권 압수 사건’처럼 다룬다.
10. 적어도 한 곳에는 0.1초 단위 복원, 증거물 지정, 비상대책회의, 재판부 퇴근 방해 등 정색한 과잉 수사 표현을 사건에 맞게 넣는다.
11. 대표 사건 물건·대상 “${profile.mainAnchor}”는 summary·facts·investigation·prosecution·defense·opinion·closingComment 중 최소 4곳과 orders 중 최소 2곳에 직접 적는다.
12. 정치, 혐오, 성적 내용, 자해, 실제 범죄 조언, 개인정보를 만들지 마라. 실제 법적 효력이 없는 오락 콘텐츠라는 안내를 포함한다.

아래 JSON 객체 하나만 출력한다. 마크다운과 설명문은 붙이지 않는다.
{
  "headline": "사건의 물건이나 행동이 드러나는 거창한 공식 사건명",
  "summary": "구체적 사건 사실과 결론이 모두 들어간 2문장",
  "facts": "실제 사건의 경위 2~4문단",
  "investigation": "사건 물건·행동을 과도하게 진지하게 감식한 수사 과정 2~4문단",
  "prosecution": "구체적 행동을 특정한 검사의 주장 1~2문단",
  "defense": "같은 구체적 사실에 대한 피고 측 변명 1~2문단",
  "opinion": "사소함과 억울함을 동시에 인정하는 재판부 판단 2~4문단",
  "orders": [
    {"number": 1, "text": "사건 맞춤형 처분"},
    {"number": 2, "text": "사건 맞춤형 재발 방지 처분"},
    {"number": 3, "text": "${profile.desiredVerdict || profile.doctrine.remedy}를 반영한 관계 회복 처분"}
  ],
  "closingComment": "사건의 핵심 물건이나 행동을 다시 언급하는 정색한 한마디",
  "legalNotice": "실제 법적 효력이 없는 오락 콘텐츠라는 안내"
}`;
}

function tailoredOrder(profile, number) {
  const fact = profile.facts[Math.min(number - 1, profile.facts.length - 1)] || profile.description;
  if (number === 1) {
    return `${profile.defendantName}은 “${cleanText(fact, 150)}”에 관하여 무엇을 잘못했는지 사건의 핵심 단어 “${profile.mainAnchor}”를 포함해 세 문장으로 사과하라.`;
  }
  if (number === 2) {
    return `${profile.defendantName}은 앞으로 “${profile.mainAnchor}” 관련 동일 상황이 발생하면 행동 전에 원고에게 확인하고, 확인 사실을 한 줄로 남겨 재발 방지 기록으로 보존하라.`;
  }
  if (profile.desiredVerdict) {
    return `${profile.defendantName}은 원고가 희망한 “${profile.desiredVerdict}”를 사건의 크기에 맞게 이행하되, 실제 이행 여부는 당사자 간 웃음과 합의로 정하라.`;
  }
  return `${profile.defendantName}은 소송 비용에 갈음하여 ${profile.doctrine.remedy}을 원고에게 제공하라.`;
}

function buildStoryFallback(profile) {
  const facts = profile.facts.map((fact, index) => `${index === 0 ? '첫째' : index === 1 ? '둘째' : index === 2 ? '셋째' : `${index + 1}번째`}, ${fact}`).join(' ');
  const secondAnchor = profile.anchors.find(anchor => anchor !== profile.mainAnchor) || profile.mainAnchor;
  return normalizeJudgment({
    headline: `${profile.title} 관련 ${profile.doctrine.doctrine} 중대 침해 사건`,
    summary: `재판부는 “${profile.mainAnchor}”를 둘러싼 이번 일이 사소해 보이지만, ${cleanText(profile.facts[0] || profile.description, 180)}라는 구체적 장면에서 원고의 억울함이 실제로 발생했다고 판단하였다. 피고에게 사건 맞춤형 소소 책임을 명한다.`,
    facts: `접수 기록에 따르면 이 사건의 핵심 사실은 다음과 같다. ${facts}\n\n재판부는 사건명 “${profile.title}”와 억울함 지수 ${profile.grievanceIndex}/10을 함께 검토하였다. 문제는 거대한 손해가 아니라, “${profile.mainAnchor}”와 관련된 바로 그 순간에 원고의 기대가 너무 자연스럽게 무시되었다는 점이다.`,
    investigation: `${profile.doctrine.evidence} 특히 “${profile.mainAnchor}”와 “${secondAnchor}”를 사건의 핵심 증거로 지정하고, ${cleanText(profile.facts[0] || profile.description, 190)} 장면을 0.1초 단위로 복원하였다.\n\n수사 결과, 이 사건을 국가적 비상대책회의에 올릴 정도는 아니지만 소소킹 판결소가 퇴근을 미루고 기록을 편철할 정도의 찝찝함은 충분히 확인되었다.`,
    prosecution: `황당검사는 “${cleanText(profile.facts[0] || profile.description, 180)}”라는 구체적 행동이 ${profile.doctrine.doctrine}을 침해했다고 주장하였다. 특히 피고가 “${profile.mainAnchor}”의 중요성을 사전에 확인하지 않은 점은 사소함을 이유로 면책될 수 없는 생활질서 위반이라고 논고하였다.`,
    defense: `피고 측 변호인은 “${cleanText(profile.facts[0] || profile.description, 170)}”에 악의가 있었던 것은 아니며, 순간적인 착오 또는 상황 판단의 엇박자였다고 항변하였다. 다만 “${profile.mainAnchor}”가 원고에게 얼마나 중요한지 확인하지 않은 사실까지 부정할 수는 없다고 덧붙였다.`,
    opinion: `${profile.judgeType} 재판부는 ${profile.judgeDirection} 기록상 ${facts}라는 사실이 인정된다. 사건의 규모는 작지만, 구체적인 “${profile.mainAnchor}” 상황을 무시한 채 ‘별일 아니다’라고 처리하면 원고의 억울함만 대형화된다.\n\n따라서 피고에게 실제 형벌이 아닌 사건 맞춤형 생활 의무를 명하는 것이 타당하다. 재판부는 이 결론을 내리기 위해 사법 역사상 보기 드물게 사소한 기록을 끝까지 읽었으며, 그로 인해 늦어진 퇴근 시간은 주문 제3항에서 참작한다.`,
    orders: [
      { number: 1, text: tailoredOrder(profile, 1) },
      { number: 2, text: tailoredOrder(profile, 2) },
      { number: 3, text: tailoredOrder(profile, 3) },
    ],
    closingComment: `“${profile.mainAnchor}”는 작았지만, 그 순간의 억울함까지 소형으로 분류할 수는 없다.`,
    legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠이며 법률 상담이나 분쟁 해결을 대신하지 않습니다.',
  });
}

function sectionContainsAnchor(text, anchors) {
  const source = String(text || '').toLowerCase();
  return anchors.some(anchor => source.includes(String(anchor).toLowerCase()));
}

function evaluateStorySpecificity(judgment, profile) {
  const anchors = profile.anchors.filter(anchor => anchor.length >= 2);
  const sections = [
    judgment.summary,
    judgment.facts,
    judgment.investigation,
    judgment.prosecution,
    judgment.defense,
    judgment.opinion,
    judgment.closingComment,
  ];
  const sectionHits = sections.filter(section => sectionContainsAnchor(section, anchors)).length;
  const primarySectionHits = sections.filter(section => sectionContainsAnchor(section, [profile.mainAnchor])).length;
  const allTexts = sections.concat(judgment.orders.map(order => order.text));
  const mentionedAnchors = anchors.filter(anchor => allTexts.some(section => String(section || '').includes(anchor)));
  const tailoredOrders = judgment.orders.filter(order => sectionContainsAnchor(order.text, anchors)).length;
  const primaryOrderHits = judgment.orders.filter(order => sectionContainsAnchor(order.text, [profile.mainAnchor])).length;
  const seriousHumorHits = SERIOUS_HUMOR_MARKERS.filter(marker => `${judgment.investigation} ${judgment.opinion} ${judgment.closingComment}`.includes(marker)).length;
  const requiredAnchorCount = anchors.length >= 2 ? 2 : 1;
  return {
    sectionHits,
    primarySectionHits,
    mentionedAnchorCount: mentionedAnchors.length,
    tailoredOrders,
    primaryOrderHits,
    seriousHumorHits,
    passed: sectionHits >= 5
      && primarySectionHits >= 4
      && mentionedAnchors.length >= requiredAnchorCount
      && tailoredOrders >= 2
      && primaryOrderHits >= 2
      && seriousHumorHits >= 1,
  };
}

function buildRewriteInstruction(profile, evaluation) {
  return `\n\n[재작성 명령]\n이전 응답은 사건 고유성 검사에서 탈락했다. 사건 핵심 단어(${profile.anchors.join(', ')})가 충분히 반복되지 않았거나 사건 맞춤형 주문과 정색한 과몰입 개그가 부족했다. 대표 사건 물건 “${profile.mainAnchor}”를 본문 최소 4곳과 주문 최소 2곳에 직접 적고, 모든 본문 항목을 실제 사건 사실에 다시 연결하라. 수사 과정에는 0.1초 복원·증거물 지정·비상대책회의·퇴근 지연 중 사건에 맞는 과잉 표현을 반드시 넣어라. 현재 검사값: sections=${evaluation.sectionHits}, primarySections=${evaluation.primarySectionHits || 0}, anchors=${evaluation.mentionedAnchorCount}, orders=${evaluation.tailoredOrders}, primaryOrders=${evaluation.primaryOrderHits || 0}, humor=${evaluation.seriousHumorHits}. JSON 객체만 다시 출력하라.`;
}

module.exports = {
  buildCaseProfile,
  buildStoryPrompt,
  buildStoryFallback,
  evaluateStorySpecificity,
  buildRewriteInstruction,
};
