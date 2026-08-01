import { auth, functions } from '/js/firebase.js?v=20260729-auth-session-1';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const app = document.getElementById('dripso-app');
const toast = document.getElementById('toast');
const getOwnership = httpsCallable(functions, 'getDripsoOwnership');
const deleteTopic = httpsCallable(functions, 'deleteOwnDripsoTopic');
const deleteComment = httpsCallable(functions, 'deleteOwnDripsoComment');
const submitReport = httpsCallable(functions, 'submitDripsoReport');
let decorateTimer = 0;
let decorating = false;

function showToast(message) {
  if (!toast) return;
  toast.textContent = String(message || '');
  toast.hidden = false;
  window.setTimeout(() => { toast.hidden = true; }, 2400);
}

function errorMessage(error, fallback) {
  return String(error?.message || '')
    .replace(/^FirebaseError:\s*/i, '')
    .replace(/^functions\/[a-z-]+:\s*/i, '') || fallback;
}

function topicIdFromHash() {
  const match = (location.hash || '').match(/^#\/topic\/([^/?#]+)/);
  if (!match) return '';
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return '';
  }
}

function injectStyles() {
  if (document.getElementById('dripso-moderation-styles')) return;
  const style = document.createElement('style');
  style.id = 'dripso-moderation-styles';
  style.textContent = `
    .dripso-target-actions{display:flex;gap:7px;flex-wrap:wrap;margin-top:12px}
    .dripso-target-actions.comment-actions{margin-top:9px}
    .dripso-action-button{border:1px solid rgba(255,255,255,.16);background:#17111f;color:#cfc3d7;border-radius:999px;padding:7px 11px;font:700 11px/1.2 'Noto Sans KR',sans-serif;cursor:pointer}
    .dripso-action-button:hover{border-color:rgba(255,209,102,.62);color:#ffd166}
    .dripso-action-button.delete{border-color:rgba(255,113,143,.35);color:#ff8da8}
    .dripso-action-button:disabled{opacity:.48;cursor:wait}
  `;
  document.head.append(style);
}

function actionButton(label, action, targetType, topicId, commentId = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `dripso-action-button${action === 'delete' ? ' delete' : ''}`;
  button.textContent = label;
  button.dataset.dripsoAction = action;
  button.dataset.targetType = targetType;
  button.dataset.topicId = topicId;
  if (commentId) button.dataset.commentId = commentId;
  return button;
}

function addTopicActions(topicId, owned) {
  const detail = app.querySelector('.topic-detail');
  if (!detail || detail.querySelector('[data-dripso-topic-actions]')) return;
  const actions = document.createElement('div');
  actions.className = 'dripso-target-actions';
  actions.dataset.dripsoTopicActions = 'true';
  actions.append(owned
    ? actionButton('내 주제 삭제', 'delete', 'topic', topicId)
    : actionButton('주제 신고', 'report', 'topic', topicId));
  const author = detail.querySelector('.topic-author');
  if (author) author.insertAdjacentElement('afterend', actions);
  else detail.append(actions);
}

function addCommentActions(topicId, ownedIds) {
  app.querySelectorAll('.comment-card').forEach(card => {
    if (card.querySelector('[data-dripso-comment-actions]')) return;
    const like = card.querySelector('[data-like][data-topic]');
    const commentId = card.dataset.commentId || like?.dataset.like || '';
    if (!commentId) return;
    const actions = document.createElement('div');
    actions.className = 'dripso-target-actions comment-actions';
    actions.dataset.dripsoCommentActions = 'true';
    actions.append(ownedIds.has(commentId)
      ? actionButton('내 댓글 삭제', 'delete', 'comment', topicId, commentId)
      : actionButton('댓글 신고', 'report', 'comment', topicId, commentId));
    card.append(actions);
  });
}

async function loadOwnership(topicId, commentIds) {
  const ownedIds = new Set();
  let topicOwned = false;
  const chunks = [];
  for (let index = 0; index < commentIds.length; index += 100) {
    chunks.push(commentIds.slice(index, index + 100));
  }
  if (!chunks.length) chunks.push([]);

  for (const chunk of chunks) {
    const response = await getOwnership({ topicId, commentIds: chunk });
    if (response.data?.topicOwned === true) topicOwned = true;
    for (const commentId of response.data?.ownedCommentIds || []) ownedIds.add(commentId);
  }
  return { topicOwned, ownedIds };
}

async function decorate() {
  if (decorating) return;
  const topicId = topicIdFromHash();
  if (!topicId || !auth.currentUser || auth.currentUser.isAnonymous) return;
  const detail = app.querySelector('.topic-detail');
  if (!detail) return;

  const cards = [...app.querySelectorAll('.comment-card')];
  const missingTopic = !detail.querySelector('[data-dripso-topic-actions]');
  const missingComment = cards.some(card => !card.querySelector('[data-dripso-comment-actions]'));
  if (!missingTopic && !missingComment) return;

  decorating = true;
  try {
    const commentIds = cards
      .map(card => card.dataset.commentId || card.querySelector('[data-like]')?.dataset.like || '')
      .filter(Boolean);
    const ownership = await loadOwnership(topicId, commentIds);
    addTopicActions(topicId, ownership.topicOwned);
    addCommentActions(topicId, ownership.ownedIds);
  } catch (error) {
    console.warn('Dripso ownership decoration failed:', error?.code || error);
  } finally {
    decorating = false;
  }
}

function scheduleDecorate() {
  window.clearTimeout(decorateTimer);
  decorateTimer = window.setTimeout(() => void decorate(), 100);
}

app.addEventListener('click', async event => {
  const button = event.target.closest('[data-dripso-action]');
  if (!button) return;
  if (!auth.currentUser || auth.currentUser.isAnonymous) {
    showToast('로그인 후 이용할 수 있습니다.');
    return;
  }

  const action = button.dataset.dripsoAction;
  const targetType = button.dataset.targetType;
  const topicId = button.dataset.topicId;
  const commentId = button.dataset.commentId || '';
  button.disabled = true;
  try {
    if (action === 'report') {
      const reason = window.prompt('신고 사유를 5자 이상 입력해 주세요.');
      if (reason === null) return;
      await submitReport({ targetType, topicId, commentId, reason: reason.trim() });
      showToast('신고가 접수됐습니다.');
      button.textContent = '신고 완료';
      return;
    }

    const targetLabel = targetType === 'topic' ? '주제와 모든 댓글' : '댓글';
    if (!window.confirm(`${targetLabel}을 삭제할까요? 삭제 후 복구할 수 없습니다.`)) return;
    if (targetType === 'topic') {
      await deleteTopic({ topicId });
      showToast('주제가 삭제됐습니다.');
      location.hash = '#/';
    } else {
      await deleteComment({ topicId, commentId });
      showToast('댓글이 삭제됐습니다.');
      location.reload();
    }
  } catch (error) {
    showToast(errorMessage(error, action === 'report' ? '신고에 실패했습니다.' : '삭제에 실패했습니다.'));
  } finally {
    button.disabled = false;
  }
});

injectStyles();
await auth.authStateReady().catch(() => null);
new MutationObserver(scheduleDecorate).observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', scheduleDecorate);
scheduleDecorate();
