const TARGETS = [
  '네비게이션', '내비게이션', '네비', '내비', '리모컨', '빵', '만두', '치킨', '라면',
  '커피', '과자', '아이스크림', '푸딩', '케이크', '휴대폰', '전화', '문자', '카톡',
  '택배', '우산', '충전기', '이어폰', '냉장고', '세탁기', '약속', '시간',
];

const ACTORS = [
  '리트리버', '강아지', '반려견', '고양이', '남편', '아내', '남친', '여친', '친구',
  '동생', '형', '누나', '언니', '오빠', '상사', '동료', '차량 네비게이션', '네비게이션',
  '내비게이션', '택배기사', '배달기사',
];

function cleanText(value, maxLength = 240) {
  return String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanParagraph(value, maxLength = 1800) {
  return String(value ?? '')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function words(value) {
  return String(value || '').toLowerCase().match(/[가-힣a-z0-9]+/g) || [];
}

function includesAny(source, values) {
  return values.find(value => String(source || '').includes(value)) || '';
}

function normalizeTarget(value) {
  return ['네비', '내비', '내비게이션'].includes(value) ? '네비게이션' : value;
}

function detectActor(caseData, source) {
  const named = cleanText(caseData.defendantName, 40);
  if (named && named !== '피고 미지정') return named;
  return includesAny(source, ACTORS) || '피고 측';
}

function detectTarget(caseData, source) {
  const matched = includesAny(source, TARGETS);
  if (matched) return normalizeTarget(matched);
  const candidates = words(caseData.title).filter(token => token.length >= 2 && !['사건', '무단', '관련', '문제', '분쟁'].includes(token));
  return cleanText(candidates[0] || '사건 핵심 대상', 30);
}

function detectAction(source, actor, target) {
  if (/(리트리버|강아지|반려견|고양이)/.test(source) && /(먹어버|먹었|먹었다|먹음|삼켰|훔쳐\s*먹)/.test(source)) {
    return `${actor}이(가) 원고가 한눈판 사이 ${target}을(를) 허락 없이 먹어 없앴다`;
  }
  if (/(네비게이션|내비게이션|네비|내비)/.test(source) && /(다른 장소|잘못된 장소|엉뚱한 곳|오안내|목적지.*틀|길.*잘못)/.test(source)) {
    return `${actor}이(가) 설정된 약속장소 대신 다른 장소로 안내했다`;
  }
  if (/(숨겼|숨겨|은닉|소파 틈|감췄)/.test(source)) return `${actor}이(가) ${target}을(를) 숨기거나 위치를 알리지 않았다`;
  if (/(늦었|지각|기다리|곧 도착)/.test(source)) return `${actor}이(가) 약속시간을 지키지 않아 상대를 기다리게 했다`;
  if (/(읽씹|답장.*없|연락.*없|응답.*없)/.test(source)) return `${actor}이(가) 연락을 확인하고도 응답하지 않았다`;
  if (/(마지막|한 개 남|먼저.*먹|선점)/.test(source)) return `${actor}이(가) ${target}의 마지막 몫을 확인 없이 먼저 가져갔다`;
  if (/(고장|망가|깨뜨|부쉈)/.test(source)) return `${actor}이(가) ${target}을(를) 망가뜨리거나 정상 사용을 방해했다`;
  return `${actor}이(가) ${target}과(와) 관련해 상대의 계획을 예상 밖으로 어긋나게 했다`;
}

function detectConsequence(source, category, target) {
  if (/(약속.*펑크|약속.*취소|못\s*만|만나지 못|무산)/.test(source)) return '약속이 무산되고 이동 시간까지 잃었다';
  if (/(빵|만두|치킨|라면|간식|음식|커피|과자).*(없|먹|사라)/.test(source)) return '먹으려던 음식과 기대가 함께 사라졌다';
  if (/(20분|30분|시간.*낭비|기다)/.test(source)) return '시간을 잃고 기분까지 상했다';
  if (/(답장|연락|읽씹)/.test(source)) return '연락을 기다리는 시간과 관계의 평온을 잃었다';
  if (category === 'late') return '시간과 약속에 대한 신뢰를 잃었다';
  if (category === 'food') return `${target}에 대한 몫과 평온한 식사 흐름을 잃었다`;
  if (category === 'digital') return '기기나 연락을 정상적으로 이용할 기회를 잃었다';
  return '시간·기분·편의 중 하나 이상이 실제로 손상됐다';
}

function detectDefendantType(actor, source) {
  if (/(리트리버|강아지|반려견|고양이)/.test(`${actor} ${source}`)) return 'animal';
  if (/(네비게이션|내비게이션|네비|내비|앱|기기|리모컨)/.test(`${actor} ${source}`)) return 'device';
  if (/(회사|학교|가게|업체|서비스)/.test(`${actor} ${source}`)) return 'organization';
  return 'person';
}

function incidentLevel(value) {
  const score = Math.max(1, Math.min(10, Number(value || 5)));
  if (score >= 9) return '소소위기 1단계 · 즉시 판결 필요';
  if (score >= 7) return '소소위기 2단계 · 재판부 긴급 소집';
  if (score >= 4) return '소소위기 3단계 · 정식 심리 개시';
  return '소소위기 4단계 · 조용한 사실 확인';
}

function comedyKit({ source, category, target }) {
  if (/(리트리버|강아지|반려견|고양이)/.test(source) && /(빵|간식|음식|먹)/.test(source)) {
    return {
      id: 'animal-food',
      frame: '증거물을 소화기관으로 이송한 초고속 식품 사건',
      wordplay: `공원이라고 모든 ${target}이 공공${target}이 되는 것은 아니다.`,
      dry: '증거인멸은 완벽했다. 증거가 이미 소화 중이었다.',
      defense: '악의보다 냄새와 식욕이 먼저 작동했다는 주장',
      remedy: `보호자가 동일한 ${target}과 추가 보상 간식을 제공하되 피고 동물에게 재배분하지 않는 조치`,
    };
  }
  if (/(네비게이션|내비게이션|네비|내비)/.test(source) && /(목적지|장소|약속|도착)/.test(source)) {
    return {
      id: 'navigation',
      frame: '길 안내는 성공했지만 목적 달성은 실패한 좌표 사건',
      wordplay: `${target}은 길을 찾았다. 약속을 잃어버렸다.`,
      dry: '도착은 성공했다. 목적은 실패했다.',
      defense: '입력 주소와 동명 장소를 사용자가 최종 확인했어야 한다는 주장',
      remedy: '상호명과 주소를 다시 확인하고 잘못된 장소에서는 임무 완료를 선언하지 않는 조치',
    };
  }
  if (/(리모컨|충전기|이어폰|우산)/.test(target) && /(숨겼|은닉|소파 틈|찾았|실종)/.test(source)) {
    return {
      id: 'hidden-object',
      frame: '물건은 가까이 있었지만 평정심은 장거리 수색에 들어간 사건',
      wordplay: `${target}은 숨었다. 찾는 사람의 인내심도 같이 실종됐다.`,
      dry: '물건은 소파 안에 있었다. 평화는 그 밖에도 없었다.',
      defense: '숨긴 것이 아니라 마지막 위치를 기억하지 못했을 뿐이라는 주장',
      remedy: `${target} 전용 보관 위치를 정하고 이동 즉시 위치를 알리는 조치`,
    };
  }
  if (category === 'food') {
    return {
      id: 'food',
      frame: '한입의 행방을 두고 식탁 전체가 증거보전 구역이 된 사건',
      wordplay: `${target} 한입은 짧았다. 한은 길었다.`,
      dry: '배는 불렀다. 원고 속은 더 불탔다.',
      defense: '마지막 몫의 소유자가 명확하지 않았다는 주장',
      remedy: `동일한 ${target} 또는 상위 대체품과 다음 선택권을 지급하는 조치`,
    };
  }
  if (category === 'late') {
    return {
      id: 'late',
      frame: '시계는 정상인데 약속만 비정상 종료된 시간 사건',
      wordplay: '시간은 갔다. 약속 상대는 오지 않았다.',
      dry: '늦은 것은 몇 분이었다. 서운함은 정시에 도착했다.',
      defense: '예상하지 못한 변수와 연락 과정의 착오가 있었다는 주장',
      remedy: '다음 약속의 출발 인증과 잃은 시간만큼의 보상 시간을 제공하는 조치',
    };
  }
  if (category === 'digital') {
    return {
      id: 'digital',
      frame: '기기는 정상 작동했지만 인간의 응답만 실종된 사건',
      wordplay: `${target}에는 신호가 있었다. 책임 신호는 잡히지 않았다.`,
      dry: '통신망은 살아 있었다. 대화는 사망했다.',
      defense: '알림 누락이나 즉시 답하기 어려운 상황이었다는 주장',
      remedy: '다음 연락에 명확히 답하거나 응답 지연을 미리 알리는 조치',
    };
  }
  return {
    id: 'general',
    frame: '사소한 행동 하나가 하루 전체의 계획을 비상회의로 바꾼 사건',
    wordplay: `${target} 문제는 작았다. 보고서는 크게 자랐다.`,
    dry: '사건은 끝났다. 찝찝함은 퇴근하지 않았다.',
    defense: '계획적인 방해가 아니라 순간적인 착오였다는 주장',
    remedy: `${target}과(와) 관련된 행동을 바로잡고 다음에는 먼저 확인하는 조치`,
  };
}

function buildCaseAnalysis(caseData = {}) {
  const title = cleanText(caseData.title, 90) || '소소한 황당사건';
  const description = cleanParagraph(caseData.caseDescription || caseData.description, 1500) || title;
  const source = `${title} ${description} ${caseData.defendantName || ''}`;
  const actor = detectActor(caseData, source);
  const target = detectTarget(caseData, source);
  const category = cleanText(caseData.category, 20) || 'other';
  const kit = comedyKit({ source, category, target });
  const evidenceAnchors = [...new Set([actor, target, ...TARGETS.filter(item => source.includes(item)).map(normalizeTarget)])].slice(0, 6);

  return {
    actor,
    target,
    action: detectAction(source, actor, target),
    consequence: detectConsequence(source, category, target),
    grievance: cleanParagraph(caseData.desiredVerdict, 240) || '사과와 실제 회복조치가 필요하다',
    defendantType: detectDefendantType(actor, source),
    category,
    incidentLevel: incidentLevel(caseData.grievanceIndex),
    evidenceAnchors,
    comedyFrame: kit.frame,
    wordplaySeed: kit.wordplay,
    drySeed: kit.dry,
    defenseAngle: kit.defense,
    remedy: kit.remedy,
    comedyKitId: kit.id,
  };
}

module.exports = { cleanText, cleanParagraph, words, buildCaseAnalysis };
