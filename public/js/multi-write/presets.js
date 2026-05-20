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
    descPlaceholder: '투표/판정받을 질문이나 상황을 본문에 적어주세요.',
    tagsPlaceholder: '#투표, #판정',
    voteOptionPlaceholders: ['그렇다', '아니다'],
  },
  ox: {
    label: 'OX판정',
    icon: '⭕',
    titlePlaceholder: '예: 이거 내가 잘못한 거 O/X?',
    descPlaceholder: 'O 또는 X로 판정받을 상황을 적어주세요.',
    tagsPlaceholder: '#OX, #판정',
  },
  fill: {
    label: '채우기',
    icon: '🧩',
    titlePlaceholder: '예: 친구가 갑자기 ___라고 말했다',
    descPlaceholder: '빈칸이 들어간 문장이나 상황을 적어주세요. 예: 오늘의 내 기분은 ___다.',
    tagsPlaceholder: '#채우기, #빈칸',
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
  quiz: {
    label: '퀴즈',
    icon: '🧠',
    titlePlaceholder: '예: 퀴즈 도전',
    descPlaceholder: '맞혀야 할 문제를 본문에 적어주세요.',
    tagsPlaceholder: '#퀴즈, #문제',
    quizAnswerPlaceholder: '예: 소',
  },
  anonymous: {
    label: '익명',
    icon: '🕶️',
    titlePlaceholder: '예: 익명으로 털어놓고 싶은 이야기',
    descPlaceholder: '고민, 고백, 폭로 등 진지한 고민도 가능합니다.',
    tagsPlaceholder: '#익명, #고민, #고백',
  },
};

export const BODY_LABELS = {
  vote: '본문 · 질문/상황',
  ox: '본문 · OX판정 상황',
  fill: '본문 · 채우기 문장',
  quiz: '본문 · 문제',
  anonymous: '본문 · 익명 내용',
};

export const BODY_REQUIRED_PRESETS = ['vote', 'ox', 'fill', 'quiz', 'anonymous'];

export function normalizePresetKey(key) {
  return MULTI_PRESETS[key] ? key : 'general';
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'general');
}
