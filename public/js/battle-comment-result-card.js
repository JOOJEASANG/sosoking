// battle-comment-result-card.js
// 정치배틀 댓글 제출 후 방금 쓴 의견 아래에 토론력 결과 카드를 남깁니다.
// 서버 데이터 구조는 건드리지 않고, 같은 기기에서는 localStorage로 복원합니다.

const STORAGE_KEY = 'sosoking:battle-comment-results:v1';

function currentPath() {
  const hashPath = (window.location.hash.slice(1) || '').split('?')[0];
  if (hashPath && hashPath !== '/') return hashPath;
  return window.location.pathname || '/';
}

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function ensureStyle() {
  if (document.getElementById('battle-comment-result-style')) return;
  const style = document.createElement('style');
  style.id = 'battle-comment-result-style';
  style.textContent = `
    .battle-comment-result{margin:8px 0 0;border:1px solid rgba(255,107,74,.22);border-radius:14px;background:linear-gradient(135deg,rgba(255,107,74,.08),rgba(15,23,42,.025));padding:10px;font-size:11px;color:var(--color-text-secondary)}
    .battle-comment-result__top{display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:7px}
    .battle-comment-result__title{font-weight:1000;color:var(--color-text-primary)}
    .battle-comment-result__score{font-weight:1000;color:var(--color-primary);font-size:14px}
    .battle-comment-result__grid{display:grid;grid-template-columns:repeat(5,1fr);gap:5px;margin-bottom:7px}
    .battle-comment-result__metric{border-radius:10px;background:rgba(255,255,255,.78);border:1px solid rgba(100,116,139,.12);padding:6px 4px;text-align:center;line-height:1.2}
    .battle-comment-result__metric b{display:block;color:var(--color-text-primary);font-size:12px;margin-bottom:2px}
    .battle-comment-result__attack{border-radius:11px;background:rgba(15,23,42,.055);padding:7px 8px;line-height:1.45;color:var(--color-text-secondary)}
    .battle-comment-result__attack b{color:var(--color-text-primary)}
    .battle-comment--speech{border-color:rgba(245,158,11,.42)!important;box-shadow:0 10px 24px rgba(245,158,11,.12)}
    .battle-comment--legend-speech{border-color:rgba(239,68,68,.42)!important;box-shadow:0 12px 30px rgba(239,68,68,.14)}
    .battle-speech-badge{display:inline-flex;align-items:center;gap:4px;margin-left:6px;border-radius:999px;padding:3px 7px;background:linear-gradient(135deg,#f59e0b,#f97316);color:#fff;font-size:10px;font-weight:1000;vertical-align:middle;box-shadow:0 4px 10px rgba(245,158,11,.22)}
    .battle-speech-badge--legend{background:linear-gradient(135deg,#ef4444,#9333ea);box-shadow:0 4px 12px rgba(147,51,234,.22)}
    .battle-comment-result--speech{background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(255,255,255,.96));border-color:rgba(245,158,11,.36)}
    .battle-comment-result--legend{background:linear-gradient(135deg,rgba(239,68,68,.12),rgba(147,51,234,.08));border-color:rgba(239,68,68,.34)}
    @media(max-width:420px){.battle-comment-result__grid{grid-template-columns:repeat(2,1fr)}.battle-speech-badge{margin-left:0;margin-top:4px}}
  `;
  document.head.appendChild(style);
}

function clampScore(n) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function countHits(text, words) {
  return words.reduce((sum, w) => sum + (text.includes(w) ? 1 : 0), 0);
}

function scoreComment(text) {
  const t = String(text || '').trim();
  const len = t.length;
  const hasNumber = /\d|%|퍼센트|예산|세금|비용|재원|효과|지표/.test(t);
  const hasReason = /왜냐|때문|근거|따라서|그래서|우선|실행|결과|효과/.test(t);
  const hasBalance = /다만|하지만|반면|동시에|한편|위험|부작용|검토/.test(t);
  const hasPeople = /시민|청년|서민|유권자|국민|자영업|학생|노동|민생/.test(t);
  const attackWords = countHits(t, ['무능', '거짓', '특혜', '기득권', '포퓰리즘', '책임', '검증', '실패']);
  const riskWords = countHits(t, ['멍청', '꺼져', '닥쳐', '쓰레기', '무조건', '절대', '다 죽', '망해라']);

  const lengthScore = len < 10 ? 18 : len < 30 ? 48 : len < 80 ? 76 : 88;
  const persuasion = clampScore(lengthScore + (hasReason ? 12 : 0) + (hasPeople ? 8 : 0) - riskWords * 10);
  const reality = clampScore(42 + (hasNumber ? 20 : 0) + (hasReason ? 16 : 0) + (hasBalance ? 12 : 0) - (len < 20 ? 15 : 0));
  const defense = clampScore(40 + (hasBalance ? 20 : 0) + Math.min(20, attackWords * 7) + (hasReason ? 10 : 0));
  const popularity = clampScore(48 + (hasPeople ? 18 : 0) + (len >= 25 && len <= 120 ? 12 : 0) - riskWords * 12);
  const risk = clampScore(20 + riskWords * 24 + (len > 180 ? 12 : 0) + (!hasBalance && attackWords >= 2 ? 12 : 0));
  const total = clampScore((persuasion + reality + defense + popularity + (100 - risk)) / 5);
  return { total, persuasion, reality, defense, popularity, risk };
}

