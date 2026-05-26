export const GAMES = [
  {
    key: 'liar',
    icon: '🕵️',
    title: 'AI 라이어 찾기',
    desc: '제시어를 모르는 AI 라이어가 채팅에 숨어듭니다. 말투와 설명의 빈틈을 찾아 투표로 잡아내세요.',
    status: '방 만들기',
    tag: '🤖 추리',
    path: '/game/liar',
    enabled: true,
    players: '4~8명',
    pace: '채팅 추리',
    hook: 'AI가 모르는 척이 아니라 아는 척을 합니다.',
    originalNote: '유명 작품명과 표현을 피하고, 소소킹 전용 AI 잠입 추리 콘셉트로 운영합니다.',
    guide: {
      subtitle: 'AI가 제시어 없이 잠입 — 설명의 빈틈을 찾는 채팅 추리 게임',
      goal: '시민은 제시어를 자연스럽게 설명하고, AI 라이어는 제시어를 모른 채 끝까지 속입니다. 투표로 AI를 지목하면 시민팀 승리입니다.',
      flow: '방 만들기 → 초대 링크 공유 → 참가자 입장 → 제시어 확인 → 설명/질문 채팅 → 의심 투표 → AI 정체 공개 순서로 진행합니다.',
      tip: '너무 직접적인 설명은 AI에게 힌트가 됩니다. 반대로 너무 애매하면 사람이 AI로 몰릴 수 있습니다.',
    },
  },
  {
    key: 'mafia',
    icon: '🌙',
    title: 'AI 마피아',
    desc: 'AI 마피아가 토론에 직접 참여합니다. 낮에는 설득하고 밤에는 속이며, 투표로 숨은 AI를 처형하세요.',
    status: '방 만들기',
    tag: '🤖 심리전',
    path: '/game/mafia',
    enabled: true,
    players: '5~9명',
    pace: '토론/투표',
    hook: 'AI가 조용히 있지 않고 직접 여론을 흔듭니다.',
    originalNote: '마피아 장르의 보편적 사회추론 구조에 AI 토론·AI 투표 패턴을 더한 소소킹형 게임입니다.',
    guide: {
      subtitle: 'AI가 마피아로 위장 — 토론과 투표로 찾아내는 사회추론 게임',
      goal: '시민팀은 AI 마피아를 모두 처형하면 승리합니다. AI 마피아는 시민 수를 줄이고 의심을 다른 사람에게 돌리면 승리합니다.',
      flow: '방 만들기 → 참가자 입장 → 역할 배정 → 낮 토론 → 투표 → 밤 행동 → 결과 공개 → 승리 조건 확인 순서로 진행합니다.',
      tip: 'AI는 말투, 투표, 의심 유도 방식이 매 판 달라집니다. 확신보다 모순 기록이 중요합니다.',
    },
  },
  {
    key: 'touch-king',
    icon: '👑',
    title: '소소터치왕',
    desc: '중앙판 12개와 내 판 12개 중 동시에 있는 같은 그림을 가장 빨리 터치하는 순발력 대결 게임입니다.',
    status: '방 만들기',
    tag: '👑 순발력',
    path: '/game/touch-king',
    enabled: true,
    players: '2~10명',
    pace: '빠른 터치',
    hook: '인원수와 게임횟수를 정하고, 12개 그림 중 같은 그림을 가장 많이 빠르게 찾은 사람이 소소터치왕이 됩니다.',
    originalNote: '상업 카드게임 이름·카드 형태·심볼 세트를 쓰지 않고, 소소킹 전용 터치 대결 규칙과 UI로 운영합니다.',
    guide: {
      subtitle: '12개 그림 중 같은 그림을 가장 빨리 찾는 실시간 터치 대결',
      goal: '각 게임마다 중앙판 12개와 내 판 12개에 동시에 있는 그림을 빠르게 찾아 점수를 얻습니다. 정해진 게임횟수가 끝나면 점수가 가장 높은 사람이 우승합니다.',
      flow: '인원수/게임횟수 선택 → 방 만들기 → 초대 링크 공유 → 참가자 입장 → 게임 시작 → 같은 그림 터치 → 결과 → 최종 우승자 공개 순서로 진행합니다.',
      tip: '정답은 +100점이고, 남은 시간이 많을수록 보너스가 붙습니다. 오답은 감점됩니다.',
    },
  },
  {
    key: 'soso-code',
    icon: '🔐',
    title: '소소코드',
    desc: '상대의 숨겨진 숫자·색상·기호 코드를 질문과 힌트로 추리합니다. AI 해커가 가짜 힌트를 섞습니다.',
    status: '프로토타입',
    tag: '🔐 추론',
    path: '/game/soso-code',
    enabled: true,
    players: '2~4명',
    pace: '턴제 추리',
    hook: '맞히면 강해지고, 틀리면 내 코드가 조금 드러납니다.',
    originalNote: '기존 숫자 타일 게임의 명칭·구성품·정렬 표현을 피하고, 색상/기호/AI 해킹 힌트를 더한 새 규칙으로 설계합니다.',
    guide: {
      subtitle: '숨겨진 코드를 질문과 위험한 추측으로 파헤치는 턴제 추리 게임',
      goal: '상대의 비밀 코드를 먼저 해독하면 승리합니다. 잘못 추측하면 내 코드 일부가 공개되어 역공을 당합니다.',
      flow: '코드 배정 → 질문 카드 선택 → 힌트 공개 → 추측 또는 보류 → 정답 검증 → 공개 정보 갱신 순서로 진행합니다.',
      tip: 'AI 해커의 힌트는 항상 유용하지 않습니다. 맞는 말, 애매한 말, 함정이 섞입니다.',
    },
  },
  {
    key: 'ai-court',
    icon: '⚖️',
    title: 'AI 재판소',
    desc: '사건 기록, 증거 카드, AI 증언을 놓고 토론합니다. 진짜 범인과 조작된 증거를 함께 찾아내세요.',
    status: '프로토타입',
    tag: '⚖️ 토론',
    path: '/game/ai-court',
    enabled: false,
    players: '3~7명',
    pace: '토론 추리',
    hook: '범인만 찾으면 끝이 아닙니다. 누가 증거를 조작했는지도 밝혀야 합니다.',
    originalNote: '특정 작품·게임의 사건, 캐릭터, 법정 연출을 쓰지 않고 소소킹 자체 사건 템플릿과 AI 증언 구조로 만듭니다.',
    guide: {
      subtitle: 'AI 증언과 증거의 모순을 찾아내는 토론형 추리 게임',
      goal: '플레이어는 사건의 범인, 거짓 증거, AI 증언의 모순을 찾아 최종 판결에서 맞혀야 합니다.',
      flow: '사건 공개 → 증거 카드 배분 → 질문/반박 토론 → AI 증언 요청 → 최종 변론 → 판결 투표 순서로 진행합니다.',
      tip: 'AI가 주는 답은 단서일 수도 있고 함정일 수도 있습니다. 증거끼리 맞물리는지를 봐야 합니다.',
    },
  },
];

export const VISIBLE_GAMES = GAMES.filter(game => game.enabled !== false);

export const GAME_ROUTE_PREFIXES = GAMES.map(game => game.path).concat(['/game/symbol-spy']);

export function findGameByKey(key) {
  return GAMES.find(game => game.key === key) || null;
}

export function findGameByPath(path) {
  return GAMES.find(game => path === game.path || path.startsWith(`${game.path}/`)) || null;
}
