export const MULTI_PRESETS = {
  vote: {
    label: '토론소',
    buttonLabel: '토론',
    icon: '🗳️',
    shortDesc: '가볍게 갈리는 주제로 웃긴 토론을 엽니다.',
    titleLabel: '토론 주제',
    descLabel: '토론 설명',
    titlePlaceholder: '토론 주제를 입력하세요. 예: 월요일은 공식적으로 사과해야 한다?',
    descPlaceholder: '찬반이 갈릴 만한 상황이나 기준을 짧게 적어주세요.',
    tagsPlaceholder: '#토론, #웃긴토론, #찬반',
    voteOptionPlaceholders: ['왼쪽 선택지 입력', '오른쪽 선택지 입력'],
  },
  drip: {
    label: '드립소',
    buttonLabel: '드립',
    icon: '😂',
    shortDesc: '작명, 번역, 핑계, 근황까지 웃긴 말로 바꾸는 드립 공간입니다.',
    titleLabel: '드립 주제',
    descLabel: '드립 설명',
    titlePlaceholder: '드립 주제를 입력하세요. 예: 이 상황 이름 지어주세요',
    descPlaceholder: '상황, 사진 설명, 번역할 문장, 작명할 대상을 자유롭게 적어주세요.',
    tagsPlaceholder: '#드립, #작명, #이상한번역',
  },
};

export const WRITER_PRESET_KEYS = ['vote', 'drip'];

export const BODY_LABELS = {
  vote: '토론 설명',
  drip: '드립 설명',
};

export const BODY_REQUIRED_PRESETS = [];

export function normalizePresetKey(key, { allowHidden = false } = {}) {
  const value = String(key || '').trim();
  if (value === 'vote' || value === 'ox' || value === 'debate' || value === 'discussion' || value === 'crazy_court' || value === 'balance' || value === 'battle' || value === '토론' || value === '토론소') return 'vote';
  if (value === 'drip' || value === 'cbattle' || value === 'naming' || value === 'translation' || value === 'translate' || value === 'acrostic' || value === 'relay' || value === 'tournament' || value === '드립' || value === '드립소') return 'drip';

  // 제거된 예전 메뉴 호환: 판결은 토론소, 상담/작명/번역류는 드립소로 보냅니다.
  if (value === 'judgment' || value === 'verdict' || value === 'court' || value === 'trial' || value === 'judge' || value === '판결') return 'vote';
  if (value === 'consult' || value === 'counsel' || value === 'advice' || value === 'quiz' || value === 'initial_game' || value === '상담') return 'drip';
  if (
    value === 'collect' || value === 'general' || value === 'collection' || value === 'youtube' ||
    value === 'image' || value === 'link' || value === 'anonymous'
  ) return 'drip';
  if (!MULTI_PRESETS[value]) return 'drip';
  return value;
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'drip');
}
