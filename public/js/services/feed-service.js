import { db, auth, functions } from '../firebase.js';
import { appState } from '../state.js';
import {
  collection, query, orderBy, limit, startAfter, getDocs, getDoc,
  where, doc, addDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const FEEDS = 'feeds';
const createCommunityPost = httpsCallable(functions, 'createCommunityPost');
const incrementPostView = httpsCallable(functions, 'incrementPostView');
const reactToPost = httpsCallable(functions, 'reactToPost');
const castCommunityVote = httpsCallable(functions, 'castCommunityVote');
const deleteOwnPost = httpsCallable(functions, 'deleteOwnPost');

export async function fetchFeeds({ subtype = '', lastDoc = null, pageSize = 20 } = {}) {
  const constraints = [where('hidden', '==', false)];
  if (subtype) constraints.push(where('subtype', '==', subtype));
  constraints.push(orderBy('createdAt', 'desc'), limit(Math.max(1, Math.min(50, pageSize))));
  if (lastDoc) constraints.push(startAfter(lastDoc));
  const snap = await getDocs(query(collection(db, FEEDS), ...constraints));
  return {
    posts: snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() })),
    lastDoc: snap.docs.at(-1) || null,
    hasMore: snap.size >= pageSize,
  };
}

export async function fetchPost(id) {
  const snap = await getDoc(doc(db, FEEDS, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function fetchHotPosts(max = 5) {
  try {
    const snap = await getDocs(query(
      collection(db, FEEDS),
      where('hidden', '==', false),
      orderBy('reactions.total', 'desc'),
      limit(Math.max(1, Math.min(30, max))),
    ));
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  } catch {
    const snap = await getDocs(query(
      collection(db, FEEDS),
      where('hidden', '==', false),
      orderBy('createdAt', 'desc'),
      limit(Math.max(1, Math.min(30, max))),
    ));
    return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
  }
}

export async function fetchTodayBest() {
  const posts = await fetchHotPosts(30);
  const since = Date.now() - 86400000;
  return posts.find(post => {
    const date = post.createdAt?.toDate?.() || post.createdAt;
    return date && new Date(date).getTime() >= since;
  }) || posts[0] || null;
}

export async function fetchMyPosts(uid, max = 20) {
  const snap = await getDocs(query(
    collection(db, FEEDS),
    where('authorId', '==', uid),
    orderBy('createdAt', 'desc'),
    limit(Math.max(1, Math.min(100, max))),
  ));
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function createPost(data = {}) {
  const preset = ['judgment', 'consult', 'vote', 'drip'].includes(data.subtype) ? data.subtype : 'judgment';
  const result = await createCommunityPost({
    preset,
    title: data.title || '',
    desc: data.desc || data.body || '',
    tags: data.tags || [],
    images: data.images || [],
    topic: data.modules?.consult?.topic,
    style: data.modules?.consult?.style,
  });
  return { id: result.data?.postId };
}

export async function incrementView(id) {
  return incrementPostView({ postId: id });
}

export async function addReaction(postId, reactionKey) {
  return reactToPost({ postId, reaction: reactionKey });
}

export async function castVote(postId, optionIdx) {
  return castCommunityVote({ postId, optionIdx });
}

export async function fetchComments(postId) {
  const snap = await getDocs(query(collection(db, FEEDS, postId, 'comments'), orderBy('createdAt', 'asc')));
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function addComment(postId, text) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요합니다.');
  return addDoc(collection(db, FEEDS, postId, 'comments'), {
    text: String(text || '').trim().slice(0, 500),
    authorId: user.uid,
    authorName: appState.nickname || user.displayName || '익명',
    authorPhoto: user.isAnonymous ? '' : (user.photoURL || ''),
    isGuest: user.isAnonymous === true,
    reactions: { like: 0, funny: 0, fire: 0 },
    reactedWith: {},
    createdAt: serverTimestamp(),
  });
}

export async function deletePost(id) {
  return deleteOwnPost({ postId: id });
}
