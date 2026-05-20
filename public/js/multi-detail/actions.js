import { auth, db } from '../firebase.js';
import { doc, updateDoc, increment, addDoc, collection, serverTimestamp, getDocs, getDoc, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { appState } from '../state.js';

export async function fetchItems(postId, kind) {
  const snap = await getDocs(query(collection(db, 'feeds', postId, `multi_${kind}`), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getCurrentAuthorName() {
  const user = auth.currentUser;
  if (!user) return '익명';
  const cached = appState.nickname || user.displayName || user.email?.split('@')[0] || '';
  if (cached && cached !== '익명') return cached;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    const data = snap.exists() ? snap.data() : {};
    const nickname = data.nickname || data.displayName || data.name || cached || user.email?.split('@')[0] || '익명';
    appState.nickname = nickname;
    return nickname;
  } catch {
    return cached || '익명';
  }
}

export async function addParticipation(postId, kind, data) {
  const user = auth.currentUser;
  const authorName = await getCurrentAuthorName();
  await addDoc(collection(db, 'feeds', postId, `multi_${kind}`), {
    ...data,
    authorId: user.uid,
    authorName,
    authorEmail: user.email || '',
    authorPhoto: user.photoURL || '',
    reactions: {},
    replyCount: 0,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'feeds', postId), { commentCount: increment(1) }).catch(() => {});
}

export function itemRef(postId, kind, itemId) {
  return doc(db, 'feeds', postId, `multi_${kind}`, itemId);
}

export async function addItemReaction(postId, kind, itemId, key) {
  await updateDoc(itemRef(postId, kind, itemId), { [`reactions.${key}`]: increment(1) });
}

export async function fetchReplies(postId, kind, itemId) {
  const snap = await getDocs(query(collection(db, 'feeds', postId, `multi_${kind}`, itemId, 'replies'), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addItemReply(postId, kind, itemId, text) {
  const user = auth.currentUser;
  const authorName = await getCurrentAuthorName();
  await addDoc(collection(db, 'feeds', postId, `multi_${kind}`, itemId, 'replies'), {
    text,
    authorId: user.uid,
    authorName,
    authorEmail: user.email || '',
    authorPhoto: user.photoURL || '',
    createdAt: serverTimestamp(),
  });
  await updateDoc(itemRef(postId, kind, itemId), { replyCount: increment(1) }).catch(() => {});
}

export async function applyVote(postRef, post, idx, freshData) {
  const vote = freshData.modules?.vote || {};
  const uid = auth.currentUser.uid;
  if ((vote.votedBy || []).includes(uid)) throw new Error('이미 투표했어요');

  const options = (vote.options || []).map((opt, i) => (
    i === idx ? { ...opt, votes: Number(opt.votes || 0) + 1 } : opt
  ));
  const votedBy = [...(vote.votedBy || []), uid];
  await updateDoc(postRef, {
    'modules.vote.options': options,
    'modules.vote.votedBy': votedBy,
  });

  return { ...post, modules: { ...post.modules, vote: { ...vote, options, votedBy } } };
}
