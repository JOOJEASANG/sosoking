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
  quiz: {
    label: '퀴즈',
    icon: '🧠',
    shortDesc: '퀴즈 정답과 해설 옵션을 설정합니다.',
    titlePlaceholder: '퀴즈 제목을 입력하세요',
    descPlaceholder: '문제를 입력하세요.',
    tagsPlaceholder: '#퀴즈',
    quizAnswerPlaceholder: '정답',
  },
};

export const WRITER_PRESET_KEYS = ['collect', 'vote', 'quiz'];

export const BODY_LABELS = {
  collect: '내용',
  vote: '토론 설명',
  quiz: '퀴즈 문제',
};

export const BODY_REQUIRED_PRESETS = ['quiz'];

export function normalizePresetKey(key, { allowHidden = false } = {}) {
  if (key === 'vote' || key === 'ox' || key === 'debate' || key === 'discussion') return 'vote';
  if (key === 'quiz' || key === 'initial_game') return 'quiz';
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
