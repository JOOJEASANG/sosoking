import { auth, db, functions } from './firebase.js';
import { collection, doc, getCountFromServer, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { toast } from './components/toast.js';

const finalizeBestReward = httpsCallable(functions, 'finalizeBestReward');

const KIND = {
  vote: { icon:'🗳️', title:'투표 현황', guide:'마음에 드는 선택지에 투표하고 댓글로 이유를 남겨보세요.', reward:'투표 참여 +1P', criteria:'선택지 투표를 정상 완료하면 게시글별·선택지별 1회 기준으로 포인트가 지급됩니다.' },
  quiz: { icon:'🧠', title:'퀴즈 현황', guide:'정답을 맞히면 해설이 열리고 정답 보상을 받을 수 있어요.', reward:'정답 +5P', criteria:'정답 제출 후 정답 판정이 난 경우에만 게시글별 1회 기준으로 포인트가 지급됩니다.' },
  naming: { icon:'😜', title:'작명 현황', guide:'가장 웃긴 이름을 남기고 반응을 받아 베스트에 도전하세요.', reward:'참여 +3P · 답글 +2P · 반응 받음 +1P', criteria:'작명 참여글 작성 시 참여 포인트가 지급되고, 답글 작성·다른 사용자 반응을 받을 때 추가 포인트가 반영됩니다.', collection:'multi_naming', best:'베스트 작명' },
  acrostic: { icon:'✍️', title:'행시 현황', guide:'제시어로 센스 있는 한 줄들을 완성해보세요.', reward:'참여 +3P · 답글 +2P · 반응 받음 +1P', criteria:'이행시·삼행시·사행시·오행시 참여글을 완성해 올리면 참여 포인트가 지급됩니다.', collection:'multi_acrostic', best:'베스트 행시' },
  fill: { icon:'🧩', title:'빈칸 현황', guide:'빈칸마다 글자를 채워 가장 재밌는 답을 만들어보세요.', reward:'참여 +3P · 답글 +2P · 반응 받음 +1P', criteria:'빈칸 답변을 제출하면 참여 포인트가 지급되고, 답글·반응으로 추가 포인트가 반영됩니다.', collection:'multi_fill', best:'베스트 빈칸 답' },
  relay: { icon:'🎭', title:'릴레이 현황', guide:'앞 문장 뒤로 이야기를 이어 쓰고 베스트 릴레이에 도전하세요.', reward:'참여 +3P · 답글 +2P · 반응 받음 +1P', criteria:'릴레이 문장을 이어 쓰면 참여 포인트가 지급되고, 답글·반응으로 추가 포인트가 반영됩니다.', collection:'multi_relay', best:'베스트 릴레이' },
};
const BEST_KINDS = new Set(['naming', 'acrostic', 'fill', 'relay']);

function esc(value) { return String(value || '').replace(/[&<>"]/g, m => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[m])); }
function detailId() { return decodeURIComponent((location.hash.match(/#\/detail\/([^/?#]+)/) || [,''])[1] || ''); }
function activeKind(post = {}) {
  const m = post.modules || {};
  if (m.vote?.enabled) return 'vote';
  if (m.quiz?.enabled) return 'quiz';
  if (m.naming?.enabled) return 'naming';
  if (m.acrostic?.enabled) return 'acrostic';
  if (m.fill?.enabled) return 'fill';
  if (m.relay?.enabled) return 'relay';
  return KIND[post.subtype] ? post.subtype : '';
}
function voteTotal(post) { return (post.modules?.vote?.options || []).reduce((sum, opt) => sum + Number(opt.votes || 0), 0); }
async function countItems(postId, kind) {
  if (!KIND[kind]?.collection) return 0;
  try { return Number((await getCountFromServer(collection(db, 'feeds', postId, KIND[kind].collection))).data().count || 0); }
  catch { return 0; }
}
async function statsFor(postId, post, kind) {
  if (kind === 'vote') return { a:'총 투표', av:`${voteTotal(post)}표`, b:'댓글', bv:`${Number(post.commentCount || 0)}개` };
  if (kind === 'quiz') {
    const q = post.modules?.quiz || {};
    return { a:'정답자', av:`${Number(q.correctCount || 0)}명`, b:'상태', bv:q.firstCorrect?.authorName ? `첫 정답자 ${q.firstCorrect.authorName}` : '첫 정답자 대기중' };
  }
  return { a:'참여글', av:`${await countItems(postId, kind)}개`, b:'댓글/반응', bv:'항상 가능' };
}
function statusCard(kind, s) {
  const info = KIND[kind];
  return `<details class="detail-game-status-card" data-detail-game-status-card="1">
    <summary class="detail-game-status-card__summary"><div class="detail-game-status-card__title"><span>${info.icon}</span><b>${esc(info.title)} · 포인트</b></div><div class="detail-game-status-card__summary-right"><span class="detail-game-status-card__reward">${esc(info.reward)}</span><span class="detail-game-status-card__toggle-text">펼치기</span></div></summary>
    <div class="detail-game-status-card__body"><div class="detail-game-status-card__stats"><div><small>${esc(s.a)}</small><b>${esc(s.av)}</b></div><div><small>${esc(s.b)}</small><b>${esc(s.bv)}</b></div></div><div class="detail-game-status-card__guide">${esc(info.guide)}</div><div class="detail-game-status-card__criteria"><b>산정기준</b><span>${esc(info.criteria)}</span></div></div>
  </details>`;
}
function deadlineDate(post = {}) { return post.deadlineAt?.toDate?.() || (post.deadlineAt ? new Date(post.deadlineAt) : null); }
function canFinalize(post = {}) {
  if (['awarded', 'already_awarded'].includes(post.bestReward?.status)) return true;
  if (post.deadline?.status === 'closed') return true;
  const d = deadlineDate(post);
  return !!d && d.getTime() <= Date.now();
}
function owner(post = {}) { return !!auth.currentUser?.uid && auth.currentUser.uid === post.authorId; }
function awardStatus(post = {}) {
  const r = post.bestReward || {};
  if (!['awarded', 'already_awarded'].includes(r.status)) return '';
  return `<div class="best-reward-rule-card__result is-awarded">🏆 ${esc(r.winner?.authorName || '참여자')}님에게 베스트 보상 +${Number(r.points || 20)}P 지급 완료</div>`;
}
function rewardAction(post, kind) {
  if (!owner(post) || ['awarded', 'already_awarded'].includes(post.bestReward?.status)) return '';
  const ready = canFinalize(post);
  return `<div class="best-reward-rule-card__action"><button type="button" class="best-reward-finalize-btn" data-best-reward-finalize="1" data-kind="${esc(kind)}" ${ready ? '' : 'disabled'}>${ready ? '베스트 보상 확정' : '아직 마감 전'}</button><span>${ready ? '현재 1등 참여글 작성자에게 +20P를 지급합니다.' : '마감 시간이 지나거나 직접 마감 후 확정할 수 있습니다.'}</span></div>`;
}
function rewardCard(kind, post) {
  const label = KIND[kind]?.best || '베스트 참여작';
  return `<div class="best-reward-rule-card" data-best-reward-rule-card="1" data-post-id="${esc(post.id)}" data-kind="${esc(kind)}"><div class="best-reward-rule-card__head"><div><b>🏆 ${esc(label)} 산정 기준</b><span>반응 점수로 베스트 카드가 자동으로 돋보입니다.</span></div><small>자동 계산</small></div><div class="best-reward-rule-card__score"><span>👍 <b>1점</b></span><span>😂 <b>2점</b></span><span>🔥 <b>3점</b></span></div><div class="best-reward-rule-card__note">참여글에 반응이 쌓이면 점수가 높은 글이 베스트 카드로 표시됩니다. 마감 후 확정하면 1등 참여글 작성자에게 베스트 보상 +20P가 지급됩니다.</div>${awardStatus(post)}${rewardAction(post, kind)}</div>`;
}
function insertTarget() { return document.querySelector('[data-multi-modules-root]') || document.querySelector('.detail-body'); }
function insertStatus(html) {
  const target = insertTarget();
  if (!target) return false;
  if (target.matches('[data-multi-modules-root]')) target.insertAdjacentHTML('beforebegin', html);
  else target.insertAdjacentHTML('afterend', html);
  return true;
}
function insertReward(html) {
  const status = document.querySelector('[data-detail-game-status-card]');
  if (status) { status.insertAdjacentHTML('afterend', html); return true; }
  return insertStatus(html);
}
function bindRewardButton(card) {
  const btn = card?.querySelector('[data-best-reward-finalize]');
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';
  btn.addEventListener('click', async () => {
    const postId = card.dataset.postId;
    const kind = btn.dataset.kind;
    if (!postId || !kind) return;
    try {
      btn.disabled = true; btn.textContent = '확정 중...';
      const data = (await finalizeBestReward({ postId, kind, closeNow: true })).data || {};
      if (data.awarded) toast.success(data.message || `베스트 보상 +${data.points || 20}P 지급 완료`);
      else toast.info(data.message || '베스트 보상 확정 상태를 확인했어요.');
      const text = data.winner?.authorName ? `🏆 ${data.winner.authorName}님에게 베스트 보상 +${data.points || 20}P 지급 완료` : '🏆 베스트 보상 처리 완료';
      card.insertAdjacentHTML('beforeend', `<div class="best-reward-rule-card__result is-awarded">${esc(text)}</div>`);
      btn.remove();
    } catch (error) {
      console.error(error); toast.error(error.message || '베스트 보상 확정에 실패했어요.');
      btn.disabled = false; btn.textContent = '베스트 보상 확정';
    }
  });
}
async function enhanceDetailCards() {
  const postId = detailId();
  if (!postId) return;
  const root = document.getElementById('page-content');
  if (!root || !root.querySelector('.feed-card__type-badge')) return;
  if (document.querySelector('[data-detail-game-status-card]') && document.querySelector('[data-best-reward-rule-card]')) return;
  try {
    const snap = await getDoc(doc(db, 'feeds', postId));
    if (!snap.exists()) return;
    const post = { id: snap.id, ...snap.data() };
    if (post.type !== 'multi') return;
    const kind = activeKind(post);
    if (!kind || !KIND[kind]) return;
    if (!document.querySelector('[data-detail-game-status-card]')) insertStatus(statusCard(kind, await statsFor(postId, post, kind)));
    if (BEST_KINDS.has(kind) && !document.querySelector('[data-best-reward-rule-card]')) {
      insertReward(rewardCard(kind, post));
      bindRewardButton(document.querySelector('[data-best-reward-rule-card]'));
    }
  } catch (error) { console.warn('[detail-cards] enhance failed', error); }
}
let timer = null;
function schedule() { clearTimeout(timer); timer = setTimeout(enhanceDetailCards, 240); }
window.addEventListener('hashchange', schedule);
new MutationObserver(schedule).observe(document.documentElement, { childList: true, subtree: true });
setTimeout(schedule, 800);
