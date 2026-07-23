export const MULTI_PRESETS = {
  judgment: {
    label: '판결',
    icon: '⚖️',
    shortDesc: '누가 예민한지, 누가 선 넘었는지 AI 캐릭터와 유저 배심원단에게 가볍게 판정받습니다.',
    titlePlaceholder: '사건 제목을 입력하세요. 예: 제가 예민한 건지 친구가 선 넘은 건지 봐주세요',
    descPlaceholder: '상황을 편하게 적어주세요. 누가 뭘 했는지, 왜 억울한지, 상대 입장은 무엇인지 적으면 AI 캐릭터들이 더 잘 판정합니다.',
    tagsPlaceholder: '#판결, #이거누구잘못, #소소재판',
    voteOptionPlaceholders: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'],
  },
  consult: {
    label: '상담',
    icon: '🫠',
    shortDesc: '고민을 올리면 공감형, 현실형, 분석형 캐릭터가 각자 다른 방식으로 조언합니다.',
    titlePlaceholder: '고민 제목을 입력하세요. 예: 이런 말 어떻게 답장해야 할까요?',
    descPlaceholder: '고민을 편하게 적어주세요. 상황, 내 감정, 원하는 결과를 적으면 더 쓸모 있는 답을 받을 수 있습니다.',
    tagsPlaceholder: '#상담, #고민, #답장고민',
  },
  vote: {
    label: '토론',
    icon: '🗳️',
    shortDesc: '찬성·반대·제3의 기준으로 AI 캐릭터와 유저들이 가볍게 의견을 나눕니다.',
    titlePlaceholder: '토론 주제를 입력하세요. 예: 읽씹보다 안읽씹이 더 별로다?',
    descPlaceholder: '토론할 기준이나 상황을 적어주세요. 어느 쪽이 더 맞는지, 왜 갈리는지 적으면 댓글이 더 잘 붙습니다.',
    tagsPlaceholder: '#토론, #찬반, #이건갈린다',
    voteOptionPlaceholders: ['찬성', '반대'],
  },
  drip: {
    label: '드립',
    icon: '😂',
    shortDesc: '짧은 주제를 던지면 AI 캐릭터와 유저들이 한 줄 드립으로 이어칩니다.',
    titlePlaceholder: '드립 주제를 입력하세요. 예: 월요일 알람에게 이름을 붙인다면?',
    descPlaceholder: '주제 설명이 필요하면 짧게 적어주세요. 비워도 됩니다. 짧을수록 드립이 더 잘 붙습니다.',
    tagsPlaceholder: '#드립, #한줄드립, #이건못참지',
  },
};

export const WRITER_PRESET_KEYS = ['judgment', 'consult', 'vote', 'drip'];

export const BODY_LABELS = {
  judgment: '사건 설명',
  consult: '고민 설명',
  vote: '토론 설명',
  drip: '드립 설명',
};

export const BODY_REQUIRED_PRESETS = ['consult'];

export function normalizePresetKey(key, { allowHidden = false } = {}) {
  const value = String(key || '').trim();
  if (value === 'judgment' || value === 'verdict' || value === 'court' || value === 'trial' || value === 'judge' || value === '판결') return 'judgment';
  if (value === 'consult' || value === 'counsel' || value === 'advice' || value === 'quiz' || value === 'initial_game' || value === '상담') return 'consult';
  if (value === 'vote' || value === 'ox' || value === 'debate' || value === 'discussion' || value === 'crazy_court' || value === '토론') return 'vote';
  if (value === 'drip' || value === 'cbattle' || value === '드립') return 'drip';
  if (
    value === 'collect' || value === 'general' || value === 'collection' || value === 'youtube' ||
    value === 'image' || value === 'link' || value === 'tournament' || value === 'naming' ||
    value === 'anonymous' || value === 'relay' || value === 'acrostic'
  ) return 'judgment';
  if (!MULTI_PRESETS[value]) return 'judgment';
  return value;
}

export function getMultiPresetFromHash(hash = window.location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset') || 'judgment');
}
