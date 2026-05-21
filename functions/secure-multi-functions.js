'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';

const MULTI_KINDS = Object.freeze({
  naming: { collection: 'multi_naming', module: 'naming', label: '작명 참여' },
  acrostic: { collection: 'multi_acrostic', module: 'acrostic', label: '삼행시 참여' },
  relay: { collection: 'multi_relay', module: 'relay', label: '릴레이 참여' },
  fill: { collection: 'multi_fill', module: 'fill', label: '빈칸채우기 참여' },
});

const POINT_RULES = Object.freeze({
  participation_create: { points: 3, label: '참여글 작성' },
  vote_participate: { points: 1, label: '투표 참여' },
  reply_create: { points: 2, label: '답글 작성' },
  reaction_received: { points: 1, label: '반응 받음' },
  quiz_correct: { points: 5, label: '퀴즈 정답' },
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

function normalizeAnswer(value) {
  return String(value || '').trim().replace(/\s+/g, '').toLowerCase();
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

function markerRef(uid, postId, kind, itemId, onceKey) {
  return db.doc(`point_awards/${pointAwardId(uid, 'reaction_marker', { postId, kind, itemId, onceKey })}`);
}

function awardPointInTx(tx, { uid, action, postId = '', kind = '', itemId = '', onceKey = '' }) {
  const rule = POINT_RULES[action];
  if (!uid || !rule) return { awardRef: null, userRef: null, logRef: null, points: 0 };
  const awardRef = db.doc(`point_awards/${pointAwardId(uid, action, { postId, kind, itemId, onceKey })}`);
  const userRef = db.doc(`users/${uid}`);
  const logRef = userRef.collection('point_logs').doc();
  const date = todayKey();
  return { awardRef, userRef, logRef, rule, date, points: rule.points, action, postId, kind, itemId, onceKey };
}

async function commitPointAward(tx, award) {
  if (!award?.awardRef) return false;
  const awardSnap = await tx.get(award.awardRef);
  if (awardSnap.exists) return false;
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
  return true;
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
  const text = cleanText(payload.text, 500);
  if (!text) throw new HttpsError('invalid-argument', '참여 내용을 입력해주세요.');
  const data = { text };
  if (kind === 'acrostic' && Array.isArray(payload.lines)) {
    data.lines = payload.lines.slice(0, 12).map(line => ({
      char: cleanText(line?.char, 2),
      line: cleanText(line?.line, 120),
    })).filter(line => line.char && line.line);
  }
  if (kind === 'fill' && Array.isArray(payload.answers)) {
    data.answers = payload.answers.slice(0, 12).map((answer, index) => ({
      index: Number.isInteger(Number(answer?.index)) ? Number(answer.index) : index,
      text: cleanText(answer?.text, 80),
    })).filter(answer => answer.text);
  }
  return data;
}

async function awardQuizPointOnce(uid, postId) {
  await db.runTransaction(async tx => {
    const award = awardPointInTx(tx, { uid, action: 'quiz_correct', postId, onceKey: 'correct' });
    await commitPointAward(tx, award);
  });
}

const checkMultiQuizAnswer = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const { postId, selected } = request.data || {};
  const { postId: safePostId, post } = await loadMultiPost(postId);
  if (post.modules?.quiz?.enabled !== true) {
    throw new HttpsError('failed-precondition', '퀴즈 게시글이 아닙니다.');
  }

  const secretSnap = await db.doc(`feeds/${safePostId}/secret/answer`).get();
  if (!secretSnap.exists) throw new HttpsError('failed-precondition', '정답 정보가 없습니다.');
  const secret = secretSnap.data() || {};
  const mode = secret.mode || secret.quizMode || post.modules?.quiz?.mode || 'subjective';

  let correct = false;
  let storedSelected = '';
  if (mode === 'multiple') {
    const idx = Number(selected);
    const answerIdx = Number(secret.answerIdx ?? secret.correctIndex);
    storedSelected = Number.isFinite(idx) ? String(idx) : '';
    correct = Number.isInteger(idx) && idx === answerIdx;
  } else {
    storedSelected = String(selected || '').slice(0, 80);
    correct = normalizeAnswer(storedSelected) === normalizeAnswer(secret.answer);
  }

  await db.doc(`feeds/${safePostId}/quiz_attempts/${uid}`).set({
    userId: uid,
    selected: storedSelected,
    correct,
    type: 'multi',
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  }, { merge: true });

  if (correct) await awardQuizPointOnce(uid, safePostId);
  return { ok: true, correct, explanation: String(secret.explanation || '').slice(0, 500) };
});

const castMultiVote = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const safePostId = cleanId(request.data && request.data.postId);
  const optionIdx = Number(request.data && request.data.optionIdx);
  if (!safePostId || !Number.isInteger(optionIdx) || optionIdx < 0) {
    throw new HttpsError('invalid-argument', '투표 정보가 올바르지 않습니다.');
  }

  const ref = db.doc(`feeds/${safePostId}`);
  const post = await db.runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
    const data = snap.data() || {};
    if (data.hidden === true) throw new HttpsError('failed-precondition', '공개되지 않은 게시글입니다.');
    const vote = data.modules?.vote || {};
    if (data.type !== 'multi' || vote.enabled !== true) throw new HttpsError('failed-precondition', '투표 글이 아닙니다.');
    const options = Array.isArray(vote.options) ? vote.options : [];
    if (!options[optionIdx]) throw new HttpsError('invalid-argument', '존재하지 않는 선택지입니다.');
    if ((vote.votedBy || []).includes(uid)) throw new HttpsError('already-exists', '이미 투표했어요');

    const updatedOptions = options.map((option, index) => {
      const base = typeof option === 'object' && option !== null ? { ...option } : { text: String(option || '') };
      base.votes = Number(base.votes || 0) + (index === optionIdx ? 1 : 0);
      return base;
    });
    const updatedVote = { ...vote, options: updatedOptions, votedBy: [...(vote.votedBy || []), uid] };
    tx.update(ref, {
      'modules.vote': updatedVote,
      updatedAt: FieldValue.serverTimestamp(),
    });
    const award = awardPointInTx(tx, { uid, action: 'vote_participate', postId: safePostId, onceKey: 'vote' });
    await commitPointAward(tx, award);
    return { ...data, id: safePostId, modules: { ...(data.modules || {}), vote: updatedVote } };
  });

  return { ok: true, post, points: 1 };
});

