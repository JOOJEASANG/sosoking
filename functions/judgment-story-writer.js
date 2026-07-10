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

const SUBJECT_PATTERNS = [
  '리트리버', '강아지', '고양이', '반려견', '네비게이션', '내비게이션', '내비', '네비',
  '남편', '아내', '남친', '여친', '친구', '동생', '형', '누나', '언니', '오빠', '상사', '동료',
];

const OBJECT_PRIORITY = [
  '네비게이션', '내비게이션', '내비', '네비', '목적지', '리모컨', '만두', '빵', '치킨', '라면',
  '커피', '과자', '아이스크림', '푸딩', '휴대폰', '카톡', '문자', '전화', '약속', '시간',
];

function includesAny(source, values) {
  return values.find(value => String(source || '').includes(value)) || '';
}

function selectMainAnchor(anchors, description, categoryId) {
  const source = `${anchors.join(' ')} ${description}`;
  const priority = categoryId === 'late'
    ? ['네비게이션', '내비게이션', '내비', '네비', '목적지', '약속', '시간', ...OBJECT_PRIORITY]
    : OBJECT_PRIORITY;
  const preferred = includesAny(source, priority);
  if (preferred) return preferred;
  return anchors.find(anchor => !MAIN_ANCHOR_SKIP.has(anchor) && isConcreteSecondaryAnchor(anchor))
    || anchors.find(anchor => !MAIN_ANCHOR_SKIP.has(anchor))
    || anchors[0]
    || '사건 핵심';
}

function detectSubjectCue(description, defendantName, anchors) {
  const named = cleanText(defendantName, 40);
  if (named && named !== '피고 측') return named;
  const matched = includesAny(description, SUBJECT_PATTERNS);
  if (matched) return matched;
  return anchors.find(anchor => SUBJECT_PATTERNS.includes(anchor)) || '피고 측';
}

function detectActionCue(description) {
  const source = String(description || '');
  if (/(먹어버|먹었|먹었다|먹음|삼켰|훔쳐\s*먹)/.test(source)) return '남의 음식을 허락 없이 먹어 없앴다';
  if (/(다른 장소|잘못된 장소|엉뚱한 곳|오안내|목적지.*틀|길.*잘못)/.test(source)) return '목적지를 잘못 안내했다';
  if (/(숨겼|숨겨|은닉|소파 틈)/.test(source)) return '물건을 숨기거나 위치를 알리지 않았다';
  if (/(늦었|지각|기다리)/.test(source)) return '약속시간을 지키지 않아 상대를 기다리게 했다';
  if (/(읽씹|답장.*없|연락.*없)/.test(source)) return '연락을 확인하고도 응답하지 않았다';
  if (/(마지막|한 개 남|먼저.*먹)/.test(source)) return '마지막 몫을 확인 없이 먼저 가져갔다';
  return '상대가 예상하지 못한 행동으로 일상의 계획을 어긋나게 했다';
}

function detectConsequenceCue(description, categoryId) {
  const source = String(description || '');
  if (/(약속.*펑크|약속.*취소|못\s*만|만나지 못)/.test(source)) return '약속이 무산됐다';
  if (/(빵|만두|치킨|라면|간식|음식).*(없|먹)/.test(source)) return '먹으려던 음식과 기대가 함께 사라졌다';
  if (/(20분|30분|시간.*낭비|기다)/.test(source)) return '시간을 잃고 기분까지 상했다';
  if (categoryId === 'late') return '시간과 약속 신뢰를 잃었다';
  if (categoryId === 'food') return '먹을 몫과 평온한 식사 흐름을 잃었다';
  return '시간·기분·편의 중 하나 이상이 실제로 손상됐다';
}

function resolveComedyKit(profileLike) {
  const source = `${profileLike.title} ${profileLike.description}`;
  if (/(리트리버|강아지|반려견|개가|개는|개 한|고양이)/.test(source) && /(빵|간식|음식|먹)/.test(source)) {
    return {
      id: 'animal-food',
      frame: '현장 압수 뒤 소화기관으로 증거물을 이송한 초고속 식품 사건',
      wordplay: `공원이라고 모든 ${profileLike.mainAnchor}이 공공${profileLike.mainAnchor}이 되는 것은 아니다.`,
      dryLine: '증거인멸은 완벽했다. 증거가 이미 소화 중이었다.',
      defenseAngle: '악의보다 냄새와 식욕이 먼저 작동했다는 주장',
      remedy: '동일한 빵과 추가 보상빵을 보호자가 제공하되 피고견에게 재배분하지 않는 조치',
    };
  }
  if (/(네비게이션|내비게이션|내비|네비)/.test(source) && /(목적지|장소|약속|도착)/.test(source)) {
    return {
      id: 'navigation',
      frame: '길 안내는 성공했지만 목적 달성은 실패한 좌표 신뢰 붕괴 사건',
      wordplay: `${profileLike.mainAnchor}은 길을 찾았다. 약속을 잃어버렸다.`,
      dryLine: '도착은 성공했다. 목적은 실패했다.',
      defenseAngle: '입력 주소와 동명 장소를 사용자가 최종 확인했어야 한다는 주장',
      remedy: '상호명과 주소를 다시 확인하고 잘못된 장소에서는 임무 완료를 선언하지 않는 조치',
    };
  }
  if (profileLike.categoryId === 'food') {
    return {
      id: 'food',
      frame: '한입의 행방을 두고 식탁 전체가 증거보전 구역이 된 사건',
      wordplay: `${profileLike.mainAnchor} 한입은 짧았다. 한은 길었다.`,
      dryLine: '배는 불렀다. 원고 속은 더 불탔다.',
      defenseAngle: '마지막 몫의 소유자가 명확하지 않았다는 주장',
      remedy: '동일 품목 또는 상위 대체품과 다음 선택권을 지급하는 조치',
    };
  }
  if (profileLike.categoryId === 'late') {
    return {
      id: 'late',
      frame: '시계는 정상인데 약속만 비정상 종료된 시간 신뢰 사건',
      wordplay: `${profileLike.mainAnchor} 시간은 갔다. 사람은 오지 않았다.`,
      dryLine: '늦은 것은 몇 분이었다. 서운함은 정시에 도착했다.',
      defenseAngle: '예상하지 못한 변수와 연락 과정의 착오가 있었다는 주장',
      remedy: '다음 약속의 출발 인증과 잃은 시간만큼의 보상 시간을 제공하는 조치',
    };
  }
  if (profileLike.categoryId === 'digital') {
    return {
      id: 'digital',
      frame: '기기는 정상 작동했지만 인간의 응답만 서버에서 실종된 사건',
      wordplay: `${profileLike.mainAnchor}에는 읽음이 있었다. 읽은 사람은 없었다.`,
      dryLine: '통신망은 살아 있었다. 대화는 사망했다.',
      defenseAngle: '알림 누락이나 즉시 답하기 어려운 상황이었다는 주장',
      remedy: '다음 연락에 명확히 답하거나 응답 지연을 미리 알리는 조치',
    };
  }
  return {
    id: 'general',
    frame: '사소한 행동 하나가 하루 전체의 계획을 비상대책회의로 바꾼 사건',
    wordplay: '일은 작았다. 보고서는 커졌다.',
    dryLine: '사건은 끝났다. 찝찝함은 퇴근하지 않았다.',
    defenseAngle: '계획적인 방해가 아니라 순간적인 착오였다는 주장',
    remedy: '사건의 핵심 행동을 바로잡고 다음에는 먼저 확인하는 조치',
  };
}

