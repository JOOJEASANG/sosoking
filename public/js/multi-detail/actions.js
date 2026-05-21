import { db, functions } from '../firebase.js';
import { doc, collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const callCastMultiVote = httpsCallable(functions, 'castMultiVote');
const callAddMultiParticipation = httpsCallable(functions, 'addMultiParticipation');
const callAddMultiItemReply = httpsCallable(functions, 'addMultiItemReply');
const callReactMultiItem = httpsCallable(functions, 'reactMultiItem');

export async function fetchItems(postId, kind) {
  const snap = await getDocs(query(collection(db, 'feeds', postId, `multi_${kind}`), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addParticipation(postId, kind, data) {
  const result = await callAddMultiParticipation({ postId, kind, payload: data });
  return result.data || { ok: true };
}

export function itemRef(postId, kind, itemId) {
  return doc(db, 'feeds', postId, `multi_${kind}`, itemId);
}

export async function addItemReaction(postId, kind, itemId, key) {
  const result = await callReactMultiItem({ postId, kind, itemId, reaction: key });
  return result.data || { ok: true };
}

export async function fetchReplies(postId, kind, itemId) {
  const snap = await getDocs(query(collection(db, 'feeds', postId, `multi_${kind}`, itemId, 'replies'), orderBy('createdAt', 'asc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function addItemReply(postId, kind, itemId, text) {
  const result = await callAddMultiItemReply({ postId, kind, itemId, text });
  return result.data || { ok: true };
}

export async function applyVote(postRef, post, idx) {
  const result = await callCastMultiVote({ postId: post.id || postRef.id, optionIdx: idx });
  return result.data?.post || post;
}