import { db, functions } from './firebase.js';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
} from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/12.12.0/firebase-functions.js';

const toggleReactionCallable = httpsCallable(functions, 'toggleReaction');
const addCommentCallable = httpsCallable(functions, 'addCourtComment');
const deleteCommentCallable = httpsCallable(functions, 'deleteCourtComment');
const reportCaseCallable = httpsCallable(functions, 'reportPublicCase');

function safe(value) {
  return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}
function dateValue(timestamp) { return timestamp?.toDate?.() || new Date(0); }
function formatDate(timestamp) {
  const date = dateValue(timestamp);
  return date.getTime() ? new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' }).format(date) : '';
}

export async function loadPublicCases() {
  const publicQuery = query(collection(db, 'public_results'), orderBy('createdAt', 'desc'), limit(40));
  const snapshot = await getDocs(publicQuery);
  return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
}

function weeklyKing(items) {
  const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
  return items.filter(item => dateValue(item.createdAt).getTime() >= weekAgo)
    .sort((a, b) => Number(b.reactionCount || 0) - Number(a.reactionCount || 0))[0] || items[0] || null;
}

export function boardPageHtml(items = []) {
  const king = weeklyKing(items);
  return `<section class="board-page"><div class="container"><div class="board-head"><div><div class="eyebrow">공개 황당재판</div><h1>남의 억울함은<br>왜 이렇게 흥미로운가</h1><p>공개에 동의한 사건만 모았습니다. 판결을 읽고 배심원처럼 공감하거나 의견을 남겨보세요.</p></div><a class="button button-primary" href="#/submit">내 사건 접수</a></div>
  ${king ? `<a class="weekly-king card" href="#/result/${encodeURIComponent(king.id)}"><span class="king-badge">이번 주 소소킹</span><strong>${safe(king.judgment?.headline || king.caseTitle)}</strong><p>${safe(king.judgment?.comedyLines?.[0] || king.judgment?.summary || '')}</p><small>공감 ${Number(king.reactionCount || 0)} · 댓글 ${Number(king.commentCount || 0)}</small></a>` : ''}
  ${items.length ? `<div class="board-grid">${items.map(item => `<a class="card board-card" href="#/result/${encodeURIComponent(item.id)}"><div class="board-card-meta"><span>${safe(item.category || '생활분쟁')}</span><span>${formatDate(item.createdAt)}</span></div><h2>${safe(item.judgment?.headline || item.caseTitle || '황당사건 판결')}</h2><p>${safe(item.judgment?.comedyLines?.[0] || item.judgment?.summary || '')}</p><div class="board-card-footer"><span>공감 ${Number(item.reactionCount || 0)}</span><span>댓글 ${Number(item.commentCount || 0)}</span><strong>판결 보기 →</strong></div></a>`).join('')}</div>` : `<div class="card empty-cases"><div class="receipt-check">⚖</div><h2>아직 공개 판결이 없습니다</h2><p>공개 사건의 첫 배심원이 되어보세요.</p><a class="button button-primary" href="#/submit">사건 접수</a></div>`}</div></section>`;
}

export async function loadCommunity(caseId, userId) {
  const resultRef = doc(db, 'public_results', caseId);
  const statsRef = doc(db, 'result_reactions', caseId);
  const commentsQuery = query(collection(db, 'court_comments', caseId, 'items'), orderBy('createdAt', 'asc'), limit(50));
  const tasks = [getDoc(resultRef), getDoc(statsRef), getDocs(commentsQuery)];
  if (userId) tasks.push(getDoc(doc(db, 'result_reactions', caseId, 'votes', userId)));
  const [resultSnap, statsSnap, commentsSnap, voteSnap] = await Promise.all(tasks);
  if (!resultSnap.exists()) return null;
  return {
    result: { id: resultSnap.id, ...resultSnap.data() },
    stats: statsSnap.exists() ? statsSnap.data() : { funny: 0, agree: 0, total: 0 },
    selected: voteSnap?.exists?.() ? voteSnap.data().type : null,
    comments: commentsSnap.docs.map(item => ({ id: item.id, ...item.data() })),
  };
}

