'use strict';

const PATCH_MARK = Symbol.for('sosoking.documentOutputQualityPatch');
const QUALITY_MARKER = '[소소킹 문서 완결성·번호 형식 규칙]';

const QUALITY_RULES = `${QUALITY_MARKER}
출력 직전에 다음 형식을 반드시 점검한다.
- reception, investigation, plaintiffArg, defendantArg, verdict의 모든 소제목과 문장을 끝까지 완성한다. 어떤 필드도 조사, 연결어, 따옴표 또는 미완성 문장으로 끝내지 않는다.
- 각 소제목의 본문은 핵심 내용 2~4문장으로 간결하게 작성한다. 같은 사실을 반복해 출력 한도를 낭비하지 않는다.
- 번호 목록은 항목마다 반드시 새 줄에서 시작한다. 한 줄에 "1. ... 2. ..."처럼 둘 이상의 번호를 이어 쓰지 않는다.
- 특히 verdict의 주문은 반드시 "주문\\n1. 첫 번째 내용\\n2. 두 번째 내용" 구조로 작성하고, JSON 문자열 안에서도 번호 사이에 실제 줄바꿈 문자(\\n)를 넣는다.
- 번호와 본문 사이에는 공백을 두고, 형식은 정확히 "1. 내용"으로 쓴다. 소수점, 날짜, K/D 수치는 목록 번호로 취급하지 않는다.
- JSON에는 기존 여섯 키만 출력하며, 내부 계획이나 점검 결과는 출력하지 않는다.
- 최종 JSON을 닫기 전에 여섯 필드가 모두 완전한 문장으로 끝나는지 다시 확인한다.`;

function isCourtDocumentPrompt(text) {
  const source = String(text || '');
  return source.includes('소소킹 판결소')
    && source.includes('reception')
    && source.includes('investigation')
    && source.includes('plaintiffArg')
    && source.includes('defendantArg')
    && source.includes('verdict');
}

function applyDocumentQuality(payload) {
  let changed = false;
  const contents = Array.isArray(payload?.contents) ? payload.contents : [];

  for (const content of contents) {
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      if (typeof part?.text !== 'string' || !isCourtDocumentPrompt(part.text)) continue;
      if (!part.text.includes(QUALITY_MARKER)) {
        part.text = `${part.text}\n\n${QUALITY_RULES}`;
        changed = true;
      }
    }
  }

  if (changed) {
    payload.generationConfig = { ...(payload.generationConfig || {}) };
    const currentLimit = Number(payload.generationConfig.maxOutputTokens || 0);
    payload.generationConfig.maxOutputTokens = Math.max(currentLimit, 6144);
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
      if (!applyDocumentQuality(payload)) return originalFetch(input, init);
      return originalFetch(input, { ...init, body: JSON.stringify(payload) });
    } catch (error) {
      console.warn('sosoking document quality patch skipped:', error?.message || error);
      return originalFetch(input, init);
    }
  };
  globalThis[PATCH_MARK] = true;
}

module.exports = {
  QUALITY_MARKER,
  QUALITY_RULES,
  applyDocumentQuality,
  isCourtDocumentPrompt
};
