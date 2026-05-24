export const MULTI_PRESETS = {
  general: {
    label: '일반글',
    icon: '📝',
    titlePlaceholder: '예: 오늘 있었던 웃긴 일',
    descPlaceholder: '글, 사진, 질문, 상황 설명 등을 자유롭게 적어보세요.',
    tagsPlaceholder: '#일상, #피드, #소소킹',
  },
  vote: {
    label: '투표/판정',
    icon: '🗳️',
    titlePlaceholder: '예: 여러분의 판정은?',
    descPlaceholder: '투표/판정받을 질문이나 상황을 본문에 적어주세요. 의견/토론도 댓글로 이어집니다.',
    tagsPlaceholder: '#투표, #판정, #토론',
    voteOptionPlaceholders: ['찬성', '반대'],
  },
  // 기존 빈칸채우기 글 호환용입니다. 새 글쓰기 선택지에서는 숨깁니다.
  fill: {
    label: '빈칸 채우기',
    icon: '🧩',
    titlePlaceholder: '예: ___가 ___했다',
    descPlaceholder: '빈칸은 ___로 표시하세요. 예: ___가 ___했다 / 오늘의 내 기분은 ___다.',
    tagsPlaceholder: '#빈칸채우기, #빈칸',
    hiddenFromWriter: true,
  },
  naming: {
    label: '미친작명소',
    icon: '😜',
    titlePlaceholder: '예: 이 사진 이름 좀 지어줘',
    descPlaceholder: '사진이나 상황에 어울리는 웃긴 이름을 받아보세요.',
    tagsPlaceholder: '#작명, #미친작명소',
  },
  acrostic: {
    label: '행시',
    icon: '✍️',
    titlePlaceholder: '예: 행시 도전',
    descPlaceholder: '2~5글자 제시어를 넣으면 글자 수에 맞춰 이행시·삼행시·사행시·오행시로 자동 적용됩니다.',
    tagsPlaceholder: '#행시, #삼행시, #오행시',
    acrosticPlaceholder: '예: 소소킹 / 관리자 / 대한민국',
  },
  // 기존 막장릴레이 글 호환용입니다. 새 글쓰기 선택지에서는 숨깁니다.
  relay: {
    label: '막장릴레이',
    icon: '🎭',
    titlePlaceholder: '예: 다음 문장 이어줘',
    descPlaceholder: '첫 문장이나 상황을 적어주세요. 참여자가 이야기를 이어갑니다.',
    tagsPlaceholder: '#릴레이, #막장릴레이',
    hiddenFromWriter: true,
  },
  quiz: {
    label: '미친퀴즈',
    icon: '🧠',
    titlePlaceholder: '예: 퀴즈 도전',
    descPlaceholder: '맞혀야 할 문제를 본문에 적어주세요.',
    tagsPlaceholder: '#퀴즈, #문제',
    quizAnswerPlaceholder: '예: 소',
  },
};

export const WRITER_PRESET_KEYS = Object.keys(MULTI_PRESETS).filter(key => !MULTI_PRESETS[key].hiddenFromWriter);

export const BODY_LABELS = {
  vote: '본문 · 질문/상황/토론 주제',
  fill: '본문 · 빈칸 채우기 문장',
  acrostic: '본문 · 행시 설명/참여 안내',
  relay: '본문 · 릴레이 시작 문장',
  quiz: '본문 · 문제',
};

export const BODY_REQUIRED_PRESETS = ['vote', 'quiz'];

export function getAcrosticLabel(keyword = '') {
  const count = [...String(keyword || '').trim()].length;
  return ({
    2: '이행시',
    3: '삼행시',
    4: '사행시',
    5: '오행시',
  })[count] || (count > 0 ? `${count}행시` : '행시');
}

export function normalizePresetKey(key, { allowHidden = false } = {}) {
  if (key === 'ox') return 'vote';
  if (key === 'anonymous') return 'general';
  if (!MULTI_PRESETS[key]) return 'general';
  if (!allowHidden && MULTI_PRESETS[key].hiddenFromWriter) return 'general';
  return key;
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'general');
}