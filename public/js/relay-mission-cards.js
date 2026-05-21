import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const MISSIONS = {
  but: { title: '그런데 시작', instruction: '다음 문장은 “그런데”로 시작해 주세요.', badge: '그런데' },
  horror: { title: '공포 전환', instruction: '갑자기 분위기를 공포로 바꿔 주세요.', badge: '공포' },
  animal: { title: '동물 등장', instruction: '동물 하나를 자연스럽게 등장시켜 주세요.', badge: '동물' },
  twist: { title: '반전 넣기', instruction: '마지막에 짧은 반전을 넣어 주세요.', badge: '반전' },
  dialogue: { title: '대사 필수', instruction: '인물 대사 한 줄을 반드시 포함해 주세요.', badge: '대사' },
};

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function missionFor(key) {
  return MISSIONS[String(key || 'none')] || null;
}

function setRelayMission(key) {
  const normalized = missionFor(key) ? String(key) : 'none';
  const hidden = document.getElementById('mw-relay-mission');
  if (hidden) {
    hidden.value = normalized;
    hidden.dispatchEvent(new Event('input', { bubbles: true }));
    hidden.dispatchEvent(new Event('change', { bubbles: true }));
  }
  document.querySelectorAll('[data-relay-mission]').forEach(btn => {
    const active = btn.dataset.relayMission === normalized;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  injectWritePreviewMission();
}

function bindWriteMissionOptions() {
  document.querySelectorAll('[data-relay-mission]').forEach(btn => {
    if (btn.dataset.relayMissionBound === '1') return;
    btn.dataset.relayMissionBound = '1';
    btn.addEventListener('click', () => setRelayMission(btn.dataset.relayMission));
  });
}

function getDetailId() {
  const hash = window.location.hash || '';
  const match = hash.match(/#\/detail\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function renderMissionCard(mission) {
  if (!mission) return '';
  return `
    <div class="multi-relay-mission-card" data-relay-mission-card="1">
      <div class="multi-relay-mission-card__badge">🎯 ${esc(mission.badge)}</div>
      <div class="multi-relay-mission-card__body">
        <b>${esc(mission.title)}</b>
        <span>${esc(mission.instruction)}</span>
      </div>
    </div>`;
}

function renderPreviewMission(mission) {
  if (!mission) return '';
  return `
    <div class="multi-preview-mission" data-relay-preview-mission="1">
      <b>🎯 ${esc(mission.title)}</b>
      <span>${esc(mission.instruction)}</span>
    </div>`;
}

function injectWritePreviewMission() {
  const page = document.querySelector('.multi-write-page[data-preset-key="relay"]');
  const preview = document.getElementById('mw-preview-body');
  if (!page || !preview) return;
  preview.querySelectorAll('[data-relay-preview-mission]').forEach(el => el.remove());
  const mission = missionFor(document.getElementById('mw-relay-mission')?.value || 'none');
  if (!mission) return;
  const anchor = preview.querySelector('.multi-preview-guide') || preview.querySelector('.multi-preview-body') || preview.firstElementChild;
  if (anchor) anchor.insertAdjacentHTML('afterend', renderPreviewMission(mission));
}

async function enhanceRelayDetail() {
  const postId = getDetailId();
  if (!postId) return;
  const relayModule = document.querySelector('[data-multi-module="relay"]');
  if (!relayModule || relayModule.querySelector('[data-relay-mission-card]')) return;

  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = snap.data() || {};
    const mission = post.modules?.relay?.mission?.enabled ? post.modules.relay.mission : null;
    if (!mission) return;
    const target = relayModule.querySelector('.multi-relay-start') || relayModule.querySelector('.multi-detail-module__title');
    if (target) target.insertAdjacentHTML('afterend', renderMissionCard(mission));
  } catch (error) {
    console.warn('[relay-mission] detail enhance failed', error);
  }
}

function tick() {
  bindWriteMissionOptions();
  injectWritePreviewMission();
  enhanceRelayDetail();
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(tick, 180);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 500);
