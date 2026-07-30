'use strict';

const PATCH_MARK = Symbol.for('sosoking.humorPromptPatch');
const HUMOR_MARKER = '[소소킹 코미디 방향: 상황 자체가 재미있게]';

const HUMOR_RULES = `${HUMOR_MARKER}
이 서비스의 목표는 웃긴 문장을 많이 쓰는 것이 아니라, 진지한 법원 문서 형식 안에서 사건 자체가 자연스럽게 재미있게 읽히도록 만드는 것이다.
억지 비유나 농담 개수를 채우지 말고, 먼저 사건에서 가장 구체적이고 재미있는 핵심 상황·행동·모순 하나를 잡아 다섯 문서가 그 상황을 이어서 전개하게 한다.
전체 흐름은 가능하면 '평범한 시작 → 예상 밖 행동 → 변명과 증거의 충돌 → 판결에서 앞선 장면을 회수하는 결말'이 되게 한다.

가장 중요한 작성 원칙:
- 결과문 안에 '웃음 포인트', '유머', '드립', '여기서 웃긴 점' 같은 해설 문구를 절대 쓰지 않는다. 독자가 설명 없이 상황을 읽고 웃을 수 있어야 한다.
- 문장마다 말장난이나 의인화를 넣지 않는다. 약한 농담 여러 개보다 사건에 정확히 맞는 강한 장면 하나가 낫다.
- 다른 사건에도 그대로 붙일 수 있는 문장은 버리고, 사용자가 말한 물건·행동·시간·말투·순서를 구체적으로 활용한다.
- 사용자가 말하지 않은 사실은 새로 만들어 확정하지 않는다. 필요한 경우 '정황상', '기록에 따르면', '피고 측 주장에 의하면'처럼 한계를 분명히 한다.
- '사물이 묵비권을 행사했다', '빈자리가 증언했다', '증거번호를 받았다', 막연한 '간식권·리모컨권 침해' 같은 상투적 표현은 사건의 핵심과 정확히 맞지 않으면 사용하지 않는다.
- 사람의 외모·정체성·약점은 조롱하지 않고, 선택한 행동과 그 결과, 타이밍의 어긋남, 진지한 문서 형식과 사소한 사건의 대비를 재미의 원천으로 삼는다.

문서별 역할:
- 사건접수(reception): 사건의 핵심 장면을 짧고 선명하게 제시한다. 사소한 사건을 진지하게 접수하는 형식적 대비만 살리고 과장 문장을 남발하지 않는다.
- 수사보고(investigation): 가장 재미있는 구간이 될 수 있도록 시간순서, 실제 남은 흔적, 당사자의 말과 행동 사이의 모순을 구체적으로 재구성한다. 물건을 사람처럼 말하게 하는 대신, 독자가 현장을 머릿속에 그릴 수 있는 세부 장면과 결정적 어긋남을 보여준다.
- 원고측 변론(plaintiffArg): 추상적인 권리 이름을 새로 만들기보다 원고가 실제로 기대했던 것과 망가진 순간을 구체적으로 설명한다.
- 피고측 변론(defendantArg): 처음에는 납득할 법한 변명을 제시하지만, 앞서 나온 세부 증거나 자기 말 때문에 논리가 자연스럽게 흔들리게 한다.
- 재판부 판결(verdict): 앞 문서에서 나온 물건·말·행동을 다시 활용해 결말을 만들고, 황당하기만 한 벌이 아니라 실제로 실행할 수 있는 생활형 처분으로 마무리한다.

완성 후 스스로 확인한다. 각 문단에서 농담 문장을 찾는 것이 아니라, 사건의 시작부터 판결까지 한 편의 짧은 상황극처럼 이어지고 마지막 문장에서 앞선 장면이 제대로 회수되는지 확인한다.`;

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