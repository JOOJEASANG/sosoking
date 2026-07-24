export const MULTI_PRESETS = {
  judgment: {
    label: '판결', icon: '⚖️',
    shortDesc: '누가 예민한지, 누가 선을 넘었는지 가볍게 판정받습니다.',
    titlePlaceholder: '사건 제목을 입력하세요',
    descPlaceholder: '상황과 서로의 입장을 구체적으로 적어주세요.',
    tagsPlaceholder: '#판결, #관계',
    voteOptionPlaceholders: ['글쓴이가 예민함', '상대가 선 넘음', '둘 다 문제 있음'],
  },
  consult: {
    label: '상담', icon: '🫠',
    shortDesc: '공감과 현실적인 조언을 여러 관점으로 받습니다.',
    titlePlaceholder: '고민 제목을 입력하세요',
    descPlaceholder: '상황, 감정, 원하는 결과를 적어주세요.',
    tagsPlaceholder: '#상담, #고민',
  },
  vote: {
    label: '토론', icon: '🗳️',
    shortDesc: '찬성과 반대의 판단 기준을 나눕니다.',
    titlePlaceholder: '토론 주제를 입력하세요',
    descPlaceholder: '토론할 상황과 기준을 적어주세요.',
    tagsPlaceholder: '#토론, #찬반',
    voteOptionPlaceholders: ['찬성', '반대'],
  },
  drip: {
    label: '드립', icon: '😂',
    shortDesc: '짧은 주제로 한 줄 드립을 이어갑니다.',
    titlePlaceholder: '드립 주제를 입력하세요',
    descPlaceholder: '주제 설명이 필요하면 짧게 적어주세요.',
    tagsPlaceholder: '#드립, #한줄드립',
  },
};

export const WRITER_PRESET_KEYS = ['judgment', 'consult', 'vote', 'drip'];
export const BODY_LABELS = { judgment: '사건 설명', consult: '고민 설명', vote: '토론 설명', drip: '드립 설명' };
export const BODY_REQUIRED_PRESETS = ['consult'];

export function normalizePresetKey(value) {
  const key = String(value || '').trim();
  return WRITER_PRESET_KEYS.includes(key) ? key : 'judgment';
}

export function getMultiPresetFromHash(hash = location.hash || '') {
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : '';
  return normalizePresetKey(new URLSearchParams(query).get('preset'));
}
