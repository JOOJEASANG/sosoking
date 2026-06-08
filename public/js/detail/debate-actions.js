import { auth, functions } from '../firebase.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import { signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { toast } from '../components/toast.js';
import { isDetailPath } from './action-utils.js';
import { renderDebateCommentForm } from './comment-render.js';

const voteDebateSideFn = httpsCallable(functions, 'voteDebateSide');

function voteKey(postId) { return `debate_vote_${postId}`; }
function decoyKey(commentId) { return `decoy_flag_${commentId}`; }

export function getDebateVote(postId) {
  return localStorage.getItem(voteKey(postId)) || '';
}

function saveDebateVote(postId, side) {
  localStorage.setItem(voteKey(postId), side);
}

function applyVoteButtonState(side) {
  document.querySelectorAll('.ai-debate-vote-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.side === side);
    btn.disabled = true;
  });
  const hint = document.getElementById('debate-vote-hint');
  if (hint) hint.textContent = side === 'A' ? '🔴 A편에 투표했어요!' : '🔵 B편에 투표했어요!';
}

function updateVoteCounts(voteA, voteB) {
  const total = voteA + voteB;
  const pctA = total ? Math.round(voteA / total * 100) : 50;
  const pctB = total ? Math.round(voteB / total * 100) : 50;
  const elA = document.getElementById('debate-count-a');
  const elB = document.getElementById('debate-count-b');
  if (elA) elA.textContent = `${voteA}표 (${pctA}%)`;
  if (elB) elB.textContent = `${voteB}표 (${pctB}%)`;
}

function unlockCommentForm(side) {
  const commentWrite = document.getElementById('comment-write');
  if (!commentWrite) return;
  const loggedIn = !!auth.currentUser;
  commentWrite.innerHTML = renderDebateCommentForm(side, loggedIn);
}

export function initDebateVote(postId) {
  const side = getDebateVote(postId);
  if (!side) return;
  applyVoteButtonState(side);
}

export async function handleDebateVote(event) {
  const btn = event.target.closest?.('.ai-debate-vote-btn');
  if (!btn || !isDetailPath()) return false;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  if (btn._pending) return true;

  const area = btn.closest('[data-post-id]');
  const postId = area?.dataset.postId || '';
  if (!postId) return true;

  const side = btn.dataset.side;
  if (!['A', 'B'].includes(side)) return true;

  const existing = getDebateVote(postId);
  if (existing) {
    toast.info(existing === 'A' ? '이미 🔴 A편에 투표했어요!' : '이미 🔵 B편에 투표했어요!');
    applyVoteButtonState(existing);
    unlockCommentForm(existing);
    return true;
  }

  // 1) 낙관적 업데이트 — 즉시 로컬에 기록하고 UI 반영.
  //    비로그인 상태에서 익명 로그인 시 onAuthStateChanged가 페이지를 재렌더하므로,
  //    localStorage에 먼저 저장해 두면 재렌더 후에도 투표 상태가 그대로 복원된다.
  btn._pending = true;
  saveDebateVote(postId, side);
  applyVoteButtonState(side);
  unlockCommentForm(side);
  toast.success(side === 'A' ? '🔴 A편 투표완료! 댓글도 남겨봐요 👇' : '🔵 B편 투표완료! 댓글도 남겨봐요 👇');

  // 2) 서버 반영 (백그라운드). 재렌더로 DOM이 교체돼도 getElementById로 최신 노드를 찾는다.
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
    const res = await voteDebateSideFn({ postId, side });
    const data = res.data || {};
    if (data.side && data.side !== side) {
      saveDebateVote(postId, data.side);
      applyVoteButtonState(data.side);
      unlockCommentForm(data.side);
    }
    updateVoteCounts(data.voteA || 0, data.voteB || 0);
  } catch (e) {
    console.warn('[debate vote] persist failed', e);
  }
  return true;
}

export function handleAiDecoyFlag(event) {
  const btn = event.target.closest?.('.debate-decoy-btn');
  if (!btn || !isDetailPath()) return false;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();

  const commentId = btn.dataset.commentId;
  if (!commentId) return true;

  const key = decoyKey(commentId);
  const flagged = !!localStorage.getItem(key);
  if (flagged) {
    localStorage.removeItem(key);
    btn.classList.remove('active');
    btn.title = 'AI 댓글 의심';
  } else {
    localStorage.setItem(key, '1');
    btn.classList.add('active');
    btn.title = 'AI 의심 취소';
    toast.info('AI 의심 표시! 24시간 후 공개돼요 🤖');
  }
  return true;
}
