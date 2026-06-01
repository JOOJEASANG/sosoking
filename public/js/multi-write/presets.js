export const MULTI_PRESETS = {
  tournament: {
    label: '대결방',
    icon: '⚔️',
    shortDesc: '토너먼트 대결',
    titlePlaceholder: '예: 역대 최강 라면 토너먼트 대결',
    descPlaceholder: '',
    tagsPlaceholder: '#대결, #토너먼트, #최강자',
  },
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
  },
  quiz: {
    label: '퀴즈방',
    icon: '🧠',
    shortDesc: '주관식 · 객관식 퀴즈',
    titlePlaceholder: '예: 맞히면 인정하는 퀴즈',
    descPlaceholder: '맞혀야 할 문제를 적어주세요.',
    tagsPlaceholder: '#퀴즈, #문제, #상식',
    quizAnswerPlaceholder: '예: 소',
  },
  drip: {
    label: '드립방',
    icon: '🤣',
    shortDesc: '주제 던지고 한줄 드립',
    titlePlaceholder: '드립 주제',
    descPlaceholder: '사람들이 한 줄 드립을 칠 수 있는 상황이나 주제를 적어주세요.',
    tagsPlaceholder: '#드립, #한줄드립, #드립주제',
  },
  // 기존 일반글 호환용입니다. 새 글쓰기 선택지에서는 제거합니다.
  general: {
    label: '일반',
    icon: '📝',
    shortDesc: '기존 일반글',
    titlePlaceholder: '예: 오늘 있었던 웃긴 일',
    descPlaceholder: '글, 사진, 질문, 상황 설명 등을 자유롭게 적어보세요.',
    tagsPlaceholder: '#일상, #피드, #소소킹',
    hiddenFromWriter: true,
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
  // 기존 작명 글 호환용입니다. 새 글쓰기 선택지에서는 제거합니다.
  naming: {
    label: '작명',
    icon: '😜',
    shortDesc: '댓글로 자유 작명',
    titlePlaceholder: '예: 이 사진 이름 좀 지어줘',
    descPlaceholder: '사진이나 상황에 어울리는 웃긴 이름을 받아보세요.',
    tagsPlaceholder: '#작명, #미친작명소',
    hiddenFromWriter: true,
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
};

export const WRITER_PRESET_KEYS = ['tournament'];

export const BODY_LABELS = {
  collect: '한줄 설명',
  vote: '토론 주제',
  drip: '드립 주제',
  fill: '본문 · 빈칸 문장',
  quiz: '퀴즈 문제',
  tournament: '대결 설명',
};

export const BODY_REQUIRED_PRESETS = ['collect', 'vote', 'drip', 'quiz'];
// tournament does not use body text — items are entered per-row

export function normalizePresetKey(key, { allowHidden = false } = {}) {
  if (key === 'ox') return 'vote';
  if (key === 'collection' || key === 'youtube' || key === 'image' || key === 'link') return 'collect'; // kept for old link compat
  if (key === 'debate' || key === 'discussion') return 'vote';
  if (key === 'anonymous' || key === 'relay' || key === 'acrostic') return 'general';
  if (!MULTI_PRESETS[key]) return 'tournament';
  if (!allowHidden && MULTI_PRESETS[key].hiddenFromWriter) return 'tournament';
  return key;
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'tournament');
}
