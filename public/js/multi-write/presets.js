export const MULTI_PRESETS = {
  general: {
    label: '일반',
    icon: '📝',
    shortDesc: '자유글 · 사진 · 유튜브',
    titlePlaceholder: '예: 오늘 있었던 웃긴 일',
    descPlaceholder: '글, 사진, 질문, 상황 설명 등을 자유롭게 적어보세요.',
    tagsPlaceholder: '#일상, #피드, #소소킹',
  },
  vote: {
    label: '투표·판정',
    icon: '🗳️',
    shortDesc: '투표 · 판정 · 토론 · 밸런스',
    titlePlaceholder: '예: 이 상황 억까인가요? 공감인가요?',
    descPlaceholder: '투표·판정받을 상황을 적어주세요. 일반 투표, 밸런스 게임, 유죄/무죄 판정, 찬반 토론 모두 이 형식으로 올릴 수 있어요.',
    tagsPlaceholder: '#투표, #판정, #토론',
    voteOptionPlaceholders: ['선택지 A', '선택지 B'],
  },
  // 기존 빈칸채우기 글 호환용입니다. 새 글쓰기 선택지에서는 숨깁니다.
  fill: {
    label: '빈칸',
    icon: '🧩',
    titlePlaceholder: '예: ___가 ___했다',
    descPlaceholder: '빈칸은 ___로 표시하세요. 예: ___가 ___했다 / 오늘의 내 기분은 ___다.',
    tagsPlaceholder: '#빈칸채우기, #빈칸',
    hiddenFromWriter: true,
  },
  naming: {
    label: '작명',
    icon: '😜',
    shortDesc: '웃긴 이름 붙이기',
    titlePlaceholder: '예: 이 사진 이름 좀 지어줘',
    descPlaceholder: '사진이나 상황에 어울리는 웃긴 이름을 받아보세요.',
    tagsPlaceholder: '#작명, #미친작명소',
  },
  drip: {
    label: '드립',
    icon: '🤣',
    shortDesc: '한 줄 드립 모으기',
    titlePlaceholder: '예: 퇴근 5분 전에 팀장이 부른 이유',
    descPlaceholder: '사람들이 한 줄 드립을 남기고 싶어지는 주제나 상황을 적어주세요.',
    tagsPlaceholder: '#드립, #한줄드립, #드립대전',
  },
  // 기존 행시 글 호환용입니다. 새 글쓰기 선택지에서는 숨깁니다.
  acrostic: {
    label: '행시',
    icon: '✍️',
    titlePlaceholder: '예: 행시 도전',
    descPlaceholder: '2~5글자 제시어를 넣으면 글자 수에 맞춰 이행시·삼행시·사행시·오행시로 자동 적용됩니다.',
    tagsPlaceholder: '#행시, #삼행시, #오행시',
    hiddenFromWriter: true,
  },
  // 기존 막장릴레이 글 호환용입니다. 새 글쓰기 선택지에서는 숨깁니다.
  relay: {
    label: '릴레이',
    icon: '🎭',
    titlePlaceholder: '예: 다음 문장 이어줘',
    descPlaceholder: '첫 문장이나 상황을 적어주세요. 참여자가 이야기를 이어갑니다.',
    tagsPlaceholder: '#릴레이, #막장릴레이',
    hiddenFromWriter: true,
  },
  quiz: {
    label: '퀴즈',
    icon: '🧠',
    shortDesc: '주관식 · 객관식 퀴즈',
    titlePlaceholder: '예: 퀴즈 도전',
    descPlaceholder: '맞혀야 할 문제를 본문에 적어주세요.',
    tagsPlaceholder: '#퀴즈, #문제',
    quizAnswerPlaceholder: '예: 소',
  },
};

export const WRITER_PRESET_KEYS = Object.keys(MULTI_PRESETS).filter(key => !MULTI_PRESETS[key].hiddenFromWriter);

export const BODY_LABELS = {
  vote: '본문 · 투표 주제',
  drip: '본문 · 드립 주제',
  fill: '본문 · 빈칸 문장',
  quiz: '본문 · 문제',
};

export const BODY_REQUIRED_PRESETS = ['vote', 'drip', 'quiz'];

export function normalizePresetKey(key, { allowHidden = false } = {}) {
  if (key === 'ox') return 'vote';
  if (key === 'anonymous' || key === 'relay' || key === 'acrostic') return 'general';
  if (!MULTI_PRESETS[key]) return 'general';
  if (!allowHidden && MULTI_PRESETS[key].hiddenFromWriter) return 'general';
  return key;
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'general');
}