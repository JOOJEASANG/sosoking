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
  fill: {
    label: '빈칸 채우기',
    icon: '🧩',
    titlePlaceholder: '예: ___가 ___했다',
    descPlaceholder: '빈칸은 ___로 표시하세요. 예: ___가 ___했다 / 오늘의 내 기분은 ___다.',
    tagsPlaceholder: '#빈칸채우기, #빈칸',
  },
  naming: {
    label: '미친작명소',
    icon: '😜',
    titlePlaceholder: '예: 이 사진 이름 좀 지어줘',
    descPlaceholder: '사진이나 상황에 어울리는 웃긴 이름을 받아보세요.',
    tagsPlaceholder: '#작명, #미친작명소',
  },
  acrostic: {
    label: '삼행시',
    icon: '✍️',
    titlePlaceholder: '예: 삼행시 도전',
    descPlaceholder: '제시어를 넣고 사람들이 한 줄씩 완성하게 해보세요.',
    tagsPlaceholder: '#삼행시, #제시어',
    acrosticPlaceholder: '예: 소소킹',
  },
  relay: {
    label: '막장릴레이',
    icon: '🎭',
    titlePlaceholder: '예: 다음 문장 이어줘',
    descPlaceholder: '첫 문장이나 상황을 적어주세요. 참여자가 이야기를 이어갑니다.',
    tagsPlaceholder: '#릴레이, #막장릴레이',
  },
  quiz: {
    label: '미친퀴즈',
    icon: '🧠',
    titlePlaceholder: '예: 퀴즈 도전',
    descPlaceholder: '맞혀야 할 문제를 본문에 적어주세요.',
    tagsPlaceholder: '#퀴즈, #문제',
    quizAnswerPlaceholder: '예: 소',
  },
  anonymous: {
    label: '익명비밀글',
    icon: '🕶️',
    titlePlaceholder: '예: 익명으로 털어놓고 싶은 이야기',
    descPlaceholder: '고민, 고백, 폭로 등 진지한 이야기를 익명으로 작성할 수 있습니다.',
    tagsPlaceholder: '#익명비밀글, #고민, #고백',
  },
};

export const BODY_LABELS = {
  vote: '본문 · 질문/상황/토론 주제',
  fill: '본문 · 빈칸 채우기 문장',
  relay: '본문 · 릴레이 시작 문장',
  quiz: '본문 · 문제',
  anonymous: '본문 · 익명비밀글 내용',
};

export const BODY_REQUIRED_PRESETS = ['vote', 'fill', 'relay', 'quiz', 'anonymous'];

export function normalizePresetKey(key) {
  if (key === 'ox') return 'vote';
  return MULTI_PRESETS[key] ? key : 'general';
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'general');
}