function buildCaseProfile({ title, description, desiredVerdict, grievanceIndex, headline, defendantName, judgeType, category }) {
  const safeTitle = cleanText(title, 90) || '소소한 황당사건';
  const safeDescription = cleanParagraph(description, 1800) || safeTitle;
  const facts = splitFacts(safeDescription);
  const anchors = extractAnchors(safeTitle, safeDescription);
  const requestedCategoryId = category?.id || 'other';
  const categoryId = resolveStoryCategory(requestedCategoryId, anchors, safeDescription);
  const mainAnchor = selectMainAnchor(anchors, safeDescription, categoryId);
  const subjectCue = detectSubjectCue(safeDescription, defendantName, anchors);
  const actionCue = detectActionCue(safeDescription);
  const consequenceCue = detectConsequenceCue(safeDescription, categoryId);
  const profile = {
    title: safeTitle,
    description: safeDescription,
    desiredVerdict: cleanText(desiredVerdict, 240),
    grievanceIndex: Math.max(1, Math.min(10, Number(grievanceIndex || 5))),
    headline: cleanText(headline, 180) || safeTitle,
    defendantName: cleanText(defendantName, 40) || subjectCue || '피고 측',
    judgeType: cleanText(judgeType, 40) || 'AI',
    judgeDirection: JUDGE_DIRECTIONS[judgeType] || JUDGE_DIRECTIONS['드립형'],
    categoryId,
    categoryLabel: CATEGORY_LABELS[categoryId],
    doctrine: CATEGORY_DOCTRINES[categoryId],
    facts,
    anchors: anchors.length ? anchors : [safeTitle],
    mainAnchor,
    subjectCue,
    actionCue,
    consequenceCue,
    incidentLevel: incidentLevel(grievanceIndex, categoryId),
  };
  profile.comedyKit = resolveComedyKit(profile);
  profile.concreteAnchors = [...new Set([subjectCue, mainAnchor, ...anchors.filter(isConcreteSecondaryAnchor)])].filter(Boolean).slice(0, 8);
  return profile;
}

function factList(profile) {
  return profile.facts.map((fact, index) => `${index + 1}. ${fact}`).join('\n');
}

function interpretationCues(profile) {
  return profile.concreteAnchors
    .filter(anchor => anchor.toLowerCase() !== profile.mainAnchor.toLowerCase())
    .filter(isConcreteSecondaryAnchor)
    .slice(0, 4);
}

function buildStoryPrompt(profile) {
  const cues = interpretationCues(profile).join(', ') || '추가 단서 없음';
  return `너는 소소킹 황당재판소의 수석 코미디 판사다.
목표는 긴 판결문을 만드는 것이 아니라, 사용자가 첫 두 문장만 읽어도 무슨 사건인지 알 수 있고 최소 두 번은 피식하게 만드는 것이다.

[사건 핵심]
- 사건명: ${profile.title}
- 행위 주체: ${profile.subjectCue}
- 핵심 대상: ${profile.mainAnchor}
- 실제 행동: ${profile.actionCue}
- 실제 결과: ${profile.consequenceCue}
- 피고 호칭: ${profile.defendantName}
- 사건 분류: ${profile.categoryLabel}
- 판사 성향: ${profile.judgeType} · ${profile.judgeDirection}
- 억울함 지수: ${profile.grievanceIndex}/10
- 희망 처분: ${profile.desiredVerdict || '별도 희망 없음'}
- 보조 단서: ${cues}
- 추천 코미디 프레임: ${profile.comedyKit.frame}
- 말장난 방향 예시: ${profile.comedyKit.wordplay}
- 건조한 반전 방향 예시: ${profile.comedyKit.dryLine}
- 피고측 변명 방향: ${profile.comedyKit.defenseAngle}

[원문 사실 자료]
${factList(profile)}

반드시 지킬 규칙:
1. breakingNews 첫 문장에 누가, 무엇을, 어떻게 했고, 그 결과 무엇이 망가졌는지 구체적으로 적는다.
2. 첫 두 문장 안에 “${profile.subjectCue}”, “${profile.mainAnchor}”, 실제 결과가 모두 드러나야 한다.
3. 사건이 보이기 전에는 기대질서·생활체계·상호배려 같은 추상어를 쓰지 않는다.
4. 원문을 길게 되풀이하지 말고 사실은 한 번만 말한다. 같은 사건 설명을 다른 항목에서 반복하지 않는다.
5. comedyLines는 반드시 2~3개 작성한다. 첫 줄은 사건 소재를 이용한 말장난·아재개그, 둘째 줄은 짧고 건조한 반전이어야 한다.
6. 말장난은 사건 명사 자체를 비틀어야 한다. 아무 사건에나 붙일 수 있는 유행어와 밈은 금지한다.
7. 피고 주장은 황당하지만 논리적인 변명 한 가지를 세우고, 원고 주장과 같은 말을 반복하지 않는다.
8. 주문 3개는 사과, 실제 보상, 재발방지로 나누고 사건 물건이나 행동을 직접 활용한다.
9. 전체 문장은 짧고 구체적으로 쓴다. 각 본문은 1~2문단이면 충분하다.
10. 원문에서 4개 단어 이상 연속된 표현을 복사하지 않는다.
11. 추천 예시는 방향만 참고하고 그대로 복사하지 않는다. 사건에 맞는 새로운 표현을 만든다.
12. 웃음은 최소 세 번 배치한다: 제목 또는 속보 1회, 감식·변론 1회, 마지막 한마디 1회.

아래 JSON 객체 하나만 출력한다.
{
  "headline": "행위 주체와 핵심 대상을 포함한 짧고 웃긴 공식 사건명",
  "incidentLevel": "${profile.incidentLevel}",
  "breakingNews": "첫 문장에 사건 전체가 보이는 속보 + 짧은 반전 한 문장",
  "emergencyBriefing": "결정적 순간과 수습 실패를 구체적으로 재구성한 1~2문단",
  "impactAssessment": "이 논리가 계속될 경우 벌어질 사건 맞춤형 연쇄 위험 1문단",
  "comedyLines": ["사건 소재 말장난 또는 아재개그", "짧고 건조한 반전"],
  "summary": "무슨 사건인지와 누구 책임인지 바로 알 수 있는 2문장",
  "facts": "행위 주체·대상·행동·결과를 한 번만 명확히 정리한 1~2문단",
  "investigation": "현장 단서와 우스운 증거 해석을 담은 1~2문단",
  "plaintiffClaim": "실제 잃은 것과 억울함을 구체적으로 말하는 1~2문장",
  "defendantClaim": "악의·계획성·책임 범위를 다투는 황당하지만 독립적인 변명 1~2문장",
  "prosecution": "피고 행동을 사건 물건에 빗대어 기소하는 1문단",
  "defense": "정상참작 사유와 피고측 논리를 제시하는 1문단",
  "opinion": "책임 판단과 그 이유를 구체적으로 밝히는 2문단",
  "orders": [
    {"number": 1, "text": "사건 맞춤형 사과 명령"},
    {"number": 2, "text": "실제 손해를 회복하는 보상 명령"},
    {"number": 3, "text": "웃기지만 실행 가능한 재발방지 명령"}
  ],
  "closingComment": "사건 소재를 다시 비트는 짧은 마지막 한마디",
  "legalNotice": "실제 법적 효력이 없는 오락 콘텐츠라는 안내"
}`;
}

function tailoredOrder(profile, number) {
  if (number === 1) return `${profile.defendantName}은 “${profile.mainAnchor}” 사건에서 자신이 한 행동과 실제 결과를 정확히 적은 3문장 사과문을 제출하라.`;
  if (number === 2) return `${profile.defendantName}은 ${profile.comedyKit.remedy}을 이행해 원고의 실제 손해를 회복하라.`;
  if (profile.desiredVerdict) return `${profile.defendantName}은 원고가 요청한 처분의 취지를 반영하되, 다음 같은 상황에서는 행동 전에 대상과 목적을 한 번 더 확인하라.`;
  return `${profile.defendantName}은 같은 상황이 반복되지 않도록 “확인 먼저, 행동 나중” 절차를 지키고 원고에게 우선 결정권을 부여하라.`;
}

function buildStoryFallback(profile) {
  const kit = profile.comedyKit;
  const subject = profile.subjectCue || profile.defendantName;
  const action = profile.actionCue;
  const consequence = profile.consequenceCue;
  return normalizeJudgment({
    headline: `${subject}의 ${profile.mainAnchor} 관련 초고속 생활사고 사건`,
    incidentLevel: profile.incidentLevel,
    breakingNews: `[긴급속보] ${subject}이(가) ${profile.mainAnchor}을(를) 둘러싼 상황에서 ${action} 그 결과 ${consequence} 소소킹 상황실은 사건 접수 즉시 원인을 분석했다. ${kit.dryLine}`,
    emergencyBriefing: `사건은 ${profile.mainAnchor}을(를) 두고 원고가 정상적인 흐름을 기대하던 순간 발생했다. ${subject}은(는) 확인이나 협상보다 행동을 먼저 선택했고, 원고가 상황을 알아차렸을 때는 이미 되돌리기 어려운 결과가 생긴 뒤였다.\n\n현장 감식반은 ${profile.concreteAnchors.slice(0, 3).join(', ')}을(를) 핵심 단서로 지정했다. 분석 장비는 거창했다. 쟁점은 “왜 먼저 확인하지 않았는가” 한 줄이었다.`,
    impactAssessment: `같은 논리가 허용되면 앞으로 ${profile.mainAnchor}과(와) 비슷한 모든 상황에서 먼저 행동한 쪽이 임시 규칙을 만들게 된다. ${kit.wordplay} 대책은 컸고, 발단은 매우 작았다.`,
    comedyLines: [kit.wordplay, kit.dryLine],
    summary: `${subject}의 행동으로 ${profile.mainAnchor}과(와) 관련된 계획이 틀어졌고, ${consequence} 재판부는 고의성보다 확인 가능성과 사후 수습 책임을 기준으로 피고 측 책임을 인정한다.`,
    facts: `기록상 ${subject}은(는) ${profile.mainAnchor}을(를) 둘러싼 상황에서 ${action} 원고는 이를 예상하거나 동의하지 않았으며, 그 결과 ${consequence}\n\n쟁점은 결과가 사소해 보이는지가 아니라 행동 전에 상대의 몫·목적·시간을 확인할 수 있었는지다.`,
    investigation: `감식반은 ${profile.mainAnchor}의 위치와 행동 순서, 원고가 상황을 알아차린 시점, 사건 후 설명과 회복 조치를 조사했다. ${profile.doctrine.evidence}\n\n행동은 짧았지만 결과는 분명했다. ${kit.dryLine}`,
    plaintiffClaim: `원고 측은 ${profile.mainAnchor} 자체만이 아니라 그 일로 ${consequence}는 점이 실제 피해라고 주장한다. 한 번의 확인이면 피할 수 있었다는 입장이다.`,
    defendantClaim: `피고 측은 계획적인 방해가 아니며 ${kit.defenseAngle}을(를) 정상참작해야 한다고 반박한다. 결과는 인정하지만 모든 책임을 악의로 해석해서는 안 된다는 주장이다.`,
    prosecution: `황당검사는 ${subject}이(가) 확인 절차를 생략한 채 ${action}고 지적했다. 특히 ${profile.mainAnchor}의 성격과 상대의 목적을 알 수 있었는데도 행동을 먼저 한 것은 생활 속 신뢰를 직접 흔든 행위라고 보았다.`,
    defense: `변호인은 사건이 계획된 공격이 아니라 순간적인 판단 착오라고 항변했다. 또한 ${kit.defenseAngle}을(를) 고려해 처분은 응징보다 실제 회복과 다음 행동 규칙에 집중해야 한다고 요청했다.`,
    opinion: `${profile.judgeType} 재판부는 원고가 입은 실제 결과와 피고가 행동 전에 확인할 수 있었는지를 기준으로 판단했다. 악의가 크지 않더라도 확인할 기회가 있었고, 그 기회를 쓰지 않았다면 책임은 남는다.\n\n따라서 피고 측 책임을 인정하되 처분은 사건의 물건과 행동을 이용한 원상회복으로 정한다. ${kit.wordplay}`,
    orders: [
      { number: 1, text: tailoredOrder(profile, 1) },
      { number: 2, text: tailoredOrder(profile, 2) },
      { number: 3, text: tailoredOrder(profile, 3) },
    ],
    closingComment: kit.dryLine,
    legalNotice: '본 판결은 실제 법적 효력이 없는 오락 콘텐츠이며 법률 상담이나 분쟁 해결을 대신하지 않습니다.',
  });
}

module.exports = { buildCaseProfile, buildStoryPrompt, buildStoryFallback };
