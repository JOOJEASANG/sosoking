export const MULTI_PRESETS = {
  collect: {
    label: '일반글',
    icon: '📝',
    shortDesc: '선택하지 않으면 일반 게시글로 등록됩니다.',
    titlePlaceholder: '제목을 입력하세요',
    descPlaceholder: '내용을 입력하세요.',
    tagsPlaceholder: '#일상, #게시판',
  },
  vote: {
    label: '찬반토론',
    icon: '🗳️',
    shortDesc: '찬성/반대 투표와 토론 댓글을 받습니다.',
    titlePlaceholder: '찬반 토론 주제를 입력하세요',
    descPlaceholder: '주제에 대한 설명을 입력하세요.',
    tagsPlaceholder: '#찬반토론, #투표',
    voteOptionPlaceholders: ['찬성', '반대'],
  },
  consult: {
    label: '병맛상담',
    icon: '🫠',
    shortDesc: '웃기지만 은근 쓸모 있는 고민 상담을 받습니다.',
    titlePlaceholder: '고민 제목을 입력하세요. 예: 이거 내가 예민한 거임?',
    descPlaceholder: '상황을 편하게 적어주세요. 웃기게 받아도 선은 지켜드립니다.',
    tagsPlaceholder: '#병맛상담, #고민, #선택장애',
  },
};

export const WRITER_PRESET_KEYS = ['collect', 'vote', 'consult'];

export const BODY_LABELS = {
  collect: '내용',
  vote: '토론 설명',
  consult: '고민 설명',
};

export const BODY_REQUIRED_PRESETS = ['consult'];

export function normalizePresetKey(key, { allowHidden = false } = {}) {
  if (key === 'vote' || key === 'ox' || key === 'debate' || key === 'discussion') return 'vote';
  if (key === 'quiz' || key === 'initial_game' || key === 'consult' || key === 'counsel' || key === 'advice') return 'consult';
  if (
    key === 'drip' || key === 'cbattle' || key === 'tournament' || key === 'naming' ||
    key === 'anonymous' || key === 'relay' || key === 'acrostic' || key === 'general' ||
    key === 'collection' || key === 'youtube' || key === 'image' || key === 'link'
  ) return 'collect';
  if (!MULTI_PRESETS[key]) return 'collect';
  return key;
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'collect');
}
