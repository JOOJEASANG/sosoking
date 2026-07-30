'use strict';

const PATCH_MARK = Symbol.for('sosoking.humorPromptPatch');
const HUMOR_MARKER = '[소소킹 코미디 방향: 상황 자체가 재미있게]';

const HUMOR_RULES = `${HUMOR_MARKER}
이 서비스의 목표는 법원 문서처럼 진지하게 읽히면서도, 사건의 구체적인 상황과 당사자의 행동 때문에 독자가 여러 번 피식 웃게 만드는 것이다.
단순히 웃긴 단어를 붙이지 말고 사용자가 말한 물건·행동·시간·순서·말투·기대와 실제 결과의 차이를 충분히 펼쳐 쓴다.
전체 흐름은 가능하면 '평범한 시작 → 예상 밖 행동 → 남은 흔적 확인 → 변명과 증거의 충돌 → 판결에서 앞선 장면을 회수하는 결말'이 되게 한다.

구체성과 분량 원칙:
- 사건 내용에 나온 핵심 물건, 행동, 장소, 시간, 당사자의 표현 중 확인 가능한 세부사항을 3개 이상 골라 문서 전체에 서로 다른 방식으로 활용한다.
- 접수취지처럼 짧아야 하는 부분을 제외하면 각 소제목은 보통 2~4문장으로 작성해 사건의 전후 사정과 당사자의 입장이 충분히 보이게 한다.
- 수사보고의 진술 검토와 판결의 판단이유는 특히 구체적으로 작성한다. 무엇을 기대했고, 실제로 무엇이 벌어졌으며, 어떤 말이나 행동이 앞뒤가 맞지 않는지 독자가 장면을 그릴 수 있게 한다.
- 사용자가 짧게 입력했더라도 같은 말을 늘여 쓰지 말고, 확인 가능한 사실의 순서·의미·모순을 세분해 설명한다. 사용자가 말하지 않은 새 사실은 만들어 확정하지 않는다.

유머의 밀도와 방식:
- 수사보고, 원고측 변론, 피고측 변론, 재판부 판결에는 사건에 맞는 재치 있는 문장이 각각 자연스럽게 한두 번 나타나도록 한다.
- 웃음은 건조한 공문서 문체와 사소한 사건의 대비, 지나치게 진지한 사실 확인, 기대와 현실의 낙차, 피고의 변명이 스스로 흔들리는 순간, 앞 장면을 되받아치는 판결문에서 만든다.
- 한 문단을 전부 농담으로 채우지 않는다. 사실 설명 두세 문장 사이에 정확히 맞는 재치 한 문장을 배치해 진지함과 웃김이 동시에 살아나게 한다.
- 같은 비유, 같은 말장난, 같은 결론 문구를 반복하지 않는다. 판사 유형에 따라 관찰 방식과 마무리 문체가 뚜렷하게 달라져야 한다.
- 드립형만 웃기고 나머지 판사가 밋밋해지지 않게 한다. 모든 판사가 웃기되 엄벌주의형은 과도하게 엄숙해서, 감성형은 서운함을 세밀하게 다뤄서, 현실주의형은 지나치게 실용적이어서, 과몰입형은 비장해서, 피곤형은 건조한 한숨 때문에, 논리집착형은 사소한 모순을 집요하게 계산해서 웃기게 한다.

가장 중요한 작성 원칙:
- 결과문 안에 '웃음 포인트', '유머', '드립', '여기서 웃긴 점' 같은 해설 문구를 절대 쓰지 않는다. 독자가 설명 없이 상황을 읽고 웃을 수 있어야 한다.
- 인터넷 유행어, 억지 신조어, 뜬금없는 밈, 사건과 무관한 연예인·방송·영화 비유로 웃기려 하지 않는다.
- 다른 사건에도 그대로 붙일 수 있는 문장은 버리고, 사용자가 말한 핵심 사물과 행동에만 붙을 수 있는 문장을 쓴다.
- 사용자가 말하지 않은 사실은 새로 만들어 확정하지 않는다. 필요한 경우 '정황상', '기록에 따르면', '피고 측 주장에 의하면'처럼 한계를 분명히 한다.
- '사물이 묵비권을 행사했다', '빈자리가 증언했다', '증거번호를 받았다', 막연한 '간식권·리모컨권 침해' 같은 상투적 표현은 사건의 핵심과 정확히 맞지 않으면 사용하지 않는다.
- 사람의 외모·정체성·약점은 조롱하지 않고, 선택한 행동과 그 결과, 타이밍의 어긋남, 진지한 문서 형식과 사소한 사건의 대비를 재미의 원천으로 삼는다.

문서별 역할:
- 사건접수(reception): 누가 무엇을 기대했고 어떤 행동 때문에 분쟁이 시작됐는지 핵심 장면을 선명하게 제시한다. 사소한 일을 정식 사건으로 접수하는 형식적 대비에서 첫 웃음을 만든다.
- 수사보고(investigation): 가장 구체적이고 재미있는 구간으로 만든다. 시간순서, 실제 남은 흔적, 당사자의 말과 행동 사이의 모순을 재구성하고, 사실 확인 문체가 지나치게 진지해서 웃기게 한다.
- 원고측 변론(plaintiffArg): 추상적인 권리 이름을 남발하지 말고 원고가 기대했던 장면, 망가진 순간, 이후의 불편이나 서운함을 구체적으로 설명한다. 원고의 다소 과한 진지함도 선의로 살린다.
- 피고측 변론(defendantArg): 처음에는 납득할 법한 변명을 제시하되, 앞서 나온 세부 증거나 자기 말 때문에 논리가 조금씩 흔들리게 한다. 피고를 바보로 만들지 말고 변명의 미묘한 빈틈에서 웃음을 만든다.
- 재판부 판결(verdict): 주문은 실제로 실행 가능한 생활형 처분으로 구체화한다. 판단이유에서는 사실과 책임을 또렷하게 정리하고, 재판부 의견에서는 앞 문서의 물건·말·행동을 새 문장으로 되받아쳐 만족스러운 결말을 만든다.

완성 후 스스로 확인한다.
1. 사건의 구체적인 장면이 머릿속에 그려지는가.
2. 수사보고부터 판결까지 자연스러운 웃긴 문장이 여러 번 등장하는가.
3. 웃긴 문장을 빼도 사실관계와 판단이 충분히 구체적인가.
4. 판결의 마지막 문장이 앞서 나온 장면을 새롭게 회수하는가.
5. 다른 사건에 복사해도 통할 상투적 문장이 남아 있지 않은가.`;

function isSosokingVerdictPrompt(text) {
  const source = String(text || '');
  return source.includes('소소킹 판결소')
    && source.includes('reception')
    && source.includes('investigation')
    && source.includes('plaintiffArg')
    && source.includes('defendantArg')
    && source.includes('verdict');
}

function appendHumorRules(payload) {
  let changed = false;
  const contents = Array.isArray(payload?.contents) ? payload.contents : [];
  for (const content of contents) {
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      if (typeof part?.text !== 'string') continue;
      if (!isSosokingVerdictPrompt(part.text) || part.text.includes(HUMOR_MARKER)) continue;
      part.text = `${part.text}\n\n${HUMOR_RULES}`;
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
      if (!appendHumorRules(payload)) return originalFetch(input, init);
      return originalFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch (error) {
      console.warn('sosoking humor prompt patch skipped:', error?.message || error);
      return originalFetch(input, init);
    }
  };
  globalThis[PATCH_MARK] = true;
}

module.exports = { HUMOR_RULES, appendHumorRules, isSosokingVerdictPrompt };
