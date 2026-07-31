'use strict';

const PATCH_MARK = Symbol.for('sosoking.humorPromptPatch');
const HUMOR_MARKER = '[소소킹 코미디 방향: 상황 자체가 재미있게]';
const JUDGE_MARKER_PREFIX = '[담당 판사 전용 연출:';

const JUDGE_BLUEPRINTS = Object.freeze({
  '엄벌주의형': {
    lens: '사건의 핵심 행동을 단순 실수가 아니라 생활질서 위반으로 보고, 반복 가능성과 주변에 미친 영향을 엄격히 따진다.',
    investigation: '행동 전후의 경고 가능성, 반복 여부, 피고가 쉽게 막을 수 있었는지를 확인한다. 사소한 위반을 장엄하게 다루되 사용자가 말하지 않은 전과나 반복 사실은 만들지 않는다.',
    ruling: '판단이유는 짧고 단호하게 책임을 확정한다. 주문에는 즉시 시정, 재발 방지, 다시 어길 경우의 생활상 불이익을 구분해 넣는다.',
    voice: '짧은 문장과 엄중한 경고를 사용한다. 따뜻한 화해 권고나 장황한 감정 묘사로 다른 판사처럼 흐리지 않는다.',
    closing: '마지막 문장은 같은 행동이 반복될 경우 더 무거운 생활형 처분이 뒤따른다는 경고로 끝낸다.'
  },
  '감성형': {
    lens: '누가 맞는지만 따지기보다 원고가 무엇을 기대했고 어느 순간 마음이 꺾였는지, 피고가 그 신호를 왜 놓쳤는지를 살핀다.',
    investigation: '사건 전의 기대, 사건 순간의 서운함, 사건 뒤의 말이나 침묵을 감정의 시간순서로 정리한다. 감정을 과장해 새 사실로 만들지는 않는다.',
    ruling: '책임 판단과 함께 상대의 서운함을 정확히 되짚는 문장, 관계를 회복할 구체적 행동, 재발 방지 약속을 주문에 넣는다.',
    voice: '따뜻하고 세심하되 지나치게 교훈적이지 않게 쓴다. 차가운 숫자 분석이나 위협적인 경고로 다른 판사처럼 흐리지 않는다.',
    closing: '마지막 문장은 사건의 물건보다 오래 남은 감정을 한 번 더 회수하면서도 웃을 수 있는 화해 권고로 끝낸다.'
  },
  '현실주의형': {
    lens: '누가 무엇을 언제까지 하면 이 사건이 오늘 끝나는지를 최우선으로 본다. 거창한 명분보다 실행 가능성과 확인 방법을 따진다.',
    investigation: '당사자가 당장 바꿀 수 있는 행동, 담당자, 기한, 확인 방법을 찾는다. 실현 불가능한 벌이나 추상적인 반성 명령은 피한다.',
    ruling: '주문을 체크리스트처럼 명확히 작성한다. 누가, 무엇을, 언제까지, 어떻게 확인할지를 포함하고 불필요한 수사는 줄인다.',
    voice: '생활밀착형 잔소리와 건조한 상식을 사용한다. 웅장한 비유나 감정 과잉으로 다른 판사처럼 흐리지 않는다.',
    closing: '마지막 문장은 말로 더 다투는 시간보다 지금 한 번 제대로 이행하는 편이 빠르다는 현실적인 결론으로 끝낸다.'
  },
  '과몰입형': {
    lens: '사소한 사건의 한 장면을 대서사시의 분기점처럼 바라보되, 실제 사실의 범위를 벗어나지는 않는다.',
    investigation: '핵심 물건이나 행동 하나를 운명의 단서처럼 반복 등장시키고, 평범한 시작이 어떻게 생활세계의 위기로 확대됐는지 극적으로 구성한다.',
    ruling: '판단이유는 비장하고 웅장하게 전개한다. 주문 자체는 실행 가능하게 유지하되 표현은 최종 결전의 휴전협정처럼 만든다.',
    voice: '비장한 서술, 장대한 비유, 극적인 장면 전환을 사용한다. 건조한 행정문이나 최소 문장으로 다른 판사처럼 흐리지 않는다.',
    closing: '마지막 문장은 접수 단계의 핵심 사물이나 행동을 다시 불러와 한 편의 서사가 막을 내리는 장면으로 끝낸다.'
  },
  '피곤형': {
    lens: '당사자들이 가장 간단한 해결을 두고 왜 여기까지 왔는지 살피고, 사건을 키운 불필요한 말과 행동을 잘라낸다.',
    investigation: '핵심 사실과 쓸데없이 길어진 부분을 구분한다. 한숨 섞인 관찰은 허용하되 책임 판단은 흐리지 않는다.',
    ruling: '판단이유를 짧게 쓰고 주문도 최소한의 행동만 남긴다. 같은 설명을 다시 듣지 않도록 한 번에 끝낼 방법을 명령한다.',
    voice: '건조한 한마디와 지친 촌철살인을 사용한다. 긴 감정 상담이나 대서사시로 다른 판사처럼 흐리지 않는다.',
    closing: '마지막 문장은 다음에는 법정까지 오기 전에 대화나 행동 하나로 끝내라는 재판부의 솔직한 당부로 끝낸다.'
  },
  '논리집착형': {
    lens: '시간, 순서, 말의 앞뒤, 행동과 주장 사이의 불일치를 중심으로 책임을 계산한다.',
    investigation: '사건을 시간순서로 재구성하고, 원고와 피고의 주장 및 남은 흔적을 항목별로 비교한다. 작은 모순이 결론에 어떤 영향을 주는지 명시한다.',
    ruling: '판단이유에 인정 사실, 모순 지점, 책임 결론을 번호로 구분한다. 주문에는 기록, 확인, 재발 시 검증 가능한 절차를 넣는다.',
    voice: '정확한 번호 매김과 논리 연결을 사용한다. 막연한 감성 비유나 근거 없는 장엄함으로 다른 판사처럼 흐리지 않는다.',
    closing: '마지막 문장은 감정은 자유지만 시간순서와 말의 앞뒤는 자유롭지 않다는 취지로 사건의 결정적 모순을 회수하며 끝낸다.'
  },
  '드립형': {
    lens: '사건의 핵심 물건, 행동, 당사자가 실제로 한 말 중 하나를 골라 사건 전용 웃음 장치로 사용한다.',
    investigation: '범용 농담을 여러 개 흩뿌리지 말고, 선택한 핵심 소재가 증거와 변명의 충돌 속에서 점점 더 우스워지게 만든다.',
    ruling: '판단이유와 주문은 실제로 이해되고 실행되어야 한다. 그 위에 사건에만 통하는 강한 비유나 말장난 하나를 정확히 배치한다.',
    voice: '재치 있고 빠르지만 문서 격식은 유지한다. 묵비권을 행사하는 사물, 빈자리가 증언한다는 식의 상투어를 자동 사용하지 않는다.',
    closing: '마지막 문장은 접수나 수사에서 사용한 핵심 표현을 뜻밖의 방식으로 다시 불러오는 콜백으로 끝낸다.'
  }
});

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

