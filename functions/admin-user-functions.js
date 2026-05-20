'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const db = getFirestore();
const REGION = 'asia-northeast3';

async function assertAdmin(uid) {
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  const snap = await db.doc(`admins/${uid}`).get();
  if (!snap.exists) throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
}

function toMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function safeString(value, max = 160) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

const getAdminMemberList = onCall({ region: REGION, timeoutSeconds: 60, memory: '256MiB' }, async request => {
  await assertAdmin(request.auth && request.auth.uid);

  const [adminSnap, userSnap, authList] = await Promise.all([
    db.collection('admins').get().catch(() => ({ docs: [] })),
    db.collection('users').limit(500).get().catch(() => ({ docs: [] })),
    getAuth().listUsers(500).catch(() => ({ users: [] })),
  ]);

  const adminIds = new Set(adminSnap.docs.map(d => d.id));
  const map = new Map();

  for (const user of authList.users || []) {
    if (!user.uid || adminIds.has(user.uid)) continue;
    map.set(user.uid, {
      uid: user.uid,
      email: safeString(user.email, 180),
      nickname: safeString(user.displayName || user.email?.split('@')[0] || '회원', 60),
      photoURL: safeString(user.photoURL, 300),
      provider: (user.providerData || []).map(p => p.providerId).filter(Boolean).join(', ') || 'password/anonymous',
      disabled: !!user.disabled,
      createdAtMs: toMs(user.metadata?.creationTime),
      lastLoginAtMs: toMs(user.metadata?.lastSignInTime),
      source: 'auth',
    });
  }

  for (const doc of userSnap.docs || []) {
    if (adminIds.has(doc.id)) continue;
    const data = doc.data() || {};
    const existing = map.get(doc.id) || { uid: doc.id, source: 'firestore' };
    map.set(doc.id, {
      ...existing,
      uid: doc.id,
      email: safeString(data.email || existing.email, 180),
      nickname: safeString(data.nickname || data.displayName || existing.nickname || '회원', 60),
      title: safeString(data.title, 80),
      points: Number(data.points || 0),
      totalPoints: Number(data.totalPoints || 0),
      streak: Number(data.streak || 0),
      nicknameIcon: data.nicknameIcon || null,
      createdAtMs: toMs(data.createdAt) || existing.createdAtMs || 0,
      updatedAtMs: toMs(data.updatedAt) || 0,
      lastLoginAtMs: existing.lastLoginAtMs || toMs(data.lastLoginAt) || 0,
      disabled: !!existing.disabled,
      source: existing.source === 'auth' ? 'auth+firestore' : 'firestore',
    });
  }

  const members = [...map.values()]
    .sort((a, b) => (b.createdAtMs || b.updatedAtMs || 0) - (a.createdAtMs || a.updatedAtMs || 0))
    .slice(0, 500);

  return {
    ok: true,
    total: members.length,
    excludedAdmins: adminIds.size,
    members,
  };
});

module.exports = { getAdminMemberList };
