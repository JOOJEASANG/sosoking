/* user-service.js — 사용자 프로필 서비스 */
import { db, auth } from '../firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

/** 사용자 프로필 조회 */
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/** 프로필 저장/업데이트 (upsert) */
export async function saveUserProfile(uid, data) {
  await setDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

/** 닉네임 중복 확인 */
export async function checkNickname(nickname) {
  const snap = await getDoc(doc(db, 'nicknames', nickname));
  return !snap.exists(); // true = 사용 가능
}

/** 닉네임 등록 */
export async function registerNickname(nickname) {
  const user = auth.currentUser;
  if (!user) throw new Error('로그인이 필요해요');

  // NOTE: TOCTOU race condition 가능. 실제 중복 방지는 Firestore Rules의 create 조건으로 처리.
  // 동시 등록 시도가 매우 드물고, 규칙에서 최종 방어.
  const exists = await getDoc(doc(db, 'nicknames', nickname));
  if (exists.exists() && exists.data().uid !== user.uid) {
    throw new Error('이미 사용 중인 닉네임이에요');
  }

  await setDoc(doc(db, 'nicknames', nickname), { uid: user.uid, createdAt: serverTimestamp() }, { merge: false });
  await saveUserProfile(user.uid, { nickname });
}
