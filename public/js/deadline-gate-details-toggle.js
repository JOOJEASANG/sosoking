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
  }).catch(() => {
    cached = { enabled: false, count: 0, threshold: 50, error: true };
    return cached;
  }).finally(() => { loading = null; });
  return loading;
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
          <span>가입 회원 ${esc(data.threshold)}명 이상부터 마감/결과 공개 기능을 사용할 수 있어요.</span>
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

function injectPlaceholder(box) {
  if (box.querySelector('.deadline-gate-details')) return null;
  const holder = document.createElement('div');
  holder.innerHTML = `
    <details class="deadline-gate-details">
      <summary>산정기준과 현황 확인</summary>
      <div class="deadline-gate-details__body">
        <div class="deadline-gate-details__note">현황을 불러오는 중입니다...</div>
      </div>
    </details>`;
  const detail = holder.firstElementChild;
  const hint = box.querySelector('#mw-deadline-hint') || box.lastElementChild;
  if (hint) hint.insertAdjacentElement('afterend', detail);
  else box.appendChild(detail);
  return detail;
}

async function patchDeadlineDetails() {
  const box = document.getElementById('mw-deadline-box');
  if (!box || box.dataset.deadlineGateDetailsReady === '1') return;
  box.dataset.deadlineGateDetailsReady = '1';
  const detail = injectPlaceholder(box);
  const data = await loadStatus();
  const currentBox = document.getElementById('mw-deadline-box');
  if (!currentBox) return;
  const old = currentBox.querySelector('.deadline-gate-details');
  const holder = document.createElement('div');
  holder.innerHTML = renderDetails(data);
  const next = holder.firstElementChild;
  if (old) old.replaceWith(next);
  else currentBox.appendChild(next);
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(patchDeadlineDetails, 160);
}

window.addEventListener('hashchange', () => {
  cached = null;
  schedule();
});
window.addEventListener('sosoking:render-multi-write', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 700);
