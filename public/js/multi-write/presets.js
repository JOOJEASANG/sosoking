export const MULTI_PRESETS = {
  judgment: {
    label: '판결',
    icon: '⚖️',
    shortDesc: '사소한 사건을 올리고 캐릭터와 유저에게 판결을 받습니다.',
    titlePlaceholder: '사건 제목을 입력하세요. 예: 이거 제가 예민한 건가요?',
    descPlaceholder: '상황을 편하게 적어주세요. 캐릭터들이 판결에 끼어듭니다.',
    tagsPlaceholder: '#판결, #소소재판, #이거누구잘못',
    voteOptionPlaceholders: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'],
  },
  consult: {
    label: '상담',
    icon: '🫠',
    shortDesc: '웃기지만 은근 쓸모 있는 고민 상담을 받습니다.',
    titlePlaceholder: '고민 제목을 입력하세요. 예: 장바구니가 저를 부릅니다',
    descPlaceholder: '고민을 편하게 적어주세요. 웃기게 받아도 선은 지켜드립니다.',
    tagsPlaceholder: '#상담, #고민, #선택장애',
  },
  vote: {
    label: '토론',
    icon: '🗳️',
    shortDesc: '가벼운 주제로 찬반 의견과 투표를 받습니다.',
    titlePlaceholder: '토론 주제를 입력하세요. 예: 먼저 연락한다 vs 그냥 둔다',
    descPlaceholder: '토론할 상황이나 기준을 입력하세요.',
    tagsPlaceholder: '#토론, #찬반, #소소판정',
    voteOptionPlaceholders: ['찬성', '반대'],
  },
  drip: {
    label: '드립',
    icon: '😂',
    shortDesc: '한 줄 드립 주제를 던지고 캐릭터와 유저가 붙습니다.',
    titlePlaceholder: '드립 주제를 입력하세요. 예: 월요일 알람에게 이름을 붙인다면?',
    descPlaceholder: '주제 설명이 필요하면 짧게 적어주세요. 비워도 됩니다.',
    tagsPlaceholder: '#드립, #한줄드립, #드립배틀',
  },
};

export const WRITER_PRESET_KEYS = ['judgment', 'consult', 'vote', 'drip'];

export const BODY_LABELS = {
  judgment: '사건 설명',
  consult: '고민 설명',
  vote: '토론 설명',
  drip: '드립 설명',
};

export const BODY_REQUIRED_PRESETS = ['consult'];

export function normalizePresetKey(key, { allowHidden = false } = {}) {
  const value = String(key || '').trim();
  if (value === 'judgment' || value === 'verdict' || value === 'court' || value === 'trial' || value === 'judge' || value === '판결') return 'judgment';
  if (value === 'consult' || value === 'counsel' || value === 'advice' || value === 'quiz' || value === 'initial_game' || value === '상담') return 'consult';
  if (value === 'vote' || value === 'ox' || value === 'debate' || value === 'discussion' || value === 'crazy_court' || value === '토론') return 'vote';
  if (value === 'drip' || value === 'cbattle' || value === '드립') return 'drip';
  if (
    value === 'collect' || value === 'general' || value === 'collection' || value === 'youtube' ||
    value === 'image' || value === 'link' || value === 'tournament' || value === 'naming' ||
    value === 'anonymous' || value === 'relay' || value === 'acrostic'
  ) return 'judgment';
  if (!MULTI_PRESETS[value]) return 'judgment';
  return value;
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'judgment');
}