export function communityPanelHtml(caseId, data, user) {
  const comments = data.comments || [];
  return `<section class="card community-panel" data-community-case="${safe(caseId)}"><div class="community-head"><div><span>온라인 배심원단</span><strong>이 판결에 대한 의견</strong></div><button class="report-case-button" type="button">신고</button></div><div class="reaction-row"><button class="reaction-button ${data.selected === 'funny' ? 'selected' : ''}" data-reaction="funny" type="button">😂 웃김 <strong>${Number(data.stats?.funny || 0)}</strong></button><button class="reaction-button ${data.selected === 'agree' ? 'selected' : ''}" data-reaction="agree" type="button">⚖️ 판결 동의 <strong>${Number(data.stats?.agree || 0)}</strong></button></div>
  <div class="comment-area"><h3>배심원 의견 <span>${comments.length}</span></h3>${user ? `<form class="comment-form"><input maxlength="300" placeholder="판결에 대한 의견을 남겨주세요" aria-label="댓글"><button class="button button-primary" type="submit">등록</button></form>` : `<p class="comment-login"><a href="#/login?next=${encodeURIComponent(`/result/${caseId}`)}">로그인</a>하면 공감과 댓글을 남길 수 있습니다.</p>`}<div class="comment-list">${comments.length ? comments.map(comment => `<article data-comment-id="${safe(comment.id)}"><div><strong>${safe(comment.displayName || '익명 배심원')}</strong><span>${formatDate(comment.createdAt)}</span></div><p>${safe(comment.body)}</p>${user && user.uid === comment.userId ? '<button class="delete-comment-button" type="button">삭제</button>' : ''}</article>`).join('') : '<p class="empty-comments">첫 배심원 의견을 남겨보세요.</p>'}</div></div></section>`;
}

export function bindCommunityActions({ caseId, user, refresh, notify }) {
  document.querySelectorAll('.reaction-button').forEach(button => button.addEventListener('click', async () => {
    if (!user) { location.hash = `#/login?next=${encodeURIComponent(`/result/${caseId}`)}`; return; }
    button.disabled = true;
    try { await toggleReactionCallable({ caseId, type: button.dataset.reaction }); await refresh(); }
    catch (error) { notify(error?.message || '반응을 저장하지 못했습니다.', true); button.disabled = false; }
  }));
  document.querySelector('.comment-form')?.addEventListener('submit', async event => {
    event.preventDefault();
    const input = event.currentTarget.querySelector('input');
    const body = input.value.trim();
    if (body.length < 2) { notify('댓글은 2자 이상 입력해 주세요.', true); return; }
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try { await addCommentCallable({ caseId, body }); input.value = ''; await refresh(); }
    catch (error) { notify(error?.message || '댓글을 저장하지 못했습니다.', true); button.disabled = false; }
  });
  document.querySelectorAll('.delete-comment-button').forEach(button => button.addEventListener('click', async () => {
    const commentId = button.closest('[data-comment-id]')?.dataset.commentId;
    if (!confirm('이 댓글을 삭제할까요?')) return;
    button.disabled = true;
    try { await deleteCommentCallable({ caseId, commentId }); await refresh(); }
    catch (error) { notify(error?.message || '댓글을 삭제하지 못했습니다.', true); button.disabled = false; }
  }));
  document.querySelector('.report-case-button')?.addEventListener('click', async () => {
    if (!user) { location.hash = `#/login?next=${encodeURIComponent(`/result/${caseId}`)}`; return; }
    const reason = prompt('신고 사유를 입력해 주세요.');
    if (!reason) return;
    try { await reportCaseCallable({ caseId, reason }); notify('신고를 접수했습니다.'); }
    catch (error) { notify(error?.message || '신고를 접수하지 못했습니다.', true); }
  });
}
