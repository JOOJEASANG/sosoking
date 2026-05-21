import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const callGetRegisteredMemberCount = httpsCallable(functions, 'getRegisteredMemberCount');
let checked = false;
let enabled = false;
let checking = false;

function isMultiWritePage() {
  return /[?&]type=multi\b/.test(location.hash || '') && !!document.querySelector('.multi-write-page');
}

function renderDeadlineBox() {
  return `
    <div class="multi-deadline-box" id="mw-deadline-box" data-deadline-enabled="1">
      <div class="multi-deadline-box__head">
        <div><b>⏰ 마감/결과 공개</b><small>회원 50명 이상부터 사용할 수 있습니다.</small></div>
        <span id="mw-member-gate-badge">활성화</span>
      </div>
      <div id="mw-deadline-options" class="multi-deadline-options">
        <input type="hidden" id="mw-deadline-mode" value="none">
        <button type="button" class="multi-deadline-option active" data-deadline-mode="none">마감 없음</button>
        <button type="button" class="multi-deadline-option" data-deadline-mode="1h">1시간</button>
        <button type="button" class="multi-deadline-option" data-deadline-mode="24h">24시간</button>
        <button type="button" class="multi-deadline-option" data-deadline-mode="manual">직접 마감</button>
      </div>
      <div class="form-hint" id="mw-deadline-hint">마감 시간이 지나면 상세페이지에서 마감 상태로 표시됩니다.</div>
    </div>`;
}

function bindDeadlineBox() {
  const hidden = document.getElementById('mw-deadline-mode');
  document.querySelectorAll('[data-deadline-mode]').forEach(btn => {
    if (btn.dataset.deadlineGateBound === '1') return;
    btn.dataset.deadlineGateBound = '1';
    btn.addEventListener('click', () => {
      const mode = btn.dataset.deadlineMode || 'none';
      if (hidden) hidden.value = mode;
      document.querySelectorAll('[data-deadline-mode]').forEach(item => {
        const active = item.dataset.deadlineMode === mode;
        item.classList.toggle('active', active);
        item.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
      document.getElementById('mw-deadline-mode')?.dispatchEvent(new Event('change', { bubbles: true }));
    });
  });
}

function injectDeadlineBox() {
  if (!isMultiWritePage() || !enabled) return;
  if (document.getElementById('mw-deadline-box')) {
    bindDeadlineBox();
    return;
  }
  const anchor = document.querySelector('.multi-comment-note') || document.querySelector('.multi-game-preview') || document.querySelector('.card__body--lg');
  if (!anchor) return;
  anchor.insertAdjacentHTML(anchor.classList.contains('multi-comment-note') ? 'beforebegin' : 'afterend', renderDeadlineBox());
  bindDeadlineBox();
}

async function checkGate() {
  if (checked || checking) return;
  checking = true;
  try {
    const result = await callGetRegisteredMemberCount({});
    const data = result.data || {};
    enabled = !!data.enabled;
    checked = true;
    if (!enabled) document.getElementById('mw-deadline-box')?.remove();
    injectDeadlineBox();
  } catch (error) {
    checked = true;
    enabled = false;
    document.getElementById('mw-deadline-box')?.remove();
    console.warn('[deadline-gate-render] member gate failed', error);
  } finally {
    checking = false;
  }
}

function tick() {
  if (!isMultiWritePage()) return;
  if (!checked) checkGate();
  else injectDeadlineBox();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(tick, 220);
}

window.addEventListener('hashchange', () => {
  checked = false;
  enabled = false;
  schedule();
});
window.addEventListener('sosoking:render-multi-write', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
