'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

const MULTI_KINDS = Object.freeze({
  naming: { collection: 'multi_naming', module: 'naming', label: '작명 참여' },
  drip: { collection: 'multi_drip', module: 'drip', label: '드립 참여' },
  fill: { collection: 'multi_fill', module: 'fill', label: '빈칸채우기 참여' },
});

const POINT_RULES = Object.freeze({
  participation_create: { points: 3, label: '참여글 작성' },
  vote_participate: { points: 1, label: '투표 참여' },
  reply_create: { points: 2, label: '답글 작성' },
  reaction_received: { points: 1, label: '반응 받음' },
});

function cleanId(value, max = 160) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);
}

function cleanText(value, max = 500) {
  return String(value || '').replace(/[<>]/g, '').trim().slice(0, max);
}

function requireUser(request) {
  const uid = request.auth && request.auth.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
  return uid;
}

function todayKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function pointAwardId(uid, action, meta = {}) {
  return [
    cleanId(uid, 80),
    cleanId(action, 60),
    cleanId(meta.postId, 140),
    cleanId(meta.kind, 40),
    cleanId(meta.itemId, 140),
    cleanId(meta.onceKey, 180),
  ].filter(Boolean).join('_').slice(0, 900);
}

function awardMeta({ uid, action, postId = '', kind = '', itemId = '', onceKey = '' }) {
  const rule = POINT_RULES[action];
  if (!uid || !rule) return null;
  const awardRef = db.doc(`point_awards/${pointAwardId(uid, action, { postId, kind, itemId, onceKey })}`);
  const userRef = db.doc(`users/${uid}`);
  const logRef = userRef.collection('point_logs').doc();
  return { awardRef, userRef, logRef, rule, date: todayKey(), points: rule.points, action, postId, kind, itemId, onceKey };
}

function markerRef(uid, postId, kind, itemId, onceKey) {
  return db.doc(`point_awards/${pointAwardId(uid, 'reaction_marker', { postId, kind, itemId, onceKey })}`);
}

function writeNotification(tx, uid, data = {}) {
  const receiver = cleanId(uid, 120);
  if (!receiver) return;
  const ref = db.collection('notifications').doc();
  tx.set(ref, {
    uid: receiver,
    type: cleanText(data.type || 'activity', 40),
    title: cleanText(data.title || '새 알림', 80),
    body: cleanText(data.body || '', 180),
    postId: cleanId(data.postId, 180),
    kind: cleanId(data.kind, 40),
    itemId: cleanId(data.itemId, 180),
    actorId: cleanId(data.actorId, 120),
    actorName: cleanText(data.actorName || '익명', 40),
    points: Number(data.points || 0),
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  });
}

