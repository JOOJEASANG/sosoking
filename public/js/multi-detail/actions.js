import { auth, db } from '../firebase.js';
import { doc, updateDoc, increment, addDoc, collection, serverTimestamp, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { appState } from '../state.js';

export async function fetchItems(postId, kind) {
  const snap = await getDocs(query(collection(db, 'feeds', postId, `multi_${kind}`), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addParticipation(postId, kind, data) {
  await addDoc(collection(db, 'feeds', postId, `multi_${kind}`), {
    ...data,
    authorId: auth.currentUser.uid,
    authorName: appState.nickname || auth.currentUser.displayName || '익명',
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
  await addDoc(collection(db, 'feeds', postId, `multi_${kind}`, itemId, 'replies'), {
    text,
    authorId: auth.currentUser.uid,
    authorName: appState.nickname || auth.currentUser.displayName || '익명',
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

  return {
    ...post,
    modules: {
      ...post.modules,
      vote: { ...vote, options, votedBy },
    },
  };
}
