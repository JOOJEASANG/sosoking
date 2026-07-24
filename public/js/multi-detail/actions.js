import { db, functions } from '../firebase.js';
import { collection, getDocs, orderBy, query } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const callVote = httpsCallable(functions, 'castCommunityVote');
const callAddDrip = httpsCallable(functions, 'addDripParticipation');
const callAddReply = httpsCallable(functions, 'addDripReply');
const callReactDrip = httpsCallable(functions, 'reactDripItem');

export async function fetchDrips(postId) {
  const snap = await getDocs(query(collection(db, 'feeds', postId, 'multi_drip'), orderBy('createdAt', 'asc')));
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function fetchDripReplies(postId, itemId) {
  const snap = await getDocs(query(collection(db, 'feeds', postId, 'multi_drip', itemId, 'replies'), orderBy('createdAt', 'asc')));
  return snap.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() }));
}

export async function applyVote(postId, optionIdx) {
  const result = await callVote({ postId, optionIdx });
  return result.data || { ok: true };
}

export async function addDrip(postId, text) {
  const result = await callAddDrip({ postId, text });
  return result.data || { ok: true };
}

export async function addDripReply(postId, itemId, text) {
  const result = await callAddReply({ postId, itemId, text });
  return result.data || { ok: true };
}

export async function reactDrip(postId, itemId, reaction) {
  const result = await callReactDrip({ postId, itemId, reaction });
  return result.data || { ok: true };
}
