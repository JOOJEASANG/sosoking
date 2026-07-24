'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { getStorage } = require('firebase-admin/storage');
const { getApps, initializeApp } = require('firebase-admin/app');
const { createHash } = require('crypto');

if (!getApps().length) initializeApp();
const db = getFirestore();
const REGION = 'asia-northeast3';

function requireRegisteredUser(request) {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  if (request.auth?.token?.firebase?.sign_in_provider === 'anonymous') {
    throw new HttpsError('permission-denied', '정식 회원 계정이 필요합니다.');
  }
  return uid;
}

function cleanNickname(value) {
  return String(value || '').replace(/[^가-힣a-zA-Z0-9_]/g, '').slice(0, 12);
}

function assertValidNickname(nickname) {
  if (!nickname || nickname.length < 2 || nickname.length > 12) {
    throw new HttpsError('invalid-argument', '닉네임은 2~12자여야 합니다.');
  }
  if (!/^[가-힣a-zA-Z0-9_]+$/.test(nickname)) {
    throw new HttpsError('invalid-argument', '닉네임은 한글, 영문, 숫자, _만 사용할 수 있습니다.');
  }
}

function baseNickname(request) {
  const token = request.auth?.token || {};
  return cleanNickname(request.data?.nickname || token.name || token.email?.split('@')[0] || '소소회원') || '소소회원';
}

function nicknameCandidate(base, attempt) {
  if (attempt === 0) return cleanNickname(base);
  const suffix = String(1000 + Math.floor(Math.random() * 9000));
  return cleanNickname(base.slice(0, Math.max(2, 12 - suffix.length)) + suffix);
}

async function claimNickname(uid, nickname, profilePatch = {}) {
  const userRef = db.doc(`users/${uid}`);
  const newNickRef = db.doc(`nicknames/${nickname}`);
  await db.runTransaction(async tx => {
    const [userSnap, nickSnap] = await Promise.all([tx.get(userRef), tx.get(newNickRef)]);
    const oldNickname = userSnap.exists ? userSnap.data()?.nickname || '' : '';
    if (nickSnap.exists && (nickSnap.data()?.uid || '') !== uid) {
      throw new HttpsError('already-exists', '이미 사용 중인 닉네임입니다.');
    }
    if (oldNickname && oldNickname !== nickname) {
      const oldRef = db.doc(`nicknames/${oldNickname}`);
      const oldSnap = await tx.get(oldRef);
      if (oldSnap.exists && oldSnap.data()?.uid === uid) tx.delete(oldRef);
    }
    tx.set(newNickRef, {
      uid,
      createdAt: nickSnap.exists ? nickSnap.data()?.createdAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(userRef, {
      ...profilePatch,
      nickname,
      updatedAt: FieldValue.serverTimestamp(),
      ...(userSnap.exists ? {} : { createdAt: FieldValue.serverTimestamp(), points: 0, totalPoints: 0, postCount: 0 }),
    }, { merge: true });
  });
}

const provisionUserProfile = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireRegisteredUser(request);
  const existing = await db.doc(`users/${uid}`).get();
  if (existing.exists && existing.data()?.nickname) {
    return { ok: true, nickname: existing.data().nickname, created: false };
  }

  const token = request.auth?.token || {};
  const base = baseNickname(request);
  const profilePatch = {
    displayName: String(token.name || base).slice(0, 80),
    email: String(token.email || '').slice(0, 180),
    photoURL: String(token.picture || '').slice(0, 500),
    provider: String(token.firebase?.sign_in_provider || 'registered').slice(0, 60),
  };

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const nickname = nicknameCandidate(base, attempt);
    if (nickname.length < 2) continue;
    try {
      await claimNickname(uid, nickname, profilePatch);
      return { ok: true, nickname, created: true };
    } catch (error) {
      if (String(error.code || '').includes('already-exists')) continue;
      throw error;
    }
  }
  throw new HttpsError('resource-exhausted', '사용 가능한 닉네임을 만들지 못했습니다.');
});

const updateNickname = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireRegisteredUser(request);
  const nickname = cleanNickname(request.data?.nickname);
  assertValidNickname(nickname);
  const current = await db.doc(`users/${uid}`).get();
  if (current.exists && current.data()?.nickname === nickname) {
    throw new HttpsError('failed-precondition', '현재 닉네임과 같습니다.');
  }
  await claimNickname(uid, nickname);
  return { ok: true, nickname };
});

async function anonymizeCollectionGroup(collectionId, uid, batchSize = 300) {
  let updated = 0;
  while (true) {
    const snap = await db.collectionGroup(collectionId).where('authorId', '==', uid).limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(docSnap => {
      batch.update(docSnap.ref, {
        authorId: `deleted_${uid}`,
        authorName: '탈퇴한 사용자',
        authorPhoto: '',
        authorEmail: '',
        accountDeleted: true,
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
    await batch.commit();
    updated += snap.size;
    if (snap.size < batchSize) break;
  }
  return updated;
}

async function deleteQuery(query, batchSize = 300) {
  let deleted = 0;
  while (true) {
    const snap = await query.limit(batchSize).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(docSnap => batch.delete(docSnap.ref));
    await batch.commit();
    deleted += snap.size;
    if (snap.size < batchSize) break;
  }
  return deleted;
}

async function deleteStoragePrefix(uid) {
  try {
    const [files] = await getStorage().bucket().getFiles({ prefix: `feeds/${uid}/` });
    await Promise.all(files.map(file => file.delete({ ignoreNotFound: true })));
    return files.length;
  } catch (error) {
    console.warn('[deleteMyAccount] storage cleanup failed', error);
    return 0;
  }
}

const deleteMyAccount = onCall({ region: REGION, timeoutSeconds: 540, memory: '512MiB' }, async request => {
  const uid = requireRegisteredUser(request);
  const userRef = db.doc(`users/${uid}`);
  const userSnap = await userRef.get();
  const nickname = userSnap.exists ? userSnap.data()?.nickname || '' : '';

  const content = {
    feeds: await anonymizeCollectionGroup('feeds', uid),
    comments: await anonymizeCollectionGroup('comments', uid),
    replies: await anonymizeCollectionGroup('replies', uid),
    drips: await anonymizeCollectionGroup('multi_drip', uid),
  };
  const deleted = {
    follows: await deleteQuery(db.collection('follows').where('followerId', '==', uid)),
    followedBy: await deleteQuery(db.collection('follows').where('followedId', '==', uid)),
    notifications: await deleteQuery(db.collection('notifications').where('uid', '==', uid)),
    reports: await deleteQuery(db.collection('reports').where('reporterId', '==', uid)),
    storageFiles: await deleteStoragePrefix(uid),
  };

  if (nickname) {
    const nickRef = db.doc(`nicknames/${nickname}`);
    const nickSnap = await nickRef.get();
    if (nickSnap.exists && nickSnap.data()?.uid === uid) await nickRef.delete();
  }

  try {
    await db.recursiveDelete(userRef);
  } catch {
    await userRef.delete().catch(() => {});
  }

  await db.doc(`deleted_users/${uid}`).set({
    uidHash: createHash('sha256').update(uid).digest('hex'),
    deletedAt: FieldValue.serverTimestamp(),
    deletedAtMs: Date.now(),
    content,
    deleted,
  });

  await getAuth().deleteUser(uid).catch(error => {
    if (error.code !== 'auth/user-not-found') throw error;
  });
  return { ok: true, content, deleted };
});

module.exports = { provisionUserProfile, updateNickname, deleteMyAccount };
