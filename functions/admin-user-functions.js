'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const db = getFirestore();
const REGION = 'asia-northeast3';
const MAX_AUTH_SCAN = 3000;

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

function normalizeSearch(value) {
  return safeString(value, 80).toLowerCase().replace(/\s+/g, '');
}

function providerIds(user) {
  return (user.providerData || []).map(p => p.providerId).filter(Boolean);
}

function isRegisteredAuthUser(user) {
  if (!user || !user.uid) return false;
  const providers = providerIds(user).filter(id => id !== 'anonymous');
  return providers.length > 0 || !!user.email || !!user.phoneNumber;
}

function memberMatches(member, search) {
  if (!search) return true;
  const haystack = normalizeSearch([
    member.uid,
    member.email,
    member.nickname,
    member.title,
    member.provider,
  ].filter(Boolean).join(' '));
  return haystack.includes(search);
}

async function listAuthUsers(maxUsers = MAX_AUTH_SCAN) {
  const users = [];
  let pageToken;
  do {
    const result = await getAuth().listUsers(1000, pageToken);
    users.push(...(result.users || []));
    pageToken = result.pageToken;
  } while (pageToken && users.length < maxUsers);
  return { users: users.slice(0, maxUsers), scannedAll: !pageToken };
}

const getAdminMemberList = onCall({ region: REGION, timeoutSeconds: 60, memory: '512MiB' }, async request => {
  await assertAdmin(request.auth && request.auth.uid);

  const pageSize = Math.max(1, Math.min(100, Number(request.data?.pageSize) || 30));
  const pageToken = Math.max(0, Number(request.data?.pageToken) || 0);
  const search = normalizeSearch(request.data?.search || '');

  const [adminSnap, userSnap, authResult] = await Promise.all([
    db.collection('admins').get().catch(() => ({ docs: [] })),
    db.collection('users').limit(MAX_AUTH_SCAN).get().catch(() => ({ docs: [] })),
    listAuthUsers(MAX_AUTH_SCAN).catch(() => ({ users: [], scannedAll: true })),
  ]);

  const adminIds = new Set(adminSnap.docs.map(d => d.id));
  const registeredAuthIds = new Set();
  let excludedAnonymous = 0;
  const map = new Map();

  for (const user of authResult.users || []) {
    if (!user.uid || adminIds.has(user.uid)) continue;
    if (!isRegisteredAuthUser(user)) {
      excludedAnonymous += 1;
      continue;
    }
    registeredAuthIds.add(user.uid);
    const providers = providerIds(user);
    map.set(user.uid, {
      uid: user.uid,
      email: safeString(user.email, 180),
      nickname: safeString(user.displayName || user.email?.split('@')[0] || user.phoneNumber || '회원', 60),
      photoURL: safeString(user.photoURL, 300),
      provider: providers.join(', ') || 'registered',
      disabled: !!user.disabled,
      createdAtMs: toMs(user.metadata?.creationTime),
      lastLoginAtMs: toMs(user.metadata?.lastSignInTime),
      source: 'auth',
    });
  }

  for (const doc of userSnap.docs || []) {
    if (adminIds.has(doc.id)) continue;
    const data = doc.data() || {};
    const existing = map.get(doc.id);
    const hasSignupIdentity = registeredAuthIds.has(doc.id) || !!data.email || !!data.phoneNumber || !!data.providerId;
    if (!existing && !hasSignupIdentity) continue;
    const base = existing || { uid: doc.id, source: 'firestore' };
    map.set(doc.id, {
      ...base,
      uid: doc.id,
      email: safeString(data.email || base.email, 180),
      nickname: safeString(data.nickname || data.displayName || base.nickname || '회원', 60),
      title: safeString(data.title, 80),
      points: Number(data.points || 0),
      totalPoints: Number(data.totalPoints || 0),
      streak: Number(data.streak || 0),
      nicknameIcon: data.nicknameIcon || null,
      createdAtMs: toMs(data.createdAt) || base.createdAtMs || 0,
      updatedAtMs: toMs(data.updatedAt) || 0,
      lastLoginAtMs: base.lastLoginAtMs || toMs(data.lastLoginAt) || 0,
      disabled: !!base.disabled,
      source: base.source === 'auth' ? 'auth+firestore' : 'firestore',
    });
  }

  const filteredMembers = [...map.values()]
    .filter(member => memberMatches(member, search))
    .sort((a, b) => (b.createdAtMs || b.updatedAtMs || 0) - (a.createdAtMs || a.updatedAtMs || 0));

  const members = filteredMembers.slice(pageToken, pageToken + pageSize);
  const nextPageToken = pageToken + pageSize < filteredMembers.length ? pageToken + pageSize : null;
  const prevPageToken = pageToken > 0 ? Math.max(0, pageToken - pageSize) : null;

  return {
    ok: true,
    total: filteredMembers.length,
    totalRegistered: map.size,
    pageSize,
    pageToken,
    nextPageToken,
    prevPageToken,
    excludedAdmins: adminIds.size,
    excludedAnonymous,
    scannedAll: !!authResult.scannedAll,
    members,
  };
});

module.exports = { getAdminMemberList };