function opponentAttack(text) {
  const t = String(text || '');
  if (/복지|지원금|청년|월세|보조금|무상/.test(t)) return '재정 공격 예상: “결국 세금으로 메우는 포퓰리즘 아니냐”';
  if (/규제|처벌|단속|금지|통제/.test(t)) return '자유 침해 공격 예상: “시민 자유를 과도하게 제한한다”';
  if (/탄핵|대통령|권력|국회|헌재/.test(t)) return '정국 혼란 공격 예상: “견제가 아니라 정치 싸움이다”';
  if (/세금|예산|재원|경제|물가/.test(t)) return '실현 가능성 공격 예상: “예산과 경제 효과가 불확실하다”';
  return '원론 공격 예상: “방향은 맞지만 구체성이 부족하다”';
}

function hashText(text) {
  let h = 0;
  const s = String(text || '').trim();
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return `t_${Math.abs(h)}`;
}

function loadStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveResult(commentId, text, result) {
  try {
    const store = loadStore();
    const key = commentId || hashText(text);
    store[key] = { text, result, savedAt: Date.now() };
    store[hashText(text)] = { text, result, savedAt: Date.now() };

    const entries = Object.entries(store).sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0)).slice(0, 80);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch { /* ignore */ }
}

function getStoredResult(commentId, text) {
  const store = loadStore();
  return (commentId && store[commentId]?.result) || store[hashText(text)]?.result || null;
}

function buildResult(text) {
  return { score: scoreComment(text), attack: opponentAttack(text) };
}

function speechLevel(total) {
  if (Number(total || 0) >= 90) return 'legend';
  if (Number(total || 0) >= 80) return 'speech';
  return '';
}

function speechBadge(level) {
  if (level === 'legend') return '<span class="battle-speech-badge battle-speech-badge--legend">👑 전설의 연설</span>';
  if (level === 'speech') return '<span class="battle-speech-badge">🔥 명연설</span>';
  return '';
}

function renderCard(result) {
  const s = result.score || result;
  const attack = result.attack || '상대 반박 예상 없음';
  const level = speechLevel(s.total);
  const extraClass = level === 'legend' ? ' battle-comment-result--legend' : level === 'speech' ? ' battle-comment-result--speech' : '';
  return `
    <div class="battle-comment-result${extraClass}" data-battle-comment-result="true">
      <div class="battle-comment-result__top">
        <span class="battle-comment-result__title">🎯 내 토론 결과 ${speechBadge(level)}</span>
        <span class="battle-comment-result__score">${s.total}점</span>
      </div>
      <div class="battle-comment-result__grid">
        <div class="battle-comment-result__metric"><b>${s.persuasion}</b>설득</div>
        <div class="battle-comment-result__metric"><b>${s.reality}</b>현실</div>
        <div class="battle-comment-result__metric"><b>${s.defense}</b>방어</div>
        <div class="battle-comment-result__metric"><b>${s.popularity}</b>대중</div>
        <div class="battle-comment-result__metric"><b>${s.risk}%</b>위험</div>
      </div>
      <div class="battle-comment-result__attack"><b>🧨 ${esc(attack)}</b></div>
    </div>`;
}

function markSpeechComment(commentEl, result) {
  const total = result?.score?.total ?? result?.total;
  const level = speechLevel(total);
  if (!commentEl || !level) return;
  commentEl.classList.add(level === 'legend' ? 'battle-comment--legend-speech' : 'battle-comment--speech');
  const author = commentEl.querySelector('.battle-comment__author');
  if (author && !author.querySelector('.battle-speech-badge')) {
    author.insertAdjacentHTML('beforeend', speechBadge(level));
  }
}

function attachResultToComment(commentEl, result, text) {
  if (!commentEl) return;
  const textEl = commentEl.querySelector('.battle-comment__text');
  const reactionsEl = commentEl.querySelector('.battle-comment__reactions');
  if (!textEl) return;
  if (!commentEl.querySelector('[data-battle-comment-result]')) {
    textEl.insertAdjacentHTML('afterend', renderCard(result));
  }
  markSpeechComment(commentEl, result);
  if (reactionsEl) reactionsEl.style.marginTop = '8px';
  saveResult(commentEl.dataset.commentId || null, text || textEl.textContent || '', result);
}

function restoreCards() {
  if (currentPath() !== '/battle') return;
  ensureStyle();
  document.querySelectorAll('.battle-comment').forEach(commentEl => {
    const text = commentEl.querySelector('.battle-comment__text')?.textContent || '';
    const stored = getStoredResult(commentEl.dataset.commentId || null, text);
    if (stored) attachResultToComment(commentEl, stored, text);
  });
}

let pending = null;
function captureSubmit() {
  if (currentPath() !== '/battle') return;
  const input = document.getElementById('discuss-input');
  const submit = document.getElementById('btn-discuss-submit');
  if (!input || !submit || submit.dataset.resultCaptureAttached === 'true') return;
  submit.dataset.resultCaptureAttached = 'true';
  submit.addEventListener('click', () => {
    const text = String(input.value || '').trim();
    if (text.length < 2) return;
    pending = { text, result: buildResult(text), at: Date.now() };
    setTimeout(applyPendingToNewestComment, 900);
    setTimeout(applyPendingToNewestComment, 1800);
  }, true);
}

function applyPendingToNewestComment() {
  if (!pending || Date.now() - pending.at > 6000) return;
  const comments = [...document.querySelectorAll('.battle-comment')];
  const target = comments.find(el => (el.querySelector('.battle-comment__text')?.textContent || '').trim() === pending.text && !el.querySelector('[data-battle-comment-result]'));
  if (!target) return;
  attachResultToComment(target, pending.result, pending.text);
  pending = null;
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(() => {
    captureSubmit();
    restoreCards();
    applyPendingToNewestComment();
  }, 120);
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
