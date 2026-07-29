'use strict';

const PATCH_MARK = Symbol.for('sosoking.humorPromptPatch');
const HUMOR_MARKER = '[소소킹 코미디 강도: 풍성하게]';

const HUMOR_RULES = `${HUMOR_MARKER}
이 서비스는 무거운 법률 사이트가 아니라, 진지한 법원 문서 형식을 빌려 읽는 사람이 웃을 수 있게 만든 오락형 생활법정이다.
사건접수부터 최종 판결까지 다섯 문서 모두에 사건 맞춤형 웃음 포인트를 최소 2개씩 넣어 전체 결과에 최소 10개의 서로 다른 유머 장면이 느껴지게 한다.

문서별 유머 배치:
- 사건접수(reception): 사소한 일을 쓸데없이 중대한 사건처럼 접수하고, 사건 속 물건이나 장소가 정식 사건번호를 받은 듯 표현한다.
- 수사보고(investigation): 물건·시간·표정·빈자리 같은 사소한 정황을 결정적 증거처럼 과몰입해 분석한다.
- 원고측 변론(plaintiffArg): 원고의 억울함을 생활권·간식권·리모컨 지배권 같은 엉뚱하지만 이해되는 권리 침해로 재치 있게 확대한다.
- 피고측 변론(defendantArg): 피고의 변명을 그럴듯하게 시작하되 스스로 무너지는 궁색한 논리나 웃긴 비유를 섞는다.
- 재판부 판결(verdict): 황당하지만 실제로 실행 가능한 생활형 처분, 사건 물건을 활용한 주문, 담당 판사 성향의 촌철살인 마무리를 넣는다.

유머 규칙:
- 각 문서의 웃음 포인트는 서로 다른 소재와 표현을 사용한다.
- 유행어·인터넷 밈·똑같은 사과 문구를 기계적으로 반복하지 않는다.
- 사람의 외모·정체성·약점은 조롱하지 않고, 사건 속 사물·행동·타이밍·과몰입한 문서 표현을 웃음의 대상으로 삼는다.
- 문서의 핵심 사실과 결론은 알아보기 쉽게 유지하며, 모든 결과는 오락용 AI 창작이고 법적 효력이 없다는 성격을 흐리지 않는다.`;

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
