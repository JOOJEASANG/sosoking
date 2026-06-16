/* user-service.js — 사용자 프로필 서비스 */
import { db, auth } from '../firebase.js';
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const NICK_RE = /^[가-힣a-zA-Z0-9_]{2,12}$/;

/** displayName/email 등에서 규칙(2~12자, 한글·영문·숫자·_)에 맞는 닉네임 후보 생성 */
function buildNicknameCandidate(raw, salt = '') {
  let base = String(raw || '').replace(/[^가-힣a-zA-Z0-9_]/g, '');
  if (!base) base = '소소킹';
  const suffix = String(salt || '');
  if (suffix) {
    base = base.slice(0, Math.max(2, 12 - suffix.length)) + suffix;
  }
  base = base.slice(0, 12);
  if (base.length < 2) base = (base + '00').slice(0, 12);
  return base;
}

/**
 * 첫 로그인 사용자에게 users/{uid} 문서와 고유 닉네임을 프로비저닝한다.
 * - 이미 닉네임이 있는 문서면 그대로 반환(카카오는 서버에서 생성하므로 스킵됨)
 * - 닉네임 충돌 시 숫자 접미사를 붙여 재시도
 * 반환: 확정된 닉네임(또는 실패 시 null)
 */
export async function ensureUserProvisioned(user) {
  if (!user || user.isAnonymous) return null;

  const userRef = doc(db, 'users', user.uid);
  const snap = await getDoc(userRef).catch(() => null);
  if (snap?.exists()) {
    const data = snap.data() || {};
    if (data.nickname) return data.nickname;
    // 문서는 있지만 닉네임이 없는 경우: 클라이언트 update 규칙이 막으므로 추가 작업하지 않음
    return data.nickname || null;
  }

  const rawBase = user.displayName || user.email?.split('@')[0] || '소소킹';
  const providerId = user.providerData?.[0]?.providerId || 'password';

  for (let attempt = 0; attempt < 6; attempt++) {
    const salt = attempt === 0 ? '' : String(Math.floor(1000 + Math.random() * 9000));
    const nickname = buildNicknameCandidate(rawBase, salt);
    if (!NICK_RE.test(nickname)) continue;

    // 1) 닉네임 예약 (규칙상 미존재일 때만 성공)
    try {
      await setDoc(doc(db, 'nicknames', nickname), { uid: user.uid, createdAt: serverTimestamp() });
    } catch {
      continue; // 충돌/거부 → 다음 후보
    }

    // 2) users/{uid} 문서 생성 (규칙상 닉네임 포함 create 허용)
    try {
      await setDoc(userRef, {
        nickname,
        displayName: user.displayName || nickname,
        email: user.email || '',
        photoURL: user.photoURL || null,
        provider: providerId === 'google.com' ? 'google' : providerId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn('[provision] user doc create failed', e);
      return nickname; // 닉네임은 예약됨 — 표시용으로 반환
    }

    // 3) Auth displayName이 없거나 닉네임과 다르면 동기화(베스트 에포트)
    if (user.displayName !== nickname) {
      try {
        const { updateProfile } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        await updateProfile(user, { displayName: nickname });
      } catch { /* 표시는 appState.nickname 우선이라 실패해도 무방 */ }
    }

    return nickname;
  }

  return null;
}

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
  if (!NICK_RE.test(nickname)) throw new Error('닉네임은 2~12자의 한글·영문·숫자·_만 사용할 수 있어요');

  const userRef = doc(db, 'users', user.uid);
  const profileSnap = await getDoc(userRef).catch(() => null);
  const oldNickname = profileSnap?.exists() ? profileSnap.data()?.nickname || '' : '';
  if (oldNickname === nickname) return nickname;

  // NOTE: 최종 중복 방지는 Firestore Rules의 nicknames create 조건으로 처리.
  const exists = await getDoc(doc(db, 'nicknames', nickname));
  if (exists.exists() && exists.data().uid !== user.uid) {
    throw new Error('이미 사용 중인 닉네임이에요');
  }

  if (!exists.exists()) {
    await setDoc(doc(db, 'nicknames', nickname), { uid: user.uid, createdAt: serverTimestamp() }, { merge: false });
  }
  await saveUserProfile(user.uid, { nickname });

  if (oldNickname && oldNickname !== nickname) {
    await deleteDoc(doc(db, 'nicknames', oldNickname)).catch(() => {});
  }

  return nickname;
}
