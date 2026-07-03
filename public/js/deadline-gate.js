import { functions } from './firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const getRegisteredMemberCount = httpsCallable(functions, 'getRegisteredMemberCount');
let cached = null;
let loading = null;

function esc(value) {
  return String(value || '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[ch]));
}

function isMultiWritePage() {
  return /[?&]type=multi\b/.test(location.hash || '') && !!document.querySelector('.multi-write-page');
}

async function loadStatus() {
  if (cached) return cached;
  if (loading) return loading;
  loading = getRegisteredMemberCount({}).then(result => {
    const data = result.data || {};
    cached = {
      enabled: !!data.enabled,
      count: Number(data.count || 0),
      threshold: Number(data.threshold || 50),
    };
    return cached;
  }).catch(error => {
    console.warn('[deadline-gate] member gate failed', error);
    cached = { enabled: false, count: 0, threshold: 50, error: true };
    return cached;
  }).finally(() => { loading = null; });
  return loading;
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

function renderDetails(data) {
  const percent = data.threshold > 0 ? Math.min(100, Math.round((data.count / data.threshold) * 100)) : 0;
  const left = Math.max(0, data.threshold - data.count);
  return `
    <details class="deadline-gate-details">
      <summary>산정기준과 현황 확인</summary>
      <div class="deadline-gate-details__body">
        <div class="deadline-gate-details__row">
          <b>산정기준</b>
          <span>가입 회원 ${esc(data.threshold.toLocaleString())}명 이상부터 마감/결과 공개 기능을 사용할 수 있어요.</span>
        </div>
        <div class="deadline-gate-details__row">
          <b>현재 현황</b>
          <span>현재 ${esc(data.count.toLocaleString())}명 / 기준 ${esc(data.threshold.toLocaleString())}명 · ${esc(percent)}%</span>
        </div>
        <div class="deadline-gate-details__bar"><i style="width:${percent}%"></i></div>
        <div class="deadline-gate-details__note">
          ${data.enabled ? '현재 기준을 충족해서 마감 기능을 사용할 수 있습니다.' : `기준까지 ${left.toLocaleString()}명이 더 필요합니다.`}
        </div>
      </div>
    </details>`;
}

function patchDeadlineDetails(box, data) {
  if (!box || box.querySelector('.deadline-gate-details')) return;
  const holder = document.createElement('div');
  holder.innerHTML = renderDetails(data);
  const detail = holder.firstElementChild;
  const hint = box.querySelector('#mw-deadline-hint') || box.lastElementChild;
  if (hint) hint.insertAdjacentElement('afterend', detail);
  else box.appendChild(detail);
}

async function ensureDeadlineGate() {
  if (!isMultiWritePage()) return;
  const data = await loadStatus();

  if (!data.enabled) {
    document.getElementById('mw-deadline-box')?.remove();
    return;
  }

  let box = document.getElementById('mw-deadline-box');
  if (!box) {
    const anchor = document.querySelector('.multi-comment-note') || document.querySelector('.multi-game-preview') || document.querySelector('.card__body--lg');
    if (!anchor) return;
    anchor.insertAdjacentHTML(anchor.classList.contains('multi-comment-note') ? 'beforebegin' : 'afterend', renderDeadlineBox());
    box = document.getElementById('mw-deadline-box');
  }

  bindDeadlineBox();
  patchDeadlineDetails(box, data);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(ensureDeadlineGate, 180);
}

window.addEventListener('hashchange', () => {
  cached = null;
  loading = null;
  schedule();
});
window.addEventListener('sosoking:render-multi-write', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
