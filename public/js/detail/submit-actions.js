import { auth, db } from '../firebase.js';
import { appState } from '../state.js';
import { addDoc, collection, doc, increment, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { ensureAnonymousActor } from './action-utils.js';
import { getPoliticalRank } from '../utils/political-rank.js';

export async function submitDetailComment(postId, data = {}) {
  if (!(await ensureAnonymousActor('댓글 등록에 실패했어요'))) return null;
  const text = String(data.text || '').trim();
  if (!text) throw new Error('내용을 입력해주세요');

  const isAnonymousUser = auth.currentUser?.isAnonymous;
  const guestName = String(data.guestName || '').trim().slice(0, 12);
  const authorName = isAnonymousUser
    ? (guestName || '익명')
    : (appState.nickname || auth.currentUser?.displayName || '익명');

  const payload = {
    text,
    authorId: auth.currentUser.uid,
    authorName,
    authorPhoto: isAnonymousUser ? '' : (auth.currentUser?.photoURL || ''),
    isGuest: isAnonymousUser || false,
    reactions: {},
    reactedWith: {},
    createdAt: serverTimestamp(),
  };

  if (!isAnonymousUser && appState.partyId) payload.partyId = appState.partyId;
  if (!isAnonymousUser) {
    const rank = getPoliticalRank(appState.points || 0);
    payload.rankEmoji = rank.emoji;
    payload.rankLabel = rank.label;
  }

  const ref = await addDoc(collection(db, 'feeds', postId, 'comments'), payload);
  await updateDoc(doc(db, 'feeds', postId), { commentCount: increment(1) }).catch(e => console.warn('commentCount update failed:', e));
  return { id: ref.id, ...payload, createdAt: new Date() };
}
