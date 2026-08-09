'use strict';

const PATCH_MARK = Symbol.for('sosoking.fiveStageTopicComedyPatch');
const MARKER = '[소소킹 범용 주제해석·5단계 코미디 보강]';

const RULES = `${MARKER}
이 규칙은 특정 게임이나 특정 사건유형 전용이 아니다. 사용자가 접수한 한 문장을 먼저 '무슨 세계의 사건인지' 이해한 뒤 그 세계의 구체적인 행동·용어·관습을 웃음의 재료로 사용한다.

[1. 주제부터 파악]
- 작성 전에 사건의 주제영역을 내부적으로 한 번 분류한다. 예: 게임, 음식, 직장, 가족, 연애·친구, 학교, 스포츠, 쇼핑·배달, IT·기기, 자동차·교통, 반려동물, 여행, 집안일, 취미 등.
- 분류명 자체는 출력하지 않는다. 대신 해당 영역에서 실제로 중요한 행동, 순서, 역할, 기대, 물건, 용어를 사건 해석에 반영한다.
- 사용자가 말한 고유명사·상품명·게임명·서비스명·취미명이 핵심이면 일반적인 생활분쟁 문구로 덮지 말고 그 대상의 특성을 먼저 이해한다.
- 잘 모르는 고유명사는 아는 척하며 세부설정을 만들지 않는다. 확실한 범위의 특성만 사용하고 나머지는 사용자가 준 사실에 머문다.

[2. 게임은 목록 제한 없이 문맥으로 인식]
- 게임 관련 문구가 있으면 기존 고정 프로필 목록에 있는 게임인지 여부와 관계없이 먼저 어떤 게임인지 내부적으로 판단한다.
- 게임 목록에 없어도 제목, 약칭, 플레이 행동, 팀·파티·랭크·레이드·매치·보스·사냥·강화·캐릭터·스킬 같은 주변 문맥을 함께 보고 게임 사건인지 판단한다.
- 해당 게임을 확실히 아는 경우 그 게임의 실제 승리조건, 팀플레이 구조, 자원관리, 시간압박, 역할분담, 대표 용어 중 사건과 맞는 것만 2~4개 선택한다.
- 게임 용어는 장식처럼 나열하지 말고 원고 주장, 피고 변명, 수사 가상재연, 판결 주문 중 실제 의미가 맞는 위치에서만 쓴다.
- 최신 패치, 수치, 특정 아이템·캐릭터 세부를 확신하지 못하면 만들지 않는다. 사용자가 말하지 않은 랭크, 킬 수, 점수, 경기시간도 사실처럼 추가하지 않는다.

[3. 다섯 단계는 모두 재미있어야 한다]
다섯 결과 중 어느 하나도 단순 설명문이나 앞 단계 요약으로 끝나면 안 된다. 각 단계는 서로 다른 방식의 '상황 코미디 보상'을 하나 이상 가져야 한다. 이것은 억지 농담 개수를 채우라는 뜻이 아니라, 해당 단계만 읽어도 사건의 특성에서 나온 재미있는 관찰·충돌·반전이 있어야 한다는 뜻이다.

1막 reception 사건접수:
- 비교적 짧고 진지하게 시작하되, 평범한 기대가 깨진 정확한 순간과 이 사건만의 건조한 대비를 하나 심는다.
- 마지막 판결에서 다시 쓸 핵심 물건·말·게임용어·행동을 여기서 자연스럽게 등장시킨다.

2막 investigation 수사보고:
- 다섯 단계 중 가장 크게 웃길 수 있는 구간이다.
- 사소한 사건을 대형사건처럼 다루는 현장보존, 동선분석, 가상 재연, 포렌식 검토, 정황 교차검증, 대책회의를 사건 특성에 맞게 과잉 진지하게 적용한다.
- 입력에 없는 증거는 발견했다고 쓰지 말고 가상 재연·검토·시뮬레이션·자료 없음으로 구분한다.

3막 plaintiffArg 원고측 변론:
- 단순히 '억울하다'고 반복하지 않는다. 원고가 원래 기대했던 너무 평범한 결과와 실제 결과의 차이를 사건 고유의 말로 정색하고 주장하게 한다.
- 진지한 청구 논리 자체가 사소한 사건 규모와 대비되어 웃기게 만든다. 수사 단계에서 나온 핵심 소재를 원고에게 유리한 의미로 한 번 비튼다.

4막 defendantArg 피고측 변론:
- 실제 사람이 할 법한 가장 그럴듯한 변명으로 시작한다.
- 그 변명이 사용자의 사실, 시간순서, 게임 규칙, 물건의 상태, 혹은 자기 말 때문에 조금씩 스스로 불리해지는 '셀프 역전'을 만든다.
- 피고를 바보로 조롱하지 말고 말은 그럴듯한데 결론이 묘하게 불리해지는 데서 웃음이 나게 한다.

5막 verdict 재판부 판결:
- 주문 자체가 이 사건에만 가능한 생활형 처분이어야 한다. 범용 사과명령으로 끝내지 않는다.
- 앞 단계의 핵심 소재나 표현을 재판부가 전혀 다른 법정 언어로 되받아쳐 가장 강한 콜백을 만든다.
- 마지막 두 문장은 사건명만 바꿔 다른 사건에 붙일 수 없어야 하며, 처음 장면을 다시 떠올리면 더 웃겨야 한다.

[4. 반복 방지]
- 다섯 단계가 같은 농담을 표현만 바꿔 반복하지 않게 한다.
- 접수는 건조한 대비, 수사는 과잉 절차, 원고는 지나치게 진지한 피해논리, 피고는 그럴듯한 셀프 역전, 판결은 맞춤형 처분과 콜백처럼 웃음 방식 자체를 달리한다.
- 아재개그나 동음이의어는 자연스럽게 맞을 때만 0~2개 사용한다. 주제 이해보다 말장난이 앞서면 버린다.

완성 후 내부적으로 확인한다: reception, investigation, plaintiffArg, defendantArg, verdict 각각에 이 사건에서만 가능한 재미있는 장면 또는 관찰이 있는가. 하나라도 평범한 설명으로 끝났다면 해당 단계를 사건의 실제 주제와 세부에 맞춰 다시 쓴다.`;

function isVerdictPrompt(text) {
  const source = String(text || '');
  return source.includes('reception')
    && source.includes('investigation')
    && source.includes('plaintiffArg')
    && source.includes('defendantArg')
    && source.includes('verdict')
    && (source.includes('소소킹') || source.includes('생활사건') || source.includes('[사건 내용]'));
}

function appendFiveStageTopicRules(payload) {
  let changed = false;
  const contents = Array.isArray(payload?.contents) ? payload.contents : [];
  for (const content of contents) {
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      if (typeof part?.text !== 'string') continue;
      if (!isVerdictPrompt(part.text) || part.text.includes(MARKER)) continue;
      part.text = `${part.text}\n\n${RULES}`;
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
      if (!appendFiveStageTopicRules(payload)) return originalFetch(input, init);
      return originalFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch (error) {
      console.warn('sosoking five-stage topic comedy patch skipped:', error?.message || error);
      return originalFetch(input, init);
    }
  };
  globalThis[PATCH_MARK] = true;
}

module.exports = {
  MARKER,
  RULES,
  isVerdictPrompt,
  appendFiveStageTopicRules
};
