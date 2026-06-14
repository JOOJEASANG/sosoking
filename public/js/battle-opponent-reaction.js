// battle-opponent-reaction.js
// 정치배틀 토론 멘트에 대해 상대 진영 반박과 재반박 힌트를 보여줍니다.

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function ensureStyle() {
  if (document.getElementById('battle-opponent-reaction-style')) return;
  const style = document.createElement('style');
  style.id = 'battle-opponent-reaction-style';
  style.textContent = `
    .battle-opponent-card{margin-top:10px;border:1px solid rgba(100,116,139,.2);border-radius:16px;background:linear-gradient(135deg,rgba(15,23,42,.05),rgba(255,255,255,.96));padding:12px;font-size:12px;color:var(--color-text-secondary)}
    .battle-opponent-card__head{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:8px}
    .battle-opponent-card__title{font-weight:1000;color:var(--color-text-primary)}
    .battle-opponent-card__tag{border-radius:999px;background:rgba(15,23,42,.08);padding:4px 8px;font-weight:900;color:var(--color-text-primary)}
    .battle-opponent-card__quote{border-left:3px solid var(--color-primary);padding:8px 9px;background:rgba(255,255,255,.75);border-radius:10px;line-height:1.55;color:var(--color-text-primary);font-weight:700}
    .battle-opponent-card__counter{margin-top:8px;line-height:1.55}
    .battle-opponent-card__actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
    .battle-opponent-card__actions button{border:1px solid rgba(100,116,139,.22);border-radius:999px;background:#fff;padding:8px 10px;font-family:inherit;font-weight:900;cursor:pointer;color:var(--color-text-primary)}
    @media(max-width:420px){.battle-opponent-card__actions button{width:100%}}
  `;
  document.head.appendChild(style);
}

function hasAny(text, words) {
  return words.some(w => text.includes(w));
}

function pickOpponentTone(text) {
  if (hasAny(text, ['복지', '지원금', '청년', '월세', '보조금', '무상'])) {
    return {
      tag: '재정 공격',
      quote: '좋은 말처럼 들리지만 결국 세금으로 메우겠다는 포퓰리즘 아닙니까?',
      counter: '재원과 우선순위를 같이 제시하면 포퓰리즘 공격을 막을 수 있습니다.',
      counterText: '재정 부담을 인정하되, 낭비 예산을 줄이고 효과가 큰 계층부터 단계적으로 시행하겠습니다.',
    };
  }
  if (hasAny(text, ['규제', '처벌', '단속', '금지', '통제'])) {
    return {
      tag: '자유 침해 공격',
      quote: '명분은 그럴듯하지만 시민 자유를 과도하게 제한하는 행정 편의주의입니다.',
      counter: '규제 목적과 보호 장치를 함께 말하면 방어력이 올라갑니다.',
      counterText: '규제는 최소한으로 두고, 시민 피해를 막기 위한 기준과 사후 감시 장치를 함께 만들겠습니다.',
    };
  }
  if (hasAny(text, ['탄핵', '대통령', '권력', '국회', '헌재'])) {
    return {
      tag: '정국 혼란 공격',
      quote: '견제라는 말로 포장했지만 결국 정국을 마비시키는 정치 싸움입니다.',
      counter: '혼란 비용을 인정하면서도 견제의 기준을 분명히 하면 설득력이 좋아집니다.',
      counterText: '정국 혼란을 줄이기 위해 절차와 증거 기준을 분명히 하고, 권력 남용만 엄격히 견제하겠습니다.',
    };
  }
  if (hasAny(text, ['세금', '예산', '재원', '경제', '물가'])) {
    return {
      tag: '실현 가능성 공격',
      quote: '말은 쉽지만 실제 예산과 경제 효과를 따져보면 실현 가능성이 낮습니다.',
      counter: '숫자와 단계별 실행을 넣으면 현실성 공격을 줄일 수 있습니다.',
      counterText: '단기 효과보다 지속 가능한 재원 구조를 먼저 공개하고, 성과가 검증된 정책부터 확대하겠습니다.',
    };
  }
  return {
    tag: '원론 공격',
    quote: '방향은 맞지만 구체성이 부족합니다. 결국 듣기 좋은 말에 그칠 수 있습니다.',
    counter: '누가, 언제, 어떤 효과를 보는지 한 줄만 더 넣으면 강해집니다.',
    counterText: '구호가 아니라 실행 순서와 책임 주체를 분명히 해 시민이 체감하는 결과로 증명하겠습니다.',
  };
}

function addOpponentReactionButton() {
  if (currentPath() !== '/battle') return;
  if (document.getElementById('battle-opponent-reaction-btn')) return;
  const input = document.getElementById('discuss-input');
  const submit = document.getElementById('btn-discuss-submit');
  const form = document.querySelector('.battle-discuss__form');
  if (!input || !submit || !form) return;

  ensureStyle();
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'battle-opponent-reaction-btn';
  btn.className = 'btn btn--ghost btn--sm';
  btn.style.cssText = 'margin-top:8px;width:100%';
  btn.textContent = '🧨 상대 반박 예상';

  btn.addEventListener('click', () => {
    const text = String(input.value || '').trim();
    let card = document.getElementById('battle-opponent-card');
    if (!card) {
      card = document.createElement('div');
      card.id = 'battle-opponent-card';
      card.className = 'battle-opponent-card';
      form.insertBefore(card, submit);
    }
    if (text.length < 5) {
      card.innerHTML = `<div class="battle-opponent-card__head"><span class="battle-opponent-card__title">🧨 상대 반박 예상</span><span class="battle-opponent-card__tag">대기</span></div><div class="battle-opponent-card__counter">먼저 토론 멘트를 5자 이상 입력해 주세요.</div>`;
      input.focus();
      return;
    }

    const result = pickOpponentTone(text);
    card.innerHTML = `
      <div class="battle-opponent-card__head"><span class="battle-opponent-card__title">🧨 상대 진영 반박</span><span class="battle-opponent-card__tag">${result.tag}</span></div>
      <div class="battle-opponent-card__quote">“${result.quote}”</div>
      <div class="battle-opponent-card__counter"><b>재반박 힌트:</b> ${result.counter}</div>
      <div class="battle-opponent-card__actions">
        <button type="button" id="battle-counter-fill">재반박 문장으로 바꾸기</button>
        <button type="button" id="battle-counter-append">뒤에 덧붙이기</button>
      </div>`;

    card.querySelector('#battle-counter-fill')?.addEventListener('click', () => {
      input.value = result.counterText;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
    card.querySelector('#battle-counter-append')?.addEventListener('click', () => {
      const sep = input.value.trim() ? '\n' : '';
      input.value = `${input.value.trim()}${sep}${result.counterText}`.slice(0, 300);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
    });
  });

  form.insertBefore(btn, submit);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(addOpponentReactionButton, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('popstate', schedule);
window.addEventListener('sosoking:extensions-ready', schedule);

function observeBody() {
  if (!document.body) {
    document.addEventListener('DOMContentLoaded', observeBody, { once: true });
    return;
  }
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
  schedule();
}

observeBody();
