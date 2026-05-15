/* feed-service.js — 피드 Firestore CRUD 서비스 */
import { db, auth } from '../firebase.js';
import {
  collection, query, orderBy, limit, startAfter,
  getDocs, getDoc, addDoc, updateDoc, deleteDoc,
  where, doc, increment, serverTimestamp, arrayUnion,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const FEEDS = 'feeds';
const PAGE  = 15;

/** 피드 목록 조회 */
export async function fetchFeeds({ cat = '', type = '', lastDoc = null, pageSize = PAGE } = {}) {
  const constraints = [orderBy('createdAt', 'desc'), limit(pageSize)];
  if (type)      constraints.unshift(where('type', '==', type));
  else if (cat)  constraints.unshift(where('cat',  '==', cat));
  if (lastDoc)   constraints.push(startAfter(lastDoc));

  const snap = await getDocs(query(collection(db, FEEDS), ...constraints));
  return {
    posts:   snap.docs.map(d => ({ id: d.id, ...d.data() })),
    lastDoc: snap.docs[snap.docs.length - 1] || null,
    hasMore: snap.docs.length >= pageSize,
  };
}

/** 단건 조회 */
export async function fetchPost(id) {
  const snap = await getDoc(doc(db, FEEDS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

/** 인기 피드 (반응 많은 순) */
export async function fetchHotPosts(n = 5) {
  try {
    const snap = await getDocs(
      query(collection(db, FEEDS), orderBy('reactions.total', 'desc'), limit(n))
    );
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {
    try {
      const snap = await getDocs(
        query(collection(db, FEEDS), orderBy('createdAt', 'desc'), limit(n))
      );
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
      return [];
    }
  }
}

/** 내 피드 */
export async function fetchMyPosts(uid, n = 20) {
  const snap = await getDocs(
    query(collection(db, FEEDS), where('authorId', '==', uid), orderBy('createdAt', 'desc'), limit(n))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** 게시물 작성 */
export async function createPost(data) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요');
  return addDoc(collection(db, FEEDS), {
    ...data,
    authorId:    user.uid,
    authorName:  user.displayName || '익명',
    authorPhoto: user.photoURL || '',
    reactions:   { total: 0 },
    commentCount: 0,
    viewCount:    0,
    votedBy:      [],
    createdAt:    serverTimestamp(),
  });
}

/** 조회수 증가 */
export async function incrementView(id) {
  return updateDoc(doc(db, FEEDS, id), { viewCount: increment(1) });
}

/** 반응 추가 */
export async function addReaction(postId, reactionKey) {
  return updateDoc(doc(db, FEEDS, postId), {
    [`reactions.${reactionKey}`]: increment(1),
    [`reactions.total`]:          increment(1),
  });
}

/** 투표 (read-modify-write) */
export async function castVote(postId, optionIdx) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요');

  const postRef  = doc(db, FEEDS, postId);
  const snapshot = await getDoc(postRef);
  const data     = snapshot.data();

  if ((data.votedBy || []).includes(user.uid)) throw new Error('이미 투표했어요');

  const options = (data.options || []).map((opt, i) =>
    i === optionIdx ? { ...opt, votes: (opt.votes || 0) + 1 } : opt
  );
  await updateDoc(postRef, { options, votedBy: arrayUnion(user.uid) });
  return options;
}

/** 댓글 목록 */
export async function fetchComments(postId) {
  const snap = await getDocs(
    query(collection(db, FEEDS, postId, 'comments'), orderBy('createdAt', 'asc'))
  );
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/** 댓글 작성 */
export async function addComment(postId, text) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요');

  await addDoc(collection(db, FEEDS, postId, 'comments'), {
    text,
    authorId:    user.uid,
    authorName:  user.displayName || '익명',
    createdAt:   serverTimestamp(),
  });
  await updateDoc(doc(db, FEEDS, postId), { commentCount: increment(1) });
}

/** 게시물 삭제 (관리자 또는 작성자) */
export async function deletePost(id) {
  return deleteDoc(doc(db, FEEDS, id));
}
