export const MULTI_PRESETS = {
  collect: {
    label: '일반방',
    icon: '📌',
    shortDesc: '유튜브 · 이미지 모음',
    titlePlaceholder: '예: 오늘 웃긴 쇼츠 모음',
    descPlaceholder: '짧게 설명을 적어주세요. 예: 웃겨서 저장해둔 영상입니다.',
    tagsPlaceholder: '#유튜브, #웃긴그림, #모음',
    hiddenFromWriter: true,
  },
  vote: {
    label: '토론방',
    icon: '🗳️',
    shortDesc: '찬성 · 반대 · 선택지 투표',
    titlePlaceholder: '예: 이거 찬성인가요 반대인가요?',
    descPlaceholder: '토론할 상황이나 질문을 적어주세요.',
    tagsPlaceholder: '#토론, #투표, #찬반',
    voteOptionPlaceholders: ['찬성', '반대'],
    hiddenFromWriter: true,
  },
  drip: {
    label: '드립방',
    icon: '🤣',
    shortDesc: '한 줄 드립',
    titlePlaceholder: '예: 퇴근 5분 전 회의 잡혔을 때',
    descPlaceholder: '',
    tagsPlaceholder: '#드립, #한줄드립, #유머',
    hiddenFromWriter: true,
  },
  general: {
    label: '일반',
    icon: '📝',
    shortDesc: '기존 일반글',
    titlePlaceholder: '예: 오늘 있었던 웃긴 일',
    descPlaceholder: '글, 사진, 질문, 상황 설명 등을 자유롭게 적어보세요.',
    tagsPlaceholder: '#일상, #피드, #소소킹',
    hiddenFromWriter: true,
  },
  fill: {
    label: '빈칸',
    icon: '🧩',
    titlePlaceholder: '예: ___가 ___했다',
    descPlaceholder: '빈칸은 ___로 표시하세요.',
    tagsPlaceholder: '#빈칸채우기, #빈칸',
    hiddenFromWriter: true,
  },
  naming: {
    label: '작명',
    icon: '😜',
    shortDesc: '댓글로 자유 작명',
    titlePlaceholder: '예: 이 사진 이름 좀 지어줘',
    descPlaceholder: '사진이나 상황에 어울리는 웃긴 이름을 받아보세요.',
    tagsPlaceholder: '#작명, #미친작명소',
    hiddenFromWriter: true,
  },
  acrostic: {
    label: '행시',
    icon: '✍️',
    titlePlaceholder: '예: 행시 도전',
    descPlaceholder: '2~5글자 제시어를 넣어주세요.',
    tagsPlaceholder: '#행시, #삼행시, #오행시',
    hiddenFromWriter: true,
  },
  relay: {
    label: '릴레이',
    icon: '🎭',
    titlePlaceholder: '예: 다음 문장 이어줘',
    descPlaceholder: '첫 문장이나 상황을 적어주세요.',
    tagsPlaceholder: '#릴레이, #막장릴레이',
    hiddenFromWriter: true,
  },
};

export const WRITER_PRESET_KEYS = [];

export const BODY_LABELS = {
  collect: '한줄 설명',
  vote: '토론 주제',
};

export const BODY_REQUIRED_PRESETS = ['collect', 'vote'];

export function normalizePresetKey(key, { allowHidden = false } = {}) {
  if (key === 'tournament') return 'collect';
  if (key === 'ox') return 'vote';
  if (key === 'collection' || key === 'youtube' || key === 'image' || key === 'link') return 'collect';
  if (key === 'debate' || key === 'discussion') return 'vote';
  if (key === 'anonymous' || key === 'relay' || key === 'acrostic' || key === 'quiz' || key === 'initial_game') return 'general';
  if (!MULTI_PRESETS[key]) return 'collect';
  if (!allowHidden && MULTI_PRESETS[key].hiddenFromWriter) return 'collect';
  return key;
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'collect', { allowHidden: true });
}