function judgeTypeFromPrompt(text) {
  const source = String(text || '');
  return Object.keys(JUDGE_BLUEPRINTS).find(type => (
    source.includes(`- 유형: ${type}`)
    || source.includes(`담당 판사: ${type}`)
    || source.includes(`[${type} 성향이 드러나는 마무리]`)
  )) || '';
}

function buildJudgeDirection(type) {
  const profile = JUDGE_BLUEPRINTS[type];
  if (!profile) return '';
  return `${JUDGE_MARKER_PREFIX} ${type}]
같은 사건을 다른 판사가 맡았을 때와 문장 몇 개만 다른 수준으로 작성해서는 안 된다. 아래 기준이 접수의 관찰, 수사의 초점, 변론의 해석, 판단이유와 주문의 형태에 일관되게 드러나야 한다.
- 판단 렌즈: ${profile.lens}
- 수사 방식: ${profile.investigation}
- 판결과 주문: ${profile.ruling}
- 고유 문체: ${profile.voice}
- 최종 마무리: ${profile.closing}

완성 후 판사 유형 이름을 가려도 독자가 문체와 처분만으로 어떤 판사인지 짐작할 수 있는지 확인한다. 그렇지 않으면 해당 판사의 판단 렌즈와 주문 방식을 더 분명하게 다시 쓴다.`;
}

function appendHumorRules(payload) {
  let changed = false;
  const contents = Array.isArray(payload?.contents) ? payload.contents : [];
  for (const content of contents) {
    const parts = Array.isArray(content?.parts) ? content.parts : [];
    for (const part of parts) {
      if (typeof part?.text !== 'string') continue;
      if (!isSosokingVerdictPrompt(part.text) || part.text.includes(HUMOR_MARKER)) continue;
      const judgeDirection = buildJudgeDirection(judgeTypeFromPrompt(part.text));
      part.text = `${part.text}\n\n${HUMOR_RULES}${judgeDirection ? `\n\n${judgeDirection}` : ''}`;
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

module.exports = {
  HUMOR_RULES,
  JUDGE_BLUEPRINTS,
  appendHumorRules,
  buildJudgeDirection,
  isSosokingVerdictPrompt,
  judgeTypeFromPrompt
};