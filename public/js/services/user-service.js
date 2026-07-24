import { db, functions } from '../firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';

const provisionUserProfile = httpsCallable(functions, 'provisionUserProfile');
const updateNickname = httpsCallable(functions, 'updateNickname');
const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;

function nicknameCandidate(user) {
  return String(user?.displayName || user?.email?.split('@')[0] || '소소회원')
    .replace(/[^가-힣a-zA-Z0-9_]/g, '')
    .slice(0, 12);
}

export async function ensureUserProvisioned(user) {
  if (!user || user.isAnonymous) return null;
  const snap = await getDoc(doc(db, 'users', user.uid)).catch(() => null);
  if (snap?.exists() && snap.data()?.nickname) return snap.data().nickname;
  const result = await provisionUserProfile({ nickname: nicknameCandidate(user) });
  return result.data?.nickname || null;
}

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

export async function saveUserProfile(uid, data = {}) {
  const patch = { updatedAt: serverTimestamp() };
  if ('bio' in data) patch.bio = String(data.bio || '').slice(0, 500);
  if ('photoURL' in data) patch.photoURL = String(data.photoURL || '').slice(0, 500);
  if (Object.keys(patch).length > 1) await setDoc(doc(db, 'users', uid), patch, { merge: true });
  if (data.nickname) await registerNickname(data.nickname);
}

export async function checkNickname(nickname) {
  const value = String(nickname || '').trim();
  if (!NICK_RE.test(value)) return false;
  const snap = await getDoc(doc(db, 'nicknames', value));
  return !snap.exists();
}

export async function registerNickname(nickname) {
  const value = String(nickname || '').trim();
  if (!NICK_RE.test(value)) throw new Error('닉네임은 한글, 영문, 숫자, _를 사용한 2~12자여야 합니다.');
  const result = await updateNickname({ nickname: value });
  return result.data?.nickname || value;
}
