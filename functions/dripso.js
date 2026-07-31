'use strict';

const { randomUUID } = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage } = require('firebase-admin/storage');
const { enforceActionRateLimit, requireVerifiedUser } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const REGION = 'asia-northeast3';
const TOPIC_TYPES = ['daily', 'naming', 'situation'];
const BLOCKED_WORDS = /(시발|씨발|병신|개새끼|죽어|자살|전화번호|주민등록번호|실명 공개)/i;
const MAX_TOPIC_IMAGE_BYTES = 750 * 1024;
const MAX_TOPIC_IMAGE_DATA_LENGTH = 1100000;
const MAX_TOPIC_IMAGE_EDGE = 4096;

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

function jpegDimensions(buffer) {
  if (buffer.length < 12 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (buffer[offset] === 0xff) offset += 1;
    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker >= 0xd0 && marker <= 0xd7) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    const isStartOfFrame = [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker);
    if (isStartOfFrame) {
      if (length < 7) return null;
      return {
        height: buffer.readUInt16BE(offset + 3),
        width: buffer.readUInt16BE(offset + 5)
      };
    }
    offset += length;
  }
  return null;
}

function decodeTopicImageDataUrl(value) {
  const dataUrl = String(value || '');
  if (!dataUrl) return null;
  if (dataUrl.length > MAX_TOPIC_IMAGE_DATA_LENGTH) {
    throw new HttpsError('invalid-argument', '첨부 사진 용량이 너무 큽니다.');
  }
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/]+={0,2})$/.exec(dataUrl);
  if (!match) {
    throw new HttpsError('invalid-argument', '첨부 사진 형식이 올바르지 않습니다.');
  }
  const buffer = Buffer.from(match[1], 'base64');
  if (!buffer.length || buffer.length > MAX_TOPIC_IMAGE_BYTES) {
    throw new HttpsError('invalid-argument', '첨부 사진은 압축 후 750KB 이하여야 합니다.');
  }
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8 || buffer.at(-2) !== 0xff || buffer.at(-1) !== 0xd9) {
    throw new HttpsError('invalid-argument', '정상적인 JPG 사진만 첨부할 수 있습니다.');
  }
  const dimensions = jpegDimensions(buffer);
  if (!dimensions || dimensions.width < 1 || dimensions.height < 1
    || dimensions.width > MAX_TOPIC_IMAGE_EDGE || dimensions.height > MAX_TOPIC_IMAGE_EDGE) {
    throw new HttpsError('invalid-argument', '첨부 사진의 크기 정보를 확인할 수 없습니다.');
  }
  return { buffer, ...dimensions };
}

async function storeTopicImage(topicId, image) {
  if (!image) return null;
  const bucket = getStorage().bucket();
  const imagePath = `dripso/topics/${topicId}.jpg`;
  const token = randomUUID();
  const file = bucket.file(imagePath);
  await file.save(image.buffer, {
    resumable: false,
    validation: 'md5',
    metadata: {
      contentType: 'image/jpeg',
      contentDisposition: 'inline',
      cacheControl: 'public,max-age=31536000,immutable',
      metadata: {
        firebaseStorageDownloadTokens: token,
        service: 'dripso-topic-image'
      }
    }
  });
  const imageUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket.name)}/o/${encodeURIComponent(imagePath)}?alt=media&token=${encodeURIComponent(token)}`;
  return {
    file,
    imagePath,
    imageUrl,
    imageWidth: image.width,
    imageHeight: image.height,
    imageByteSize: image.buffer.length
  };
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
  timeoutSeconds: 60,
  memory: '512MiB'
}, async request => {
  requireVerifiedUser(request);
  const uid = request.auth.uid;
  const type = cleanText(request.data?.type, 20);
  const title = cleanText(request.data?.title, 60);
  const prompt = cleanText(request.data?.prompt, 300);
  const image = decodeTopicImageDataUrl(request.data?.imageDataUrl);

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
  let storedImage = null;

  try {
    storedImage = await storeTopicImage(topicRef.id, image);
    const topicData = {
      type,
      title,
      prompt,
      nickname,
      status: 'visible',
      commentCount: 0,
      topLikeCount: 0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    };
    if (storedImage) {
      Object.assign(topicData, {
        imageUrl: storedImage.imageUrl,
        imagePath: storedImage.imagePath,
        imageWidth: storedImage.imageWidth,
        imageHeight: storedImage.imageHeight,
        imageByteSize: storedImage.imageByteSize,
        imageContentType: 'image/jpeg'
      });
    }

    const batch = db.batch();
    batch.set(topicRef, topicData);
    batch.set(authorRef, {
      uid,
      topicId: topicRef.id,
      createdAt: FieldValue.serverTimestamp()
    });
    await batch.commit();
  } catch (error) {
    if (storedImage?.file) await storedImage.file.delete({ ignoreNotFound: true }).catch(() => {});
    if (error instanceof HttpsError) throw error;
    console.error('Dripso topic creation failed:', error);
    throw new HttpsError('internal', '주제 또는 사진을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  }

  return { success: true, topicId: topicRef.id, hasImage: !!storedImage };
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
    const [commentSnap, likeSnap, topicSnap] = await Promise.all([
      tx.get(commentRef),
      tx.get(likeRef),
      tx.get(topicRef)
    ]);
    if (!commentSnap.exists || commentSnap.data()?.status !== 'visible') {
      throw new HttpsError('not-found', '드립 댓글을 찾을 수 없습니다.');
    }
    if (!topicSnap.exists || topicSnap.data()?.status !== 'visible') {
      throw new HttpsError('not-found', '드립 주제를 찾을 수 없습니다.');
    }

    const currentCount = Math.max(0, Number(commentSnap.data().likeCount) || 0);
    const liked = !likeSnap.exists;
    const nextCount = Math.max(0, currentCount + (liked ? 1 : -1));
    const currentTop = Math.max(0, Number(topicSnap.data().topLikeCount) || 0);

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
      topLikeCount: liked ? Math.max(currentTop, nextCount) : currentTop
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
