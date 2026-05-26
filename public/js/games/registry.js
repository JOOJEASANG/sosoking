export const GAMES = [
  {
    key: 'soso-spy',
    icon: '🕵️',
    title: '소소스파이',
    desc: 'AI 스파이가 살짝 다른 단어를 받고 잠입합니다. 힌트를 교환하고 토론해서 숨은 AI를 찾아내세요.',
    status: '방 만들기',
    tag: '🤖 힌트 추리',
    path: '/game/soso-spy',
    enabled: true,
    players: '4~8명',
    pace: '힌트/투표',
    hook: 'AI는 비슷하지만 다른 단어를 받아 자연스럽게 위장합니다.',
    originalNote: '소소킹 전용 숨겨진 단어 추리 게임. AI가 살짝 다른 단어로 잠입하고 힌트 라운드로 추리합니다.',
    guide: {
      subtitle: 'AI가 다른 단어로 잠입 — 힌트 교환과 투표로 찾아내는 추리 게임',
      goal: '시민팀은 AI 스파이를 투표로 지목해 내보내면 승리합니다. AI는 3라운드 살아남거나 시민이 2명 이하가 되면 승리합니다.',
      flow: '방 만들기 → 참가자 입장 → 단어 확인 → 힌트 제출(30초) → 힌트 공개/토론(90초) → 투표(30초) → 결과 공개 순서로 진행합니다.',
      tip: '힌트가 너무 정확하면 AI가 따라 쓸 수 있고, 너무 모호하면 내가 의심받을 수 있습니다.',
    },
  },
  {
    key: 'soso-code',
    icon: '🔐',
    title: '소소코드',
    desc: '상대의 비밀 4자리 코드를 질문(Hit·Blow)으로 추리합니다. AI 해커가 가짜 인텔을 흘리니 조심하세요.',
    status: '방 만들기',
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
    key: 'soso-deal',
    icon: '🎴',
    title: '소소딜',
    desc: '6종 자원 카드를 교환하고 세트를 완성해 최고 상인이 되세요. AI 브로커가 전략적으로 방해합니다.',
    status: '방 만들기',
    tag: '🤝 협상 거래',
    path: '/game/soso-deal',
    enabled: true,
    players: '2~5명',
    pace: '턴제 교환',
    hook: 'AI 브로커는 절대 손해 보는 거래를 하지 않습니다.',
    originalNote: '기존 보드게임 Bohnanza·Pit 규칙을 직접 쓰지 않고, 자원 종류·세트 점수·시장 교환 규칙을 독자적으로 설계합니다.',
    guide: {
      subtitle: '6종 자원 카드를 모아 세트를 제출하는 협상 거래 게임',
      goal: '6라운드 동안 시장 교환, 덱 드로우, 플레이어 거래로 자원을 수집해 세트(3장↑)를 제출하세요. 가장 높은 점수를 얻은 플레이어가 승리합니다.',
      flow: '카드 배분 → 내 턴에 시장교환/드로우/세트제출/거래제안 중 하나 선택 → 턴 종료 → 6라운드 후 점수 집계 순서로 진행합니다.',
      tip: 'AI 브로커는 세트 제출 → 유리한 시장 교환 → 드로우 순으로 행동합니다. 희귀 자원(금·보석)을 노려보세요.',
    },
  },
  {
    key: 'touch-king',
    icon: '👑',
    title: '터치왕게임',
    desc: '중앙판 12개와 내 판 12개 중 동시에 있는 같은 그림을 가장 빨리 터치하는 순발력 대결 게임입니다.',
    status: '방 만들기',
    tag: '👑 순발력',
    path: '/game/touch-king',
    enabled: true,
    players: '2~10명',
    pace: '빠른 터치',
    hook: '판수와 인원수를 정하고, 12개 그림 중 같은 그림을 가장 많이 빠르게 찾은 사람이 터치왕이 됩니다.',
    originalNote: '상업 카드게임 이름·카드 형태·심볼 세트를 쓰지 않고, 소소킹 전용 터치 대결 규칙과 UI로 운영합니다.',
    guide: {
      subtitle: '12개 그림 중 같은 그림을 가장 빨리 찾는 실시간 터치 대결',
      goal: '각 라운드마다 중앙판 12개와 내 판 12개에 동시에 있는 그림을 빠르게 찾아 점수를 얻습니다. 정해진 판수가 끝나면 점수가 가장 높은 사람이 우승합니다.',
      flow: '인원수/판수 선택 → 방 만들기 → 초대 링크 공유 → 참가자 입장 → 라운드 시작 → 같은 그림 터치 → 라운드 결과 → 최종 우승자 공개 순서로 진행합니다.',
      tip: '정답은 +100점이고, 남은 시간이 많을수록 보너스가 붙습니다. 오답은 감점됩니다.',
    },
  },
];

export const GAME_ROUTE_PREFIXES = GAMES.map(game => game.path).concat(['/game/symbol-spy']);

export function findGameByKey(key) {
  return GAMES.find(game => game.key === key) || null;
}

export function findGameByPath(path) {
  return GAMES.find(game => path === game.path || path.startsWith(`${game.path}/`)) || null;
}
