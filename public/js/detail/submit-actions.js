import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ensureAnonymousActor } from './action-utils.js';

function authorPayload() {
  return {
    authorId: auth.currentUser.uid,
    authorName: appState.nickname || auth.currentUser.displayName || '익명',
    authorPhoto: auth.currentUser.photoURL || '',
  };
}

export async function submitDetailComment(postId, data = {}) {
  if (!(await ensureAnonymousActor('로그인 후 참여해주세요'))) return null;
  const text = String(data.text || '').trim();
  if (!text) throw new Error('내용을 입력해주세요');

  const payload = {
    text,
    ...authorPayload(),
    reactions: {},
    reactedWith: {},
    createdAt: serverTimestamp(),
  };

  if (data.side) payload.side = data.side;

  const ref = await addDoc(collection(db, 'feeds', postId, 'comments'), payload);
  await updateDoc(doc(db, 'feeds', postId), { commentCount: increment(1) }).catch(e => console.warn('commentCount update failed:', e));
  return { id: ref.id, ...payload, createdAt: new Date() };
}

export async function submitCharParticipation(postId, text) {
  return submitDetailComment(postId, { text });
}

export async function submitRelayComment(postId, text) {
  return submitDetailComment(postId, { text });
}

export async function submitCbattleComment(postId, text, side) {
  if (!side) throw new Error('A팀 또는 B팀을 선택해주세요');
  return submitDetailComment(postId, { text, side });
}

export async function submitAcrosticEntry(postId, keyword, lines) {
  if (!(await ensureAnonymousActor('로그인 후 참여해주세요'))) return null;
  const chars = [...String(keyword || '')];
  const values = Array.isArray(lines) ? lines.map(v => String(v || '').trim()) : [];
  if (!chars.length) throw new Error('제시어를 찾을 수 없어요');
  if (values.length !== chars.length || values.some(v => !v)) throw new Error('모든 줄을 입력해주세요');

  const lineObjects = chars.map((char, index) => ({ char, line: values[index] }));
  const text = lineObjects.map(item => `${item.char}: ${item.line}`).join('\n');

  const payload = {
    text,
    lines: lineObjects,
    ...authorPayload(),
    reactions: {},
    reactedWith: {},
    replyCount: 0,
    createdAt: serverTimestamp(),
  };

  const ref = await addDoc(collection(db, 'feeds', postId, 'acrostics'), payload);
  await updateDoc(doc(db, 'feeds', postId), { acrosticCount: increment(1) }).catch(() => {});
  return { id: ref.id, ...payload, createdAt: new Date() };
}

export function getSelectedCbattleSide(root = document) {
  return root.querySelector('.cbattle-side-btn.active')?.dataset.side || '';
}

export function bindCbattleSideButtons(root = document) {
  root.querySelectorAll('.cbattle-side-btn').forEach(btn => {
    if (btn.dataset.sideReady === '1') return;
    btn.dataset.sideReady = '1';
    btn.addEventListener('click', event => {
      event.preventDefault();
      root.querySelectorAll('.cbattle-side-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });
}
