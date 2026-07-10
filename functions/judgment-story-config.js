const { cleanParagraph } = require('./judgment-v2');

const STOPWORDS = new Set([
  '사건', '내용', '원고', '피고', '재판부', '판결', '관련', '상대방', '사람', '부분', '정도',
  '그냥', '정말', '너무', '제가', '나는', '내가', '저는', '저희', '우리', '그리고', '그런데',
  '그래서', '때문에', '했습니다', '했는데', '합니다', '하였다', '있습니다', '있었다', '없었다',
  '같습니다', '이라고', '라고', '하는', '하게', '되어', '되는', '이런', '그런', '있는', '없는',
]);

const PARTICLES = [
  '으로부터', '에게서', '한테서', '이라도', '라도', '에서', '에게', '한테', '께서', '처럼',
  '보다', '까지', '부터', '으로', '밖에', '마저', '조차', '이나', '은', '는', '이', '가',
  '을', '를', '에', '로', '와', '과', '도', '만', '의',
];

const MAIN_ANCHOR_SKIP = new Set([
  '마지막', '최후', '먼저', '관련', '선점', '은닉', '실종', '무단', '침해', '중대', '반복',
  '장기', '공용', '공동', '앞으로', '다음', '순간', '사라짐', '분실', '방치',
]);

const SECONDARY_ANCHOR_SKIP = new Set([
  ...MAIN_ANCHOR_SKIP,
  '동안', '사이', '이후', '직후', '저녁', '아침', '오늘', '내일', '당시', '나중',
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
  '감성형': '원고가 느낀 서운함의 잔향을 현장감 있게 묘사하고, 감정의 파급을 재난 브리핑처럼 확대한다.',
  '현실주의형': '냉정한 결론을 내리되 생활 속 작은 손해를 국가 예산 심사처럼 치밀하게 계산한다.',
  '과몰입형': '사소한 장면을 국가적 비상사태와 대하 법정극으로 끝까지 밀어붙이고 중간에 물러서지 않는다.',
  '피곤형': '재판부가 이 사건 때문에 야간 비상근무에 들어간 듯한 건조한 분노와 체념을 섞는다.',
  '논리집착형': '시간, 횟수, 거리, 남은 수량을 가능한 범위에서 계산하고 소수점 단위의 과잉 논리로 웃음을 만든다.',
  '드립형': '인터넷 밈 대신 뉴스 특보와 판결문 속 정색한 비유, 짧은 반전 문장을 사용한다.',
};

const CATEGORY_DOCTRINES = {
  food: {
    doctrine: '최후 한입 기대권 및 냉장고 평온권',
    evidence: '소소감식반은 남은 수량, 포장지의 위치, 젓가락 진입 방향과 마지막 한입을 기다린 시간을 증거물 제1호로 지정한다.',
    remedy: '동일 품목 또는 원고가 납득할 수 있는 상위 대체품의 우선 선택권',
    risk: '식탁의 최후 한입 배분체계가 무너지고, 향후 반찬·디저트·야식의 소유권까지 연쇄 분쟁으로 번질 위험',
    response: '식탁 주변을 임시 통제구역으로 설정하고 남은 수량과 당사자의 손 이동 경로를 재구성',
    undercut: '결국 문제의 중심에는 거대한 국익이 아니라 한 입이 남아 있었다',
  },
  late: {
    doctrine: '약속시각 신뢰보호원칙 및 대기시간 회복권',
    evidence: '시간감식관은 약속 시각, 실제 행동, 연락 공백과 기다림의 체감 길이를 분 단위로 복원한다.',
    remedy: '다음 약속의 출발 인증 및 지각 시간만큼 원고가 정하는 보상 시간',
    risk: '“곧 도착”이라는 문장이 사회적 신뢰를 잃고 모든 약속 시간이 참고사항으로 전락할 위험',
    response: '시간상황실을 개방하고 약속 시각과 실제 출발 시각 사이의 공백을 긴급 분석',
    undercut: '상황실이 확인한 최종 피해는 대기 중 식어버린 기분이었다',
  },
  love: {
    doctrine: '정서응답 적시성 원칙 및 관계평온권',
    evidence: '감정감식반은 사건 전후의 말투, 침묵의 길이, 표정 변화와 서운함이 폭발한 결정적 순간을 기록한다.',
    remedy: '사건의 핵심 행동을 정확히 언급한 사과와 원고가 선택하는 관계 회복 행동',
    risk: '대화 채널이 단계적으로 폐쇄되고, 이모티콘 외교마저 중단되는 관계 냉각 사태로 번질 위험',
    response: '관계위기대응반을 소집해 말투 변화와 침묵 구간을 프레임 단위로 검토',
    undercut: '국가 간 외교 단절처럼 보였으나 실제 쟁점은 한마디를 제때 하지 않은 일이었다',
  },
  work: {
    doctrine: '업무평온권 및 회의실 생존권',
    evidence: '업무질서수사대는 사건으로 낭비된 시간, 책임 이동 경로와 주변인의 무언의 한숨을 참고자료로 편철한다.',
    remedy: '다음 동일 상황에서 피고가 먼저 처리하고 결과를 공개 보고할 의무',
    risk: '업무 책임이 공중분해되고 단체 한숨이 누적되어 조직 전체의 퇴근 시간이 밀릴 위험',
    response: '업무재난대책본부를 가동하고 사건 전후의 업무 흐름과 책임 회피 경로를 추적',
    undercut: '거대한 조직 위기의 출발점은 누군가 미뤄둔 아주 작은 일이었다',
  },
  digital: {
    doctrine: '디지털 응답권 및 읽음 후 방치금지 원칙',
    evidence: '디지털감식반은 전송 시각, 확인 시각, 답변이 증발한 구간과 알림 이후의 침묵을 초 단위로 복원한다.',
    remedy: '다음 연락에 대한 명확한 응답과 답하지 못할 경우의 사전 통지',
    risk: '읽음 표시만 남고 인간의 응답이 사라지는 디지털 유령도시로 발전할 위험',
    response: '디지털통신위기상황실을 열어 메시지 전송부터 응답 실종까지의 전 과정을 복원',
    undercut: '통신망은 정상 작동했지만 답장은 끝내 구조되지 못했다',
  },
  family: {
    doctrine: '공동생활 평온권 및 가족 간 사전고지 원칙',
    evidence: '가정평온수사대는 공용 공간의 동선, 물건의 마지막 위치와 사건 직후 집안에 흐른 미묘한 정적을 현장 기록으로 남긴다.',
    remedy: '같은 생활 상황에서 원고에게 우선 확인하고 공동 규칙을 한 줄로 작성할 의무',
    risk: '거실 통제권이 흔들리고 리모컨·냉장고·세탁기까지 공동생활 전선이 확대될 위험',
    response: '가정비상대책회의를 즉시 소집하고 공용 공간의 동선과 물건 이동 경로를 재구성',
    undercut: '집안 전체가 흔들린 것처럼 보였으나 발단은 공용 물건 하나였다',
  },
  other: {
    doctrine: '사소함에도 불구하고 찝찝함을 남기지 않을 권리',
    evidence: '소소감식반은 사건의 결정적 순간을 0.1초 단위로 복원하고 원고의 어이없음이 최고조에 이른 지점을 표시한다.',
    remedy: '사건의 핵심 행동을 바로잡는 맞춤형 조치와 재발 시 원고에게 우선 결정권을 부여하는 의무',
    risk: '생활질서의 미세 균열이 방치되어 단톡방 보고서와 장기적인 뒷말로 확대될 위험',
    response: '소소재난상황실을 개방하고 사건의 시작·확대·사후 태도를 단계별로 분석',
    undercut: '대규모 위기 보고서의 마지막 장에는 결국 아주 사소한 물건이나 행동 하나가 남았다',
  },
};

const SERIOUS_HUMOR_MARKERS = [
  '긴급속보', '상황실', '비상대책', '대책본부', '전면 경계', '경계 단계', '통제구역', '통제선',
  '0.1초', '프레임 단위', '감식반', '감식관', '수사대', '증거물 제', '사법 역사',
  '야간 비상근무', '연쇄 분쟁', '붕괴', '확산', '구조되지 못', '긴급 분석',
];

function splitFacts(description) {
  const source = cleanParagraph(description, 1800);
  const chunks = source
    .split(/(?:\n+|[.!?]+\s*|\s+(?:그리고|그런데|그러나|그래서)\s+)/)
    .map(item => cleanParagraph(item, 320))
    .filter(item => item.length >= 8);
  if (!chunks.length && source) return [source];
  return chunks.slice(0, 6);
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
      const key = token.toLowerCase();
      if (token.length < 2 || STOPWORDS.has(token) || /^\d+$/.test(token) || seen.has(key)) continue;
      seen.add(key);
      ordered.push(token);
      if (ordered.length >= 20) return ordered;
    }
  }
  return ordered;
}

function isConcreteSecondaryAnchor(anchor) {
  const token = String(anchor || '');
  if (token.length < 2 || SECONDARY_ANCHOR_SKIP.has(token) || /\d/.test(token)) return false;
  return !/(했다|됐다|있다|없다|않다|이다|하다|되다|[고서다])$/.test(token);
}

function resolveStoryCategory(categoryId, anchors, description) {
  const source = `${anchors.join(' ')} ${description}`;
  const householdTerms = ['리모컨', '소파', '거실', '주방', '세탁기', '청소', '방', '집안'];
  if (categoryId === 'digital' && householdTerms.some(term => source.includes(term))) return 'family';
  return CATEGORY_DOCTRINES[categoryId] ? categoryId : 'other';
}

function incidentLevel(grievanceIndex, categoryId) {
  const score = Math.max(1, Math.min(10, Number(grievanceIndex || 5)));
  const suffix = categoryId === 'food'
    ? '식탁 질서 전면 경계'
    : categoryId === 'family'
      ? '공동생활 비상대응'
      : categoryId === 'digital'
        ? '응답망 긴급 점검'
        : categoryId === 'late'
          ? '시간 신뢰체계 경계'
          : '생활질서 비상대응';
  if (score >= 9) return `소소위기 1단계 · ${suffix}`;
  if (score >= 7) return '소소위기 2단계 · 관계기관 긴급 소집';
  if (score >= 4) return '소소위기 3단계 · 상황실 가동';
  return '소소위기 4단계 · 조용한 전면 감시';
}

function sectionContainsAnchor(text, anchors) {
  const source = String(text || '').toLowerCase();
  return anchors.some(anchor => source.includes(String(anchor).toLowerCase()));
}

function markerCount(text, markers) {
  const source = String(text || '');
  return markers.filter(marker => source.includes(marker)).length;
}

module.exports = {
  MAIN_ANCHOR_SKIP,
  CATEGORY_LABELS,
  JUDGE_DIRECTIONS,
  CATEGORY_DOCTRINES,
  SERIOUS_HUMOR_MARKERS,
  splitFacts,
  extractAnchors,
  isConcreteSecondaryAnchor,
  resolveStoryCategory,
  incidentLevel,
  sectionContainsAnchor,
  markerCount,
};