function writePointAward(tx, award) {
  if (!award) return;
  tx.set(award.awardRef, {
    uid: award.userRef.id,
    action: award.action,
    points: award.points,
    postId: cleanId(award.postId, 180),
    kind: cleanId(award.kind, 80),
    itemId: cleanId(award.itemId, 180),
    onceKey: cleanId(award.onceKey, 180),
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  });
  tx.set(award.userRef, {
    points: FieldValue.increment(award.points),
    totalPoints: FieldValue.increment(award.points),
    [`pointStats.${award.action}`]: FieldValue.increment(award.points),
    [`pointDaily.${award.date}`]: FieldValue.increment(award.points),
    lastPointAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  tx.set(award.logRef, {
    action: award.action,
    label: award.rule.label,
    points: award.points,
    meta: {
      postId: cleanId(award.postId, 180),
      kind: cleanId(award.kind, 80),
      itemId: cleanId(award.itemId, 180),
    },
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  });
}

async function loadMultiPost(postId) {
  const safePostId = cleanId(postId);
  if (!safePostId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');
  const ref = db.doc(`feeds/${safePostId}`);
  const snap = await ref.get();
  if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const post = snap.data() || {};
  if (post.hidden === true) throw new HttpsError('failed-precondition', '공개되지 않은 게시글입니다.');
  if (post.type !== 'multi') throw new HttpsError('failed-precondition', '멀티 게시글이 아닙니다.');
  return { ref, postId: safePostId, post };
}

async function getAuthorInfo(uid, authToken = {}) {
  let userData = {};
  try {
    const snap = await db.doc(`users/${uid}`).get();
    userData = snap.exists ? snap.data() || {} : {};
  } catch {}
  return {
    authorId: uid,
    authorName: cleanText(userData.nickname || userData.displayName || authToken.name || authToken.email?.split('@')[0] || '익명', 40) || '익명',
    authorEmail: cleanText(authToken.email || userData.email || '', 120),
    authorPhoto: cleanText(authToken.picture || userData.photoURL || '', 300),
  };
}

function getKindConfig(kind) {
  const safeKind = cleanId(kind, 40);
  const config = MULTI_KINDS[safeKind];
  if (!config) throw new HttpsError('invalid-argument', '지원하지 않는 참여 형식입니다.');
  return { kind: safeKind, ...config };
}

function ensureModuleEnabled(post, config) {
  if (post.modules?.[config.module]?.enabled !== true) {
    throw new HttpsError('failed-precondition', '해당 참여 기능이 켜져 있지 않습니다.');
  }
}

function cleanParticipationPayload(kind, payload = {}) {
  const max = kind === 'drip' ? 50 : 500;
  const text = cleanText(payload.text, max);
  if (!text) throw new HttpsError('invalid-argument', '참여 내용을 입력해주세요.');
  const data = { text };
  if (kind === 'fill' && Array.isArray(payload.answers)) {
    data.answers = payload.answers.slice(0, 12).map((answer, index) => ({
      index: Number.isInteger(Number(answer?.index)) ? Number(answer.index) : index,
      text: cleanText(answer?.text, 80),
    })).filter(answer => answer.text);
  }
  return data;
}

const castMultiVote = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const safePostId = cleanId(request.data && request.data.postId);
  const optionIdx = Number(request.data && request.data.optionIdx);
  if (!safePostId || !Number.isInteger(optionIdx) || optionIdx < 0) {
    throw new HttpsError('invalid-argument', '투표 정보가 올바르지 않습니다.');
  }

  const ref = db.doc(`feeds/${safePostId}`);
  let awarded = false;
  const post = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const data = snap.data() || {};
    if (data.hidden === true || data.type !== 'multi' || data.modules?.vote?.enabled !== true) {
      throw new HttpsError('failed-precondition', '투표할 수 없는 게시글입니다.');
    }
    const vote = data.modules.vote;
    const options = Array.isArray(vote.options) ? vote.options : [];
    if (!options[optionIdx]) throw new HttpsError('invalid-argument', '선택지가 올바르지 않습니다.');
    const votedBy = Array.isArray(vote.votedBy) ? vote.votedBy : [];
    if (votedBy.includes(uid)) throw new HttpsError('already-exists', '이미 투표한 게시글입니다.');

    const nextOptions = options.map((option, index) => index === optionIdx
      ? { ...option, votes: Number(option.votes || 0) + 1 }
      : option);
    const nextVote = { ...vote, options: nextOptions, votedBy: [...votedBy, uid], updatedAt: FieldValue.serverTimestamp() };
    const nextPost = { ...data, id: safePostId, modules: { ...(data.modules || {}), vote: nextVote } };
    tx.set(ref, { modules: { vote: nextVote }, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

    const award = awardMeta({ uid, action: 'vote_participate', postId: safePostId, kind: 'vote', onceKey: 'vote' });
    if (award) {
      const awardSnap = await tx.get(award.awardRef);
      if (!awardSnap.exists) {
        awarded = true;
        writePointAward(tx, award);
      }
    }
    return nextPost;
  });

  return { ok: true, post, awarded, points: awarded ? POINT_RULES.vote_participate.points : 0 };
});

const addMultiParticipation = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const { postId, kind, payload } = request.data || {};
  const config = getKindConfig(kind);
  const { ref: postRef, postId: safePostId, post } = await loadMultiPost(postId);
  ensureModuleEnabled(post, config);
  const user = await getAuthorInfo(uid, request.auth?.token || {});
  const data = cleanParticipationPayload(config.kind, payload || {});
  const itemRef = postRef.collection(config.collection).doc();
  let awarded = false;

  await db.runTransaction(async tx => {
    tx.set(itemRef, {
      ...data,
      ...user,
      reactions: {},
      replyCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    tx.set(postRef, { [`modules.${config.module}.count`]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const award = awardMeta({ uid, action: 'participation_create', postId: safePostId, kind: config.kind, itemId: itemRef.id });
    const awardSnap = await tx.get(award.awardRef);
    if (!awardSnap.exists) {
      awarded = true;
      writePointAward(tx, award);
    }
  });

  return { ok: true, itemId: itemRef.id, awarded, points: awarded ? POINT_RULES.participation_create.points : 0 };
});

const addMultiItemReply = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const { postId, kind, itemId, text } = request.data || {};
  const config = getKindConfig(kind);
  const { ref: postRef, postId: safePostId, post } = await loadMultiPost(postId);
  ensureModuleEnabled(post, config);
  const safeItemId = cleanId(itemId);
  const replyText = cleanText(text, 500);
  if (!safeItemId || !replyText) throw new HttpsError('invalid-argument', '답글 정보가 올바르지 않습니다.');
  const itemRef = postRef.collection(config.collection).doc(safeItemId);
  const itemSnap = await itemRef.get();
  if (!itemSnap.exists) throw new HttpsError('not-found', '참여글을 찾을 수 없습니다.');
  const item = itemSnap.data() || {};
  const user = await getAuthorInfo(uid, request.auth?.token || {});
  const replyRef = itemRef.collection('replies').doc();
  let awarded = false;

  await db.runTransaction(async tx => {
    tx.set(replyRef, {
      text: replyText,
      ...user,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    tx.set(itemRef, { replyCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    const award = awardMeta({ uid, action: 'reply_create', postId: safePostId, kind: config.kind, itemId: safeItemId, onceKey: replyRef.id });
    const awardSnap = await tx.get(award.awardRef);
    if (!awardSnap.exists) {
      awarded = true;
      writePointAward(tx, award);
    }
    if (item.authorId && item.authorId !== uid) {
      writeNotification(tx, item.authorId, {
        type: 'multi_reply',
        title: '내 참여글에 답글이 달렸어요',
        body: `${user.authorName}: ${replyText.slice(0, 50)}`,
        postId: safePostId,
        kind: config.kind,
        itemId: safeItemId,
        actorId: uid,
        actorName: user.authorName,
        points: awarded ? POINT_RULES.reply_create.points : 0,
      });
    }
  });

  return { ok: true, awarded, points: awarded ? POINT_RULES.reply_create.points : 0 };
});

const reactMultiItem = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const { postId, kind, itemId, reaction } = request.data || {};
  const config = getKindConfig(kind);
  const { postId: safePostId, post } = await loadMultiPost(postId);
  ensureModuleEnabled(post, config);
  const safeItemId = cleanId(itemId);
  const reactionKey = ['like', 'funny', 'fire'].includes(reaction) ? reaction : 'like';
  const itemRef = db.doc(`feeds/${safePostId}/${config.collection}/${safeItemId}`);
  const itemSnap = await itemRef.get();
  if (!itemSnap.exists) throw new HttpsError('not-found', '참여글을 찾을 수 없습니다.');
  const item = itemSnap.data() || {};
  if (item.authorId === uid) throw new HttpsError('failed-precondition', '본인 글에는 반응할 수 없습니다.');
  const markRef = markerRef(uid, safePostId, config.kind, safeItemId, reactionKey);
  const user = await getAuthorInfo(uid, request.auth?.token || {});
  let reactionAdded = false;
  let awarded = false;

  await db.runTransaction(async tx => {
    const markSnap = await tx.get(markRef);
    if (markSnap.exists) return;
    reactionAdded = true;
    tx.set(markRef, { uid, postId: safePostId, kind: config.kind, itemId: safeItemId, reaction: reactionKey, createdAt: FieldValue.serverTimestamp(), createdAtMs: Date.now() });
    tx.set(itemRef, { [`reactions.${reactionKey}`]: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    if (item.authorId) {
      const award = awardMeta({ uid: item.authorId, action: 'reaction_received', postId: safePostId, kind: config.kind, itemId: safeItemId, onceKey: `${uid}_${reactionKey}` });
      const awardSnap = await tx.get(award.awardRef);
      if (!awardSnap.exists) {
        awarded = true;
        writePointAward(tx, award);
      }
      if (item.authorId !== uid) {
        writeNotification(tx, item.authorId, {
          type: 'multi_reaction',
          title: '내 참여글에 반응이 달렸어요',
          body: `${user.authorName}님이 반응을 남겼어요`,
          postId: safePostId,
          kind: config.kind,
          itemId: safeItemId,
          actorId: uid,
          actorName: user.authorName,
          points: awarded ? POINT_RULES.reaction_received.points : 0,
        });
      }
    }
  });

  return { ok: true, reactionAdded, awarded, points: awarded ? POINT_RULES.reaction_received.points : 0 };
});

module.exports = {
  castMultiVote,
  addMultiParticipation,
  addMultiItemReply,
  reactMultiItem,
};