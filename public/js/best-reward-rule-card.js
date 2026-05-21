import { auth, db, functions } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const callFinalizeBestReward = httpsCallable(functions, 'finalizeBestReward');
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

function deadlineDate(post = {}) {
  const value = post.deadlineAt;
  return value?.toDate?.() || (value ? new Date(value) : null);
}

function canFinalize(post = {}) {
  if (post.bestReward?.status === 'awarded' || post.bestReward?.status === 'already_awarded') return true;
  if (post.deadline?.status === 'closed') return true;
  const date = deadlineDate(post);
  return !!date && date.getTime() <= Date.now();
}

function isOwner(post = {}) {
  return !!auth.currentUser?.uid && auth.currentUser.uid === post.authorId;
}

function renderAwardStatus(post = {}) {
  const reward = post.bestReward || {};
  if (reward.status === 'awarded' || reward.status === 'already_awarded') {
    const name = reward.winner?.authorName || '참여자';
    const points = Number(reward.points || 20);
    return `<div class="best-reward-rule-card__result is-awarded">🏆 ${esc(name)}님에게 베스트 보상 +${points}P 지급 완료</div>`;
  }
  return '';
}

function renderAction(post = {}, kind = '') {
  if (!isOwner(post)) return '';
  if (post.bestReward?.status === 'awarded' || post.bestReward?.status === 'already_awarded') return '';
  const ready = canFinalize(post);
  const label = ready ? '베스트 보상 확정' : '아직 마감 전';
  const hint = ready ? '현재 1등 참여글 작성자에게 +20P를 지급합니다.' : '마감 시간이 지나거나 직접 마감 후 확정할 수 있습니다.';
  return `
    <div class="best-reward-rule-card__action">
      <button type="button" class="best-reward-finalize-btn" data-best-reward-finalize="1" data-kind="${esc(kind)}" ${ready ? '' : 'disabled'}>${label}</button>
      <span>${esc(hint)}</span>
    </div>`;
}

function renderRuleCard(kind, post) {
  const label = KIND_LABEL[kind] || '베스트 참여작';
  return `
    <div class="best-reward-rule-card" data-best-reward-rule-card="1" data-post-id="${esc(post.id)}" data-kind="${esc(kind)}">
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
        참여글에 반응이 쌓이면 점수가 높은 글이 베스트 카드로 표시됩니다. 마감 후 확정하면 1등 참여글 작성자에게 베스트 보상 +20P가 지급됩니다.
      </div>
      ${renderAwardStatus(post)}
      ${renderAction(post, kind)}
    </div>`;
}

function bindFinalizeButton(card) {
  const btn = card?.querySelector('[data-best-reward-finalize]');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', async () => {
    const postId = card.dataset.postId;
    const kind = btn.dataset.kind;
    if (!postId || !kind) return;
    try {
      btn.disabled = true;
      btn.textContent = '확정 중...';
      const result = await callFinalizeBestReward({ postId, kind, closeNow: true });
      const data = result.data || {};
      if (data.awarded) toast.success(data.message || `베스트 보상 +${data.points || 20}P 지급 완료`);
      else toast.info(data.message || '베스트 보상 확정 상태를 확인했어요.');
      const status = card.querySelector('.best-reward-rule-card__result');
      const text = data.winner?.authorName
        ? `🏆 ${data.winner.authorName}님에게 베스트 보상 +${data.points || 20}P 지급 완료`
        : '🏆 베스트 보상 처리 완료';
      if (status) {
        status.classList.add('is-awarded');
        status.textContent = text;
      } else {
        card.insertAdjacentHTML('beforeend', `<div class="best-reward-rule-card__result is-awarded">${esc(text)}</div>`);
      }
      btn.remove();
    } catch (error) {
      console.error(error);
      toast.error(error.message || '베스트 보상 확정에 실패했어요.');
      btn.disabled = false;
      btn.textContent = '베스트 보상 확정';
    }
  });
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
    insertAfterStatusCard(renderRuleCard(kind, post));
    bindFinalizeButton(document.querySelector('[data-best-reward-rule-card]'));
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
