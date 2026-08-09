'use strict';

const PATCH_MARK = Symbol.for('sosoking.comedyTopicContextPatch');
const CONTEXT_MARKER = '[소소킹 사건별 코미디 DNA·주제 컨텍스트]';

const GAME_PROFILES = Object.freeze([
  {
    id: 'pubg',
    name: '배틀그라운드',
    aliases: /배틀\s*그라운드|배그|PUBG/i,
    mechanics: '생존 경쟁, 낙하 후 파밍, 줄어드는 자기장, 솔로·듀오·스쿼드 협동, 마지막 생존과 최종 승리',
    terms: [
      '치킨: 최종 승리나 사건의 마지막 보상을 비유할 때',
      '뚝배기: 헬멧·머리 관련 게임 은어가 실제 맥락에 있을 때만',
      '자기장: 시간이 줄거나 선택지가 좁아지는 압박을 비유할 때',
      '파밍: 아이템·장비·자료를 모으는 행동을 비유할 때',
      '존버: 숨어 버티거나 끝까지 기다리는 상황에만',
      '보급: 예상 밖의 귀한 물건이나 결정적 기회를 비유할 때',
      '스쿼드: 팀원 간 합류·협력·책임 분담을 다룰 때'
    ]
  },
  {
    id: 'lol',
    name: '리그 오브 레전드',
    aliases: /리그\s*오브\s*레전드|롤(?!백)|LOL\b/i,
    mechanics: '라인 운영, 정글 동선, 갱킹, 와드 시야, 오브젝트, 한타, 포지션별 역할과 팀 합류',
    terms: [
      '라인: 맡은 구역이나 본인 역할을 비유할 때',
      '정글: 직접 보이지 않는 중간 동선이나 개입을 비유할 때',
      '갱: 예상 밖의 개입이나 끼어들기를 비유할 때',
      '와드: 미리 확인하거나 감시하는 장치를 비유할 때',
      '한타: 여러 사람이 한꺼번에 얽힌 최종 충돌을 비유할 때',
      '바론·용: 모두가 탐내는 핵심 목표가 실제 문맥과 맞을 때',
      'CS: 사소한 누적 수치나 놓친 몫을 세는 장면에만'
    ]
  },
  {
    id: 'valorant',
    name: '발로란트',
    aliases: /발로란트|VALORANT/i,
    mechanics: '공격·수비 전환, 사이트 진입, 스파이크 설치·해체, 스킬 연계, 클러치와 에이스',
    terms: [
      '스파이크: 모두가 신경 쓰는 핵심 대상이 있을 때',
      '사이트: 특정 장소나 담당 구역을 말할 때',
      '클러치: 불리한 상황을 혼자 뒤집는 장면에만',
      '에이스: 혼자 전부 해결했다는 과장에만',
      '세이브: 다음 상황을 위해 자원을 아끼는 선택에만',
      '궁: 결정적 수단을 너무 일찍 또는 너무 늦게 쓴 상황을 비유할 때'
    ]
  },
  {
    id: 'overwatch',
    name: '오버워치',
    aliases: /오버워치|OVERWATCH/i,
    mechanics: '역할 조합, 거점 점령, 화물 운송, 궁극기 연계, 팀 합류와 리스폰 타이밍',
    terms: [
      '거점: 모두가 지켜야 하는 장소나 쟁점을 비유할 때',
      '화물: 계속 밀거나 옮겨야 하는 대상이 있을 때',
      '힐: 누군가 뒤처진 상황을 복구하는 행동에만',
      '궁: 결정적 카드나 최후 수단을 비유할 때',
      '리스폰: 실패 뒤 다시 돌아오는 반복 상황을 비유할 때',
      '조합: 사람마다 역할이 갈린 사건에서만'
    ]
  },
  {
    id: 'minecraft',
    name: '마인크래프트',
    aliases: /마인\s*크래프트|마크(?!다운)|MINECRAFT/i,
    mechanics: '채집과 제작, 블록 건축, 크리퍼 돌발상황, 광물 탐색, 레드스톤 장치, 네더·엔드 탐험',
    terms: [
      '크리퍼: 조용히 다가와 일을 터뜨리는 돌발상황에만',
      '다이아: 유난히 귀하게 여기는 물건이나 성과를 비유할 때',
      '곡괭이: 반복적인 작업이나 채집을 비유할 때',
      '레드스톤: 지나치게 복잡한 자동화나 연결구조를 비유할 때',
      '네더: 평범한 문제를 해결하려다 더 험한 단계로 들어간 상황에만',
      '인벤토리: 물건·자료가 너무 많이 쌓인 상황에만'
    ]
  },
  {
    id: 'maplestory',
    name: '메이플스토리',
    aliases: /메이플\s*스토리|메이플(?! 시럽)|MAPLESTORY/i,
    mechanics: '레벨업과 성장, 사냥터, 보스, 장비 강화, 메소, 직업별 역할과 반복 파밍',
    terms: [
      '레벨업: 일이 단계적으로 커지거나 숙련도가 올라가는 상황에만',
      '보스: 최종 난관이나 가장 까다로운 당사자를 비유할 때',
      '강화: 이미 충분한 일을 굳이 더 키우는 상황에만',
      '메소: 비용·보상·정산을 가볍게 비유할 때',
      '사냥터: 반복적으로 같은 일이 벌어지는 장소에만',
      '파밍: 재료나 자료를 계속 모으는 행동에만'
    ]
  },
  {
    id: 'lostark',
    name: '로스트아크',
    aliases: /로스트\s*아크|로아(?!웃)|LOST\s*ARK/i,
    mechanics: '파티 레이드, 기믹 수행, 역할 분담, 장비 성장, 카오스 던전과 보스 공략',
    terms: [
      '레이드: 여러 사람이 역할을 나눠 큰 일을 처리하는 상황에만',
      '기믹: 정해진 순서나 규칙을 지켜야 하는 상황에만',
      '트라이: 여러 번 실패하며 다시 시도하는 상황에만',
      '숙제: 반복해서 해야 하는 일상 의무를 비유할 때',
      '딜찍: 복잡한 절차를 힘으로 빨리 끝냈다는 과장에만',
      '파티: 공동 책임이나 역할 분담을 말할 때'
    ]
  },
  {
    id: 'starcraft',
    name: '스타크래프트',
    aliases: /스타\s*크래프트|스타1|스타2|STARCRAFT/i,
    mechanics: '자원 채취, 빌드오더, 정찰, 멀티 확장, 타이밍 공격, 종족별 운영',
    terms: [
      '빌드: 사건 초반의 계획이나 정해진 순서를 비유할 때',
      '정찰: 상대 행동을 미리 확인하는 장면에만',
      '멀티: 일을 한 군데서 끝내지 못하고 범위를 넓힌 상황에만',
      '러시: 너무 빠른 개입이나 성급한 행동에만',
      '미네랄: 부족한 자원이나 예산을 가볍게 비유할 때',
      'GG: 정말 끝난 장면의 짧은 콜백에만'
    ]
  },
  {
    id: 'fc',
    name: 'FC·FIFA 계열',
    aliases: /FC\s*온라인|피파\s*온라인|FIFA|피파\b/i,
    mechanics: '포메이션, 패스 연결, 역습, 세트피스, 골 결정력, 추가시간과 승부',
    terms: [
      '추가시간: 이미 끝날 일이 계속 늘어지는 상황에만',
      '역습: 상대의 주장 때문에 오히려 본인이 불리해진 상황에만',
      'VAR: 작은 장면을 반복 검토하는 과잉 수사 비유에만',
      '골 결정력: 마지막 한 번을 못 끝내는 상황에만',
      '포메이션: 사람마다 역할과 위치가 정해진 상황에만',
      '세트피스: 미리 정한 절차나 약속을 실행하는 장면에만'
    ]
  }
]);

