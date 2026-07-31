'use strict';

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const REGION = 'asia-northeast3';
const TOPIC_TYPES = ['daily', 'naming', 'situation'];
const BLOCKED_WORDS = /(시발|씨발|병신|개새끼|죽어|자살|전화번호|주민등록번호|실명 공개)/i;

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanDocId(value) {
  const id = cleanText(value, 100);
  return /^[A-Za-z0-9_-]{8,100}$/.test(id) ? id : '';
}

function assertSafeText(text, label) {
  const safety = inspectContent(text);
  if (!safety.safe || BLOCKED_WORDS.test(text)) {
    throw new HttpsError('failed-precondition', `${label}에 공개하기 어려운 표현이 포함되어 있습니다.`);
  }
}

async function loadNickname(uid) {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists
    ? cleanText(snap.data().nickname, 20) || '익명 드리퍼'
    : '익명 드리퍼';
}

async function requireVisibleTopic(topicId) {
  const topicRef = db.doc(`dripso_topics/${topicId}`);
  const snap = await topicRef.get();
  if (!snap.exists || snap.data()?.status !== 'visible') {
    throw new HttpsError('not-found', '드립 주제를 찾을 수 없습니다.');
  }
  return { topicRef, topic: snap.data() };
}

exports.createDripsoTopic = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const type = cleanText(request.data?.type, 20);
  const title = cleanText(request.data?.title, 60);
  const prompt = cleanText(request.data?.prompt, 300);

  if (!TOPIC_TYPES.includes(type)) {
    throw new HttpsError('invalid-argument', '지원하지 않는 드립 메뉴입니다.');
  }
  if (title.length < 2) {
    throw new HttpsError('invalid-argument', '주제 제목을 2자 이상 입력해 주세요.');
  }
  if (prompt.length < 4) {
    throw new HttpsError('invalid-argument', '사람들이 드립을 달 수 있도록 설명을 4자 이상 입력해 주세요.');
  }
  assertSafeText(`${title}\n${prompt}`, '주제');

  await enforceActionRateLimit(uid, 'dripso-topic', {
    cooldownSeconds: 30,
    dailyLimit: 10
  });

  const nickname = await loadNickname(uid);
  const topicRef = db.collection('dripso_topics').doc();
  const authorRef = db.doc(`dripso_topic_authors/${topicRef.id}`);
  const batch = db.batch();

  batch.set(topicRef, {
    type,
    title,
    prompt,
    nickname,
    status: 'visible',
    commentCount: 0,
    topLikeCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(authorRef, {
    uid,
    topicId: topicRef.id,
    createdAt: FieldValue.serverTimestamp()
  });
  await batch.commit();

  return { success: true, topicId: topicRef.id };
});

exports.addDripsoComment = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  const text = cleanText(request.data?.text, 300);

  if (!topicId) throw new HttpsError('invalid-argument', 'topicId가 올바르지 않습니다.');
  if (text.length < 2) throw new HttpsError('invalid-argument', '드립을 2자 이상 입력해 주세요.');
  assertSafeText(text, '댓글');

  const { topicRef } = await requireVisibleTopic(topicId);
  await enforceActionRateLimit(uid, 'dripso-comment', {
    cooldownSeconds: 8,
    dailyLimit: 60
  });

  const nickname = await loadNickname(uid);
  const commentRef = topicRef.collection('comments').doc();
  const authorRef = db.doc(`dripso_comment_authors/${topicId}/items/${commentRef.id}`);
  const batch = db.batch();

  batch.set(commentRef, {
    nickname,
    text,
    status: 'visible',
    likeCount: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  batch.set(authorRef, {
    uid,
    topicId,
    commentId: commentRef.id,
    createdAt: FieldValue.serverTimestamp()
  });
  batch.set(topicRef, {
    commentCount: FieldValue.increment(1),
    lastCommentAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  await batch.commit();

  return { success: true, commentId: commentRef.id };
});

exports.toggleDripsoCommentLike = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const topicId = cleanDocId(request.data?.topicId);
  const commentId = cleanDocId(request.data?.commentId);
  if (!topicId || !commentId) {
    throw new HttpsError('invalid-argument', '좋아요 대상이 올바르지 않습니다.');
  }

  const { topicRef } = await requireVisibleTopic(topicId);
  await enforceActionRateLimit(uid, 'dripso-like', {
    cooldownSeconds: 1,
    dailyLimit: 500
  });

  const commentRef = topicRef.collection('comments').doc(commentId);
  const likeRef = commentRef.collection('likes').doc(uid);
  let result = { liked: false, likeCount: 0 };

  await db.runTransaction(async tx => {
    const [commentSnap, likeSnap] = await Promise.all([
      tx.get(commentRef),
      tx.get(likeRef)
    ]);
    if (!commentSnap.exists || commentSnap.data()?.status !== 'visible') {
      throw new HttpsError('not-found', '드립 댓글을 찾을 수 없습니다.');
    }

    const currentCount = Math.max(0, Number(commentSnap.data().likeCount) || 0);
    const liked = !likeSnap.exists;
    const nextCount = Math.max(0, currentCount + (liked ? 1 : -1));

    if (liked) {
      tx.set(likeRef, {
        uid,
        createdAt: FieldValue.serverTimestamp()
      });
    } else {
      tx.delete(likeRef);
    }
    tx.set(commentRef, {
      likeCount: nextCount,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.set(topicRef, {
      updatedAt: FieldValue.serverTimestamp(),
      topLikeCount: liked ? Math.max(Number((await tx.get(topicRef)).data()?.topLikeCount) || 0, nextCount) : FieldValue.increment(0)
    }, { merge: true });

    result = { liked, likeCount: nextCount };
  });

  if (!result.liked) {
    const best = await topicRef.collection('comments')
      .where('status', '==', 'visible')
      .orderBy('likeCount', 'desc')
      .limit(1)
      .get();
    const topLikeCount = best.empty ? 0 : Math.max(0, Number(best.docs[0].data().likeCount) || 0);
    await topicRef.set({ topLikeCount, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  }

  return { success: true, ...result };
});
