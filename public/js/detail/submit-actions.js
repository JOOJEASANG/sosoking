import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import { addDoc, collection, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ensureAnonymousActor } from './action-utils.js';

export async function submitDetailComment(postId, data = {}) {
  if (!(await ensureAnonymousActor('댓글 등록에 실패했어요.'))) return null;
  const text = String(data.text || '').trim().slice(0, 500);
  if (!text) throw new Error('내용을 입력해주세요.');

  const anonymous = auth.currentUser?.isAnonymous === true;
  const guestName = String(data.guestName || '').replace(/[^가-힣a-zA-Z0-9_]/g, '').slice(0, 12);
  const authorName = anonymous
    ? (guestName.length >= 2 ? guestName : '익명')
    : (appState.nickname || auth.currentUser?.displayName || '회원');

  const payload = {
    text,
    authorId: auth.currentUser.uid,
    authorName,
    authorPhoto: anonymous ? '' : (auth.currentUser.photoURL || ''),
    isGuest: anonymous,
    reactions: { like: 0, funny: 0, fire: 0 },
    reactedWith: {},
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(collection(db, 'feeds', postId, 'comments'), payload);
  return { id: ref.id, ...payload, createdAt: new Date() };
}