const addMultiParticipation = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const { postId, kind, payload } = request.data || {};
  const config = getKindConfig(kind);
  const { postId: safePostId, ref, post } = await loadMultiPost(postId);
  ensureModuleEnabled(post, config);
  const data = cleanParticipationPayload(config.kind, payload || {});
  const author = await getAuthorInfo(uid, request.auth?.token || {});
  const itemRef = ref.collection(config.collection).doc();
  let awarded = false;

  await db.runTransaction(async tx => {
    tx.set(itemRef, {
      ...data,
      ...author,
      reactions: {},
      replyCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    tx.update(ref, {
      commentCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });
    const award = awardPointInTx(tx, { uid, action: 'participation_create', postId: safePostId, kind: config.kind, itemId: itemRef.id });
    awarded = await commitPointAward(tx, award);
  });

  return { ok: true, itemId: itemRef.id, awarded, points: awarded ? POINT_RULES.participation_create.points : 0 };
});

const addMultiItemReply = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const { postId, kind, itemId, text } = request.data || {};
  const config = getKindConfig(kind);
  const { postId: safePostId, ref } = await loadMultiPost(postId);
  const safeItemId = cleanId(itemId);
  const cleanReply = cleanText(text, 300);
  if (!safeItemId || !cleanReply) throw new HttpsError('invalid-argument', '답글 정보를 확인해주세요.');
  const itemRef = ref.collection(config.collection).doc(safeItemId);
  const replyRef = itemRef.collection('replies').doc();
  const author = await getAuthorInfo(uid, request.auth?.token || {});
  let awarded = false;

  await db.runTransaction(async tx => {
    const itemSnap = await tx.get(itemRef);
    if (!itemSnap.exists) throw new HttpsError('not-found', '참여글을 찾을 수 없습니다.');
    tx.set(replyRef, {
      text: cleanReply,
      ...author,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    tx.update(itemRef, { replyCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() });
    const award = awardPointInTx(tx, { uid, action: 'reply_create', postId: safePostId, kind: config.kind, itemId: safeItemId, onceKey: replyRef.id });
    awarded = await commitPointAward(tx, award);
  });

  return { ok: true, replyId: replyRef.id, awarded, points: awarded ? POINT_RULES.reply_create.points : 0 };
});

const reactMultiItem = onCall({ region: REGION, timeoutSeconds: 20 }, async request => {
  const uid = requireUser(request);
  const { postId, kind, itemId, reaction } = request.data || {};
  const config = getKindConfig(kind);
  const safePostId = cleanId(postId);
  const safeItemId = cleanId(itemId);
  const key = ['like', 'funny', 'fire'].includes(String(reaction)) ? String(reaction) : '';
  if (!safePostId || !safeItemId || !key) throw new HttpsError('invalid-argument', '반응 정보를 확인해주세요.');
  const itemRef = db.doc(`feeds/${safePostId}/${config.collection}/${safeItemId}`);
  const onceKey = `react_${key}_${uid}`;
  const reactorMarkerRef = markerRef(uid, safePostId, config.kind, safeItemId, onceKey);
  let reactionAdded = false;
  let receiverAwarded = false;

  await db.runTransaction(async tx => {
    const itemSnap = await tx.get(itemRef);
    if (!itemSnap.exists) throw new HttpsError('not-found', '참여글을 찾을 수 없습니다.');
    const markerSnap = await tx.get(reactorMarkerRef);
    if (markerSnap.exists) return;

    const item = itemSnap.data() || {};
    reactionAdded = true;
    tx.set(reactorMarkerRef, {
      uid,
      action: 'reaction_marker',
      points: 0,
      postId: safePostId,
      kind: config.kind,
      itemId: safeItemId,
      onceKey,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    tx.update(itemRef, {
      [`reactions.${key}`]: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (item.authorId && item.authorId !== uid) {
      const receiverAward = awardPointInTx(tx, {
        uid: item.authorId,
        action: 'reaction_received',
        postId: safePostId,
        kind: config.kind,
        itemId: safeItemId,
        onceKey,
      });
      receiverAwarded = await commitPointAward(tx, receiverAward);
    }
  });

  return { ok: true, reactionAdded, receiverAwarded, points: receiverAwarded ? POINT_RULES.reaction_received.points : 0 };
});

module.exports = {
  checkMultiQuizAnswer,
  castMultiVote,
  addMultiParticipation,
  addMultiItemReply,
  reactMultiItem,
};