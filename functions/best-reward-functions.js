'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const BEST_REWARD_POINTS = 20;

const BEST_KINDS = Object.freeze({
  naming: { collection: 'multi_naming', module: 'naming', title: '베스트 작명' },
  acrostic: { collection: 'multi_acrostic', module: 'acrostic', title: '베스트 삼행시' },
  fill: { collection: 'multi_fill', module: 'fill', title: '베스트 빈칸 답' },
  relay: { collection: 'multi_relay', module: 'relay', title: '베스트 릴레이' },
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

function reactionScore(item = {}) {
  const reactions = item.reactions || {};
  return (Number(reactions.like || 0) || 0)
    + (Number(reactions.funny || 0) || 0) * 2
    + (Number(reactions.fire || 0) || 0) * 3;
}

function deadlineDate(post = {}) {
  const value = post.deadlineAt;
  return value?.toDate?.() || (value ? new Date(value) : null);
}

function isClosed(post = {}) {
  if (!post.deadline?.enabled) return false;
  if (post.deadline.status === 'closed') return true;
  const date = deadlineDate(post);
  return !!date && date.getTime() <= Date.now();
}

function inferKind(post = {}, requestedKind = '') {
  const safeKind = cleanId(requestedKind, 40);
  if (BEST_KINDS[safeKind]) return safeKind;
  const modules = post.modules || {};
  if (modules.naming?.enabled) return 'naming';
  if (modules.acrostic?.enabled) return 'acrostic';
  if (modules.fill?.enabled) return 'fill';
  if (modules.relay?.enabled) return 'relay';
  return BEST_KINDS[post.subtype] ? post.subtype : '';
}

function publicWinner(item, itemId, score, kind) {
  return {
    kind,
    itemId,
    score,
    authorId: cleanId(item.authorId, 120),
    authorName: cleanText(item.authorName || '익명', 40) || '익명',
    text: cleanText(item.text || '', 180),
    reactions: item.reactions || {},
    replyCount: Number(item.replyCount || 0) || 0,
    rewardedAtMs: Date.now(),
  };
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
    actorName: cleanText(data.actorName || '소소킹', 40),
    points: Number(data.points || 0),
    read: false,
    createdAt: FieldValue.serverTimestamp(),
    createdAtMs: Date.now(),
  });
}

async function isAdmin(uid) {
  if (!uid) return false;
  const snap = await db.doc(`admins/${uid}`).get();
  return snap.exists;
}

async function findBestItem(postRef, config) {
  const snap = await postRef.collection(config.collection).get();
  const ranked = snap.docs
    .map(d => ({ id: d.id, data: d.data() || {}, score: reactionScore(d.data() || {}) }))
    .filter(entry => entry.score > 0 && entry.data.authorId)
    .sort((a, b) => b.score - a.score || Number(b.data.replyCount || 0) - Number(a.data.replyCount || 0) || Number(a.data.createdAtMs || 0) - Number(b.data.createdAtMs || 0));
  return ranked[0] || null;
}

function awardId(postId, kind, itemId) {
  return ['best_reward', cleanId(postId, 140), cleanId(kind, 40), cleanId(itemId, 140)].join('_').slice(0, 900);
}

const finalizeBestReward = onCall({ region: REGION, timeoutSeconds: 30 }, async request => {
  const uid = requireUser(request);
  const postId = cleanId(request.data?.postId, 180);
  const requestedKind = cleanId(request.data?.kind, 40);
  const closeNow = request.data?.closeNow === true;
  const force = request.data?.force === true;
  if (!postId) throw new HttpsError('invalid-argument', '게시글 정보가 없습니다.');

  const postRef = db.doc(`feeds/${postId}`);
  const postSnap = await postRef.get();
  if (!postSnap.exists) throw new HttpsError('not-found', '게시글을 찾을 수 없습니다.');
  const post = postSnap.data() || {};
  if (post.type !== 'multi') throw new HttpsError('failed-precondition', '멀티 게시글이 아닙니다.');
  if (post.hidden === true) throw new HttpsError('failed-precondition', '공개되지 않은 게시글입니다.');

  const admin = await isAdmin(uid);
  const owner = post.authorId === uid;
  if (!admin && !owner) throw new HttpsError('permission-denied', '작성자 또는 관리자만 확정할 수 있습니다.');
  if (force && !admin) throw new HttpsError('permission-denied', '강제 확정은 관리자만 가능합니다.');

  const kind = inferKind(post, requestedKind);
  const config = BEST_KINDS[kind];
  if (!config || post.modules?.[config.module]?.enabled !== true) {
    throw new HttpsError('failed-precondition', '베스트 보상을 지원하지 않는 글입니다.');
  }

  const canFinalize = force || closeNow || isClosed(post);
  if (!canFinalize) {
    throw new HttpsError('failed-precondition', '마감 후에 베스트 보상을 확정할 수 있습니다.');
  }

  const best = await findBestItem(postRef, config);
  if (!best) {
    if (closeNow) {
      await postRef.set({
        deadline: { ...(post.deadline || {}), enabled: true, status: 'closed', closedAt: FieldValue.serverTimestamp(), closedBy: uid },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    }
    return { ok: true, awarded: false, reason: 'no_scored_item', message: '반응 점수가 있는 참여글이 없습니다.' };
  }

  const item = best.data;
  const receiverId = cleanId(item.authorId, 120);
  const awardRef = db.doc(`point_awards/${awardId(postId, kind, best.id)}`);
  const userRef = db.doc(`users/${receiverId}`);
  const logRef = userRef.collection('point_logs').doc();
  const itemRef = postRef.collection(config.collection).doc(best.id);
  const date = todayKey();
  const winner = publicWinner(item, best.id, best.score, kind);
  let awarded = false;

  await db.runTransaction(async tx => {
    const [awardSnap, freshPostSnap, itemSnap] = await Promise.all([
      tx.get(awardRef),
      tx.get(postRef),
      tx.get(itemRef),
    ]);
    if (!freshPostSnap.exists || !itemSnap.exists) throw new HttpsError('not-found', '확정 대상을 찾을 수 없습니다.');
    if (awardSnap.exists) {
      tx.set(postRef, {
        bestReward: {
          status: 'already_awarded',
          kind,
          winner,
          points: BEST_REWARD_POINTS,
          awardId: awardRef.id,
          updatedAt: FieldValue.serverTimestamp(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return;
    }

    awarded = true;
    tx.set(awardRef, {
      uid: receiverId,
      action: 'best_reward',
      points: BEST_REWARD_POINTS,
      postId,
      kind,
      itemId: best.id,
      score: best.score,
      createdBy: uid,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    tx.set(userRef, {
      points: FieldValue.increment(BEST_REWARD_POINTS),
      totalPoints: FieldValue.increment(BEST_REWARD_POINTS),
      'pointStats.best_reward': FieldValue.increment(BEST_REWARD_POINTS),
      [`pointDaily.${date}`]: FieldValue.increment(BEST_REWARD_POINTS),
      lastPointAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    tx.set(logRef, {
      action: 'best_reward',
      label: config.title,
      points: BEST_REWARD_POINTS,
      meta: { postId, kind, itemId: best.id, score: best.score },
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
    });
    tx.set(itemRef, {
      bestReward: {
        awarded: true,
        points: BEST_REWARD_POINTS,
        score: best.score,
        awardedAt: FieldValue.serverTimestamp(),
      },
    }, { merge: true });
    tx.set(postRef, {
      deadline: closeNow ? { ...(post.deadline || {}), enabled: true, status: 'closed', closedAt: FieldValue.serverTimestamp(), closedBy: uid } : post.deadline,
      bestReward: {
        status: 'awarded',
        kind,
        winner,
        points: BEST_REWARD_POINTS,
        awardId: awardRef.id,
        awardedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    writeNotification(tx, receiverId, {
      type: 'best_reward',
      title: '베스트 보상을 받았어요',
      body: `${config.title}에 선정되어 +${BEST_REWARD_POINTS}P를 받았어요.`,
      postId,
      kind,
      itemId: best.id,
      actorId: uid,
      actorName: '소소킹',
      points: BEST_REWARD_POINTS,
    });
  });

  return {
    ok: true,
    awarded,
    points: awarded ? BEST_REWARD_POINTS : 0,
    kind,
    winner,
    message: awarded ? `${winner.authorName}님에게 베스트 보상 +${BEST_REWARD_POINTS}P 지급` : '이미 베스트 보상이 지급되었습니다.',
  };
});

module.exports = { finalizeBestReward };