const BASE_COMEDY_DIRECTION = `${CONTEXT_MARKER}
이 결과는 '농담을 많이 하는 글'보다 '공문서가 지나치게 진지해서 웃긴 글'을 목표로 한다.
작성 전에 출력하지 않는 내부 코미디 설계를 먼저 만든다: ① 사건의 핵심 모순 1개 ② 끝까지 반복할 소재·표현 1개 ③ 단계가 갈수록 커지는 확대 규칙 1개 ④ 판결 마지막에 회수할 콜백 1개.

코미디 강도와 배치:
- 사건접수는 비교적 담담하게 시작한다. 처음부터 모든 문장을 웃기려고 하지 않는다.
- 수사보고가 가장 웃겨야 한다. 사소한 사건에 현장보존, 동선 재구성, 감식 검토, 디지털 포렌식 검토, 상황 재연, 대책회의 같은 대형사건 절차를 무표정하게 적용한다.
- 입력에 없는 증거를 실제 발견 사실처럼 만들지 않는다. 대신 '수사팀의 가상 재연에서는', '가능성을 검토한 결과', '시뮬레이션상', '감식 의뢰를 검토했으나 자료가 없어 보류'처럼 가상·검토·부재임을 명시하면 웃긴 가상 시나리오를 만들 수 있다.
- 원고와 피고는 같은 물건·말·게임용어를 서로 반대 의미로 해석하게 하여 공방을 만든다.
- 판결은 앞서 반복한 소재를 주문 또는 재판부 의견에서 뜻밖의 방식으로 다시 불러 끝낸다. 마지막 두 문장이 가장 강한 콜백이어야 한다.
- 아재개그·동음이의 말장난은 전체 결과에서 0~2개만 허용한다. 자연스럽게 떠오르지 않으면 쓰지 않는다. 설명이 필요한 말장난은 버린다.
- 웃기다는 설명, 웃음 표시, '여기서 드립' 같은 메타 문구는 출력하지 않는다.
- 비슷한 사건에 이름만 바꿔 붙일 수 있는 범용 농담보다 사용자의 실제 사물·행동·시간·게임 상황을 우선한다.`;

