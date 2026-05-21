import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const BEST_KINDS = new Set(['naming', 'acrostic', 'fill', 'relay']);

const KIND_LABEL = {
  naming: '베스트 작명',
  acrostic: '베스트 삼행시',
  fill: '베스트 빈칸 답',
  relay: '베스트 릴레이',
};

function esc(value) {
  return String(value || '').replace(/[&<>"]/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]));
}

function getDetailId() {
  const hash = window.location.hash || '';
  const match = hash.match(/#\/detail\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function bestKind(post = {}) {
  const modules = post.modules || {};
  if (modules.naming?.enabled) return 'naming';
  if (modules.acrostic?.enabled) return 'acrostic';
  if (modules.fill?.enabled) return 'fill';
  if (modules.relay?.enabled) return 'relay';
  return BEST_KINDS.has(post.subtype) ? post.subtype : '';
}

function renderRuleCard(kind) {
  const label = KIND_LABEL[kind] || '베스트 참여작';
  return `
    <div class="best-reward-rule-card" data-best-reward-rule-card="1">
      <div class="best-reward-rule-card__head">
        <div><b>🏆 ${esc(label)} 산정 기준</b><span>반응 점수로 베스트 카드가 자동으로 돋보입니다.</span></div>
        <small>자동 계산</small>
      </div>
      <div class="best-reward-rule-card__score">
        <span>👍 <b>1점</b></span>
        <span>😂 <b>2점</b></span>
        <span>🔥 <b>3점</b></span>
      </div>
      <div class="best-reward-rule-card__note">
        참여글에 반응이 쌓이면 점수가 높은 글이 베스트 카드로 표시됩니다. 현재 보상은 참여/답글/반응 포인트가 먼저 적용되어 있고, 베스트 확정 보상은 다음 단계에서 자동 지급 구조로 연결할 수 있습니다.
      </div>
    </div>`;
}

function insertAfterStatusCard(html) {
  const status = document.querySelector('[data-detail-game-status-card]');
  if (status) {
    status.insertAdjacentHTML('afterend', html);
    return true;
  }
  const modules = document.querySelector('[data-multi-modules-root]');
  if (modules) {
    modules.insertAdjacentHTML('beforebegin', html);
    return true;
  }
  const body = document.querySelector('.detail-body');
  if (body) {
    body.insertAdjacentHTML('afterend', html);
    return true;
  }
  return false;
}

async function enhanceBestRuleCard() {
  const postId = getDetailId();
  if (!postId || document.querySelector('[data-best-reward-rule-card]')) return;
  const root = document.getElementById('page-content');
  if (!root || !root.querySelector('.feed-card__type-badge')) return;

  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    if (post.type !== 'multi') return;
    const kind = bestKind(post);
    if (!kind) return;
    insertAfterStatusCard(renderRuleCard(kind));
  } catch (error) {
    console.warn('[best-reward-rule] enhance failed', error);
  }
}

let timer = null;
function schedule() {
  clearTimeout(timer);
  timer = setTimeout(enhanceBestRuleCard, 260);
}

window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 800);
