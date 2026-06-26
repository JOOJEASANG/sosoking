export const MULTI_PRESETS = {
  tournament: {
    label: '대결방',
    icon: '⚔️',
    shortDesc: '토너먼트 대결',
    titlePlaceholder: '대결 제목',
    descPlaceholder: '',
    tagsPlaceholder: '#대결, #토너먼트',
    hiddenFromWriter: true,
  },
  collect: {
    label: '일반글',
    icon: '📝',
    shortDesc: '자유롭게 쓰는 게시글',
    titlePlaceholder: '제목을 입력하세요',
    descPlaceholder: '내용을 입력하세요.',
    tagsPlaceholder: '#일상, #피드',
  },
  vote: {
    label: '투표',
    icon: '🗳️',
    shortDesc: '선택지 투표',
    titlePlaceholder: '투표 주제를 입력하세요',
    descPlaceholder: '설명을 입력하세요.',
    tagsPlaceholder: '#투표',
    voteOptionPlaceholders: ['선택지 1', '선택지 2'],
  },
  quiz: {
    label: '퀴즈',
    icon: '🧠',
    shortDesc: '주관식 · 객관식 퀴즈',
    titlePlaceholder: '퀴즈 제목을 입력하세요',
    descPlaceholder: '문제를 입력하세요.',
    tagsPlaceholder: '#퀴즈',
    quizAnswerPlaceholder: '정답',
  },
  drip: {
    label: '드립',
    icon: '🤣',
    shortDesc: '주제 던지고 한줄 드립',
    titlePlaceholder: '드립 주제',
    descPlaceholder: '드립 주제를 입력하세요.',
    tagsPlaceholder: '#드립',
  },
};

export const WRITER_PRESET_KEYS = ['collect', 'vote', 'quiz', 'drip'];

export const BODY_LABELS = {
  collect: '내용',
  vote: '투표 설명',
  drip: '드립 주제',
  quiz: '퀴즈 문제',
  tournament: '대결 설명',
};

export const BODY_REQUIRED_PRESETS = ['vote', 'drip', 'quiz'];

export function normalizePresetKey(key, { allowHidden = false } = {}) {
  if (key === 'ox') return 'vote';
  if (key === 'collection' || key === 'youtube' || key === 'image' || key === 'link') return 'collect';
  if (key === 'debate' || key === 'discussion') return 'vote';
  if (key === 'anonymous' || key === 'relay' || key === 'acrostic' || key === 'general') return 'collect';
  if (key === 'tournament') return allowHidden ? 'tournament' : 'collect';
  if (!MULTI_PRESETS[key]) return 'collect';
  if (!allowHidden && MULTI_PRESETS[key].hiddenFromWriter) return 'collect';
  return key;
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'collect');
}