const GENERIC_GAME_DIRECTION = `
[게임 주제 처리]
사건 내용에 게임명이나 명확한 게임 상황이 있으면, 먼저 그 게임의 핵심 플레이 구조와 한국 이용자가 실제로 쓰는 대표 용어를 내부적으로 파악한다.
확실히 아는 용어만 3~5개 골라 사용하고, 의미가 불확실한 신조어·패치명·아이템명·캐릭터명은 만들어내지 않는다.
게임 용어는 문장 장식이 아니라 사건의 행동과 정확히 연결할 때만 쓴다. 한 문단에 여러 용어를 몰아넣지 말고 전체 결과에 분산한다.
게임의 승패·팀플레이·자원·시간압박 같은 특성을 수사 비유와 판결 콜백에 연결한다.
사용자가 말하지 않은 실제 플레이 기록, 킬 수, 랭크, 아이템 보유, 경기 시간은 사실처럼 추가하지 않는다. 필요하면 반드시 '가상 재연', '수사팀 가정', '예시 시뮬레이션'으로 표시한다.`;

function detectGameContext(text) {
  const source = String(text || '');
  for (const profile of GAME_PROFILES) {
    if (profile.aliases.test(source)) return profile;
  }
  if (/(게임|게이머|랭크|티어|매치|큐를?\s*돌|파티|길드|레이드|클랜|스쿼드|듀오|솔로큐|캐릭터|스킨|보스전)/i.test(source)) {
    return {
      id: 'generic-game',
      name: '명시된 게임',
      mechanics: '사용자가 언급한 게임의 실제 핵심 규칙과 플레이 흐름',
      terms: []
    };
  }
  return null;
}

function buildGameDirection(profile) {
  if (!profile) return '';
  const termBlock = profile.terms.length
    ? `\n고신뢰 용어 가이드:\n${profile.terms.map(term => `- ${term}`).join('\n')}`
    : '\n게임 고유 용어는 모델이 의미를 확실히 아는 것만 선택한다.';
  return `\n[감지된 게임 컨텍스트: ${profile.name}]\n핵심 특성: ${profile.mechanics}.${termBlock}\n이 목록을 체크리스트처럼 전부 쓰지 않는다. 사건과 맞는 2~4개만 골라 자연스럽게 흩어 쓰고, 하나는 판결의 마지막 콜백 후보로 남겨둔다.`;
}

function buildComedyDirection(text) {
  const game = detectGameContext(text);
  return `${BASE_COMEDY_DIRECTION}${game ? `${GENERIC_GAME_DIRECTION}${buildGameDirection(game)}` : ''}`;
}

function isVerdictPrompt(text) {
  const source = String(text || '');
  return source.includes('investigation')
    && source.includes('plaintiffArg')
    && source.includes('defendantArg')
    && source.includes('verdict')
    && (source.includes('소소킹') || source.includes('생활사건') || source.includes('[사건 내용]'));
}

function appendComedyContextRules(payload) {
  let changed = false;
  const contents = Array.isArray(payload?.contents) ? payload.contents : [];
  for (const content of contents) {
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      if (typeof part?.text !== 'string') continue;
      if (!isVerdictPrompt(part.text) || part.text.includes(CONTEXT_MARKER)) continue;
      part.text = `${part.text}\n\n${buildComedyDirection(part.text)}`;
      changed = true;
    }
  }
  return changed;
}

if (!globalThis[PATCH_MARK] && typeof globalThis.fetch === 'function') {
  const originalFetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = async (input, init = {}) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : String(input?.url || '');
    if (!url.includes('generativelanguage.googleapis.com') || typeof init?.body !== 'string') {
      return originalFetch(input, init);
    }
    try {
      const payload = JSON.parse(init.body);
      if (!appendComedyContextRules(payload)) return originalFetch(input, init);
      return originalFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch (error) {
      console.warn('sosoking comedy topic context patch skipped:', error?.message || error);
      return originalFetch(input, init);
    }
  };
  globalThis[PATCH_MARK] = true;
}

module.exports = {
  CONTEXT_MARKER,
  GAME_PROFILES,
  BASE_COMEDY_DIRECTION,
  GENERIC_GAME_DIRECTION,
  detectGameContext,
  buildGameDirection,
  buildComedyDirection,
  isVerdictPrompt,
  appendComedyContextRules
};
