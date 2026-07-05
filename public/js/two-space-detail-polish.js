// two-space-detail-polish.js
// 토론소/드립소 상세 페이지의 참여 흐름을 정리합니다.
// AI 캐릭터 패널은 숨기지 않고, 중복 입력 영역만 정리합니다.

const STYLE_ID = 'soso-two-space-detail-polish-style';
let timer = null;

function isDetailPage() {
  return /^#\/detail\//.test(window.location.hash || '');
}

function text(el, value) {
  if (el && el.textContent !== value) el.textContent = value;
}

function sideText(side) {
  return side === 'A' ? '왼쪽' : '오른쪽';
}

function injectStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    [data-ai-character-panel-root]{display:block!important;visibility:visible!important;opacity:1!important}
    .ai-character-panel{display:block!important;visibility:visible!important;opacity:1!important}
    .multi-detail-root--vote{margin-top:18px;border-radius:26px;border:1px solid rgba(255,107,74,.16);background:linear-gradient(180deg,#fff,rgba(255,247,244,.72));box-shadow:0 14px 34px rgba(15,23,42,.055);overflow:hidden}
    .multi-detail-root--vote .multi-detail-root__head{padding:16px 18px 8px}.multi-detail-root--vote .multi-detail-root__title{font-size:18px;font-weight:950;letter-spacing:-.04em}.multi-detail-root--vote .multi-detail-root__desc{margin-top:4px;color:var(--color-text-muted);font-size:13px;font-weight:750;line-height:1.5}
    .multi-detail-root--vote [data-multi-module="vote"]{margin:0;padding:10px 18px 18px;border:0;background:transparent;box-shadow:none}.multi-detail-root--vote .multi-detail-module__title{font-size:15px;font-weight:950}.multi-detail-root--vote .multi-module-hint{font-size:12px;font-weight:760;color:var(--color-text-muted)}
    .multi-detail-root--vote .multi-vote-options{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.multi-detail-root--vote .multi-vote-option{min-height:74px;border-radius:20px;text-align:left;overflow:hidden}.multi-detail-root--vote .multi-vote-option__text{font-weight:950;letter-spacing:-.035em}.multi-detail-root--vote .multi-vote-option__pct{font-weight:950}
    .multi-detail-root--drip-empty{display:none!important}
    .soso-hidden-legacy-drip-module{display:none!important}
    .comment-section--debate{margin-top:16px!important}.comment-section--debate .comment-section__title::after{content:'투표한 쪽을 고르고 짧게 이유를 남겨보세요';display:block;margin-top:5px;color:var(--color-text-muted);font-size:12px;font-weight:760;line-height:1.45;letter-spacing:-.02em}.comment-section--debate .comment-write-box{position:relative}.comment-section--debate .comment-write-box::before{content:'의견 작성';display:inline-flex;margin:0 0 10px;padding:6px 10px;border-radius:999px;background:rgba(255,107,74,.10);color:#ef4b2f;font-size:11px;font-weight:950}
    .comment-section--debate .cbattle-col--b .cbattle-col__title{text-align:right}.comment-section--debate .cbattle-col--b .cbattle-col__title>div{justify-content:flex-end}.comment-section--debate .cbattle-col--b .cbattle-col__empty{text-align:right;padding-right:4px}.comment-section--debate .cbattle-col--b .cbattle-comment{text-align:right;border-left:0;border-right:3px solid rgba(59,130,246,.72)}.comment-section--debate .cbattle-col--b .cbattle-comment__meta{justify-content:flex-end}.comment-section--debate .cbattle-col--b .comment-delete-btn{margin-left:6px}
    .comment-section--drip{margin-top:16px!important}.comment-section--drip .comment-section__title::after{content:'글이나 이미지를 보고 댓글처럼 바로 드립을 남겨보세요';display:block;margin-top:5px;color:var(--color-text-muted);font-size:12px;font-weight:760;line-height:1.45;letter-spacing:-.02em}
    @media(max-width:520px){.multi-detail-root--vote .multi-vote-options{grid-template-columns:1fr}.multi-detail-root--vote .multi-vote-option{min-height:64px}.comment-section--debate .cbattle-columns{grid-template-columns:1fr!important}}
  `;
  document.head.appendChild(style);
}

function prefixChoiceLabel(label, prefix) {
  const raw = String(label.textContent || '').trim();
  if (!raw || raw.startsWith(`${prefix} ·`)) return;
  label.textContent = `${prefix} · ${raw.replace(/^왼쪽\s*·\s*|^오른쪽\s*·\s*/g, '')}`;
}

function keepAiPanelsVisible() {
  document.querySelectorAll('[data-ai-character-panel-root], .ai-character-panel').forEach(panel => {
    panel.hidden = false;
    panel.removeAttribute('hidden');
    panel.removeAttribute('aria-hidden');
    panel.style.removeProperty('display');
    panel.style.removeProperty('visibility');
    panel.style.removeProperty('opacity');
  });
}

function polishVoteModule() {
  const module = document.querySelector('[data-multi-module="vote"]');
  if (!module) return;
  const root = module.closest('.multi-detail-root');
  if (root) {
    root.classList.remove('multi-detail-root--drip-empty');
    root.classList.add('multi-detail-root--vote');
    root.hidden = false;
    root.removeAttribute('hidden');
    root.removeAttribute('aria-hidden');
    text(root.querySelector('.multi-detail-root__title'), '투표로 입장 선택');
    text(root.querySelector('.multi-detail-root__desc'), '먼저 어느 쪽인지 선택하고, 아래에서 짧게 이유를 남기면 토론이 이어집니다.');
  }
  text(module.querySelector('.multi-detail-module__title'), '🗳️ 먼저 선택해보세요');
  const hint = module.querySelector('.multi-module-hint');
  if (hint && !/아래/.test(hint.textContent || '')) {
    hint.textContent = '투표 후 아래 의견 작성에서 같은 쪽이 자동으로 선택됩니다.';
  }
  const labels = module.querySelectorAll('.multi-vote-option__text');
  if (labels[0]) prefixChoiceLabel(labels[0], '왼쪽');
  if (labels[1]) prefixChoiceLabel(labels[1], '오른쪽');
}

function hideLegacyDripModuleOnly() {
  const dripModule = document.querySelector('[data-multi-module="drip"]');
  if (!dripModule) return;
  const root = dripModule.closest('.multi-detail-root');

  dripModule.classList.add('soso-hidden-legacy-drip-module');
  dripModule.hidden = true;
  dripModule.setAttribute('aria-hidden', 'true');

  if (root) {
    const hasVisibleVote = !!root.querySelector('[data-multi-module="vote"]:not([hidden])');
    const hasVisibleOther = !!root.querySelector('[data-multi-module]:not([data-multi-module="drip"]):not([hidden])');
    if (!hasVisibleVote && !hasVisibleOther) {
      root.classList.add('multi-detail-root--drip-empty');
    } else {
      root.classList.remove('multi-detail-root--drip-empty');
      root.hidden = false;
      root.removeAttribute('hidden');
      root.removeAttribute('aria-hidden');
    }
  }
}

function polishDebateOpinion() {
  const section = document.querySelector('.comment-section--debate');
  if (!section) return;
  text(section.querySelector('.comment-section__title'), '💬 내 의견 남기기');
  const hint = section.querySelector('.multi-module-hint');
  if (hint) hint.textContent = '왼쪽/오른쪽 중 하나를 고르면 내 의견이 해당 칸에 정리됩니다.';
  const input = section.querySelector('#comment-input');
  if (input && !input.dataset.polishedPlaceholder) {
    input.placeholder = '내가 고른 쪽의 이유를 짧게 남겨보세요.';
    input.dataset.polishedPlaceholder = '1';
  }
  const submit = section.querySelector('#btn-comment');
  if (submit && !submit.dataset.defaultText) submit.dataset.defaultText = submit.textContent || '의견 등록';
}

function polishDripOpinion() {
  const section = document.querySelector('.comment-section--drip');
  if (!section) return;
  text(section.querySelector('.comment-section__title'), '🤣 드립 남기기');
  const hint = section.querySelector('.multi-module-hint');
  if (hint) hint.textContent = 'AI 캐릭터 반응을 보고, 댓글처럼 한 줄 드립을 바로 등록합니다.';
  const input = section.querySelector('#comment-input');
  if (input && !input.dataset.polishedPlaceholder) {
    input.placeholder = '짧고 강한 한 줄 드립을 입력하세요.';
    input.dataset.polishedPlaceholder = '1';
  }
}

function selectDebateSide(side, { focus = false } = {}) {
  const section = document.querySelector('.comment-section--debate');
  if (!section) return;
  const btn = section.querySelector(`.cbattle-side-btn[data-side="${side}"]`);
  if (!btn) return;
  section.querySelectorAll('.cbattle-side-btn').forEach(item => item.classList.remove('active'));
  btn.classList.add('active');
  const label = btn.querySelector('.cbattle-ox-label')?.textContent?.trim() || '';
  const input = section.querySelector('#comment-input');
  const submit = section.querySelector('#btn-comment');
  if (input) input.placeholder = `${sideText(side)} 의견 작성 중 · ${label.replace(/^왼쪽\s*·\s*|^오른쪽\s*·\s*/g, '')}을 선택한 이유를 적어주세요.`;
  if (submit) submit.textContent = `${sideText(side)} 의견 등록`;
  if (focus && input) {
    section.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => input.focus({ preventScroll: true }), 280);
  }
}

function bindFlowEvents() {
  if (document.documentElement.dataset.twoSpaceDetailFlowReady === '1') return;
  document.documentElement.dataset.twoSpaceDetailFlowReady = '1';
  document.addEventListener('click', event => {
    const voteBtn = event.target.closest?.('[data-multi-vote-idx]');
    if (voteBtn && isDetailPage()) {
      const idx = Number(voteBtn.dataset.multiVoteIdx || 0);
      const side = idx === 0 ? 'A' : 'B';
      setTimeout(() => selectDebateSide(side, { focus: true }), 550);
      setTimeout(() => selectDebateSide(side, { focus: true }), 1100);
      return;
    }
    const sideBtn = event.target.closest?.('.comment-section--debate .cbattle-side-btn');
    if (sideBtn && isDetailPage()) {
      setTimeout(() => selectDebateSide(sideBtn.dataset.side || ''), 0);
    }
  }, true);
}

function apply() {
  if (!isDetailPage()) return;
  injectStyle();
  keepAiPanelsVisible();
  polishVoteModule();
  hideLegacyDripModuleOnly();
  polishDebateOpinion();
  polishDripOpinion();
  bindFlowEvents();
  keepAiPanelsVisible();
}

function schedule() {
  clearTimeout(timer);
  timer = setTimeout(apply, 120);
}

window.addEventListener('hashchange', schedule);
window.addEventListener('sosoking:auth-ready', schedule);
document.addEventListener('DOMContentLoaded', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
schedule();
