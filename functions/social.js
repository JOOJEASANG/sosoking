const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { requireVerifiedUser, reserveAiRequest } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const REACTIONS = ['plaintiff','defendant','both','tooMuch','funny'];
const APPEAL_LOCK_TIMEOUT_MS = 4 * 60 * 1000;

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function timestampMillis(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

async function loadNickname(uid, fallback = '익명 방청객') {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists ? cleanText(snap.data().nickname, 20) || fallback : fallback;
}

async function assertPublicResult(caseId) {
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await resultRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
  const data = snap.data();
  if (!data.isPublic) throw new HttpsError('permission-denied', '공개 판결문만 참여할 수 있습니다.');
  return { resultRef, data };
}

exports.voteResult = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const reaction = cleanText(request.data?.reaction, 20);
  if (!caseId || !REACTIONS.includes(reaction)) {
    throw new HttpsError('invalid-argument', '잘못된 반응입니다.');
  }

  const { resultRef } = await assertPublicResult(caseId);
  const summaryRef = db.doc(`result_reactions/${caseId}`);
  const voteRef = db.doc(`result_reactions/${caseId}/votes/${uid}`);

  await db.runTransaction(async tx => {
    const voteSnap = await tx.get(voteRef);
    const prev = voteSnap.exists ? voteSnap.data().reaction : '';
    const isNewVote = !prev;

    const updates = {
      updatedAt: FieldValue.serverTimestamp(),
      total: FieldValue.increment(isNewVote ? 1 : 0)
    };

    if (prev && prev !== reaction) updates[`counts.${prev}`] = FieldValue.increment(-1);
    if (prev !== reaction) updates[`counts.${reaction}`] = FieldValue.increment(1);

    tx.set(summaryRef, updates, { merge: true });
    tx.set(voteRef, {
      uid,
      reaction,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });

    if (isNewVote) {
      tx.set(resultRef, {
        reactionTotal: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  });

  return { success: true };
});

exports.addCourtComment = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const text = cleanText(request.data?.text, 120);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  if (text.length < 2) throw new HttpsError('invalid-argument', '방청석 한마디는 2자 이상 입력해주세요.');
  const commentSafety = inspectContent(text);
  if (!commentSafety.safe || /(욕설|시발|씨발|병신|개새끼|죽어|실명|전화번호)/i.test(text)) {
    throw new HttpsError('failed-precondition', '부적절한 표현이 포함되어 있습니다.');
  }

  const { resultRef } = await assertPublicResult(caseId);
  const nickname = await loadNickname(uid);
  const commentRef = db.collection(`court_comments/${caseId}/items`).doc();
  const statsRef = db.doc(`court_comment_stats/${caseId}`);
  const batch = db.batch();

  batch.set(commentRef, {
    nickname,
    text,
    status: 'visible',
    createdAt: FieldValue.serverTimestamp()
  });
  batch.set(statsRef, {
    count: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(resultRef, {
    commentCount: FieldValue.increment(1),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  await batch.commit();
  return { success: true };
});

exports.setResultVisibility = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  if (!request.auth) throw new HttpsError('unauthenticated', '로그인이 필요합니다.');

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const isPublic = request.data?.isPublic;
  if (!caseId || typeof isPublic !== 'boolean') {
    throw new HttpsError('invalid-argument', '공개 상태 요청이 올바르지 않습니다.');
  }

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  await db.runTransaction(async tx => {
    const caseSnap = await tx.get(caseRef);
    const resultSnap = await tx.get(resultRef);
    if (!caseSnap.exists || !resultSnap.exists) {
      throw new HttpsError('not-found', '사건 또는 판결문을 찾을 수 없습니다.');
    }
    if (caseSnap.data().userId !== uid) {
      throw new HttpsError('permission-denied', '본인 판결문만 공개 상태를 변경할 수 있습니다.');
    }

    tx.update(caseRef, {
      isPublic,
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.update(resultRef, {
      isPublic,
      // 과거 결과 문서에 남아 있을 수 있는 인증 UID도 공개 전에 제거한다.
      userId: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { success: true, isPublic };
});

exports.requestAppeal = onCall({
  region: REGION,
  secrets: [geminiKey],
  timeoutSeconds: 180,
  memory: '512MiB'
}, async request => {
  requireVerifiedUser(request);

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  if (!caseId) throw new HttpsError('invalid-argument', 'caseId required');
  const reason = cleanText(request.data?.reason, 160) || '1심 판결이 지나치게 엄숙하여 다시 판단을 구합니다.';
  const reasonSafety = inspectContent(reason);
  if (!reasonSafety.safe) throw new HttpsError('failed-precondition', reasonSafety.message);
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const requestId = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`;
  const lock = await db.runTransaction(async tx => {
    const caseSnap = await tx.get(caseRef);
    const resultSnap = await tx.get(resultRef);
    if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    if (!resultSnap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');

    const caseData = caseSnap.data();
    const resultData = resultSnap.data();
    if (caseData.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 항소할 수 있습니다.');
    if (resultData.appeal?.verdict) return { state: 'completed' };

    const startedAt = timestampMillis(resultData.appeal?.processingStartedAt);
    const lockIsFresh = resultData.appeal?.status === 'processing'
      && startedAt
      && Date.now() - startedAt < APPEAL_LOCK_TIMEOUT_MS;
    if (lockIsFresh) return { state: 'processing' };

    tx.update(resultRef, {
      'appeal.status': 'processing',
      'appeal.reason': reason,
      'appeal.requestId': requestId,
      'appeal.processingStartedAt': FieldValue.serverTimestamp(),
      'appeal.verdict': FieldValue.delete(),
      'appeal.errorMessage': FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return { state: 'acquired', caseData, resultData };
  });

  if (lock.state === 'completed') return { success: true, alreadyExists: true };
  if (lock.state === 'processing') return { success: true, skipped: 'processing' };
  const c = lock.caseData;
  const r = lock.resultData;

  const model = new GoogleGenerativeAI(geminiKey.value().trim())
    .getGenerativeModel({ model: 'gemini-2.5-flash' });
  const prompt = `소소킹 판결소 항소심 판결문을 작성하세요. 실제 법적 효력은 없고 오락 목적임을 포함하세요.\n\n사건명: ${c.caseTitle || r.caseTitle}\n1심 판사: ${r.judgeType || 'AI'}\n1심 주문: ${r.sentence || ''}\n1심 판결 이유: ${r.verdict || ''}\n항소이유: ${reason}\n\n형식:\n1. 항소심 주문\n2. 항소이유 요지\n3. 항소심 판단\n4. 최종 생활형 처분\n\n진짜 판결문처럼 진지하지만 별것 아닌 생활사건이라 웃기게, 3문단 이내.`;
  let appealVerdict = '';
  try {
    const settingsSnap = await db.doc('site_settings/config').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    await reserveAiRequest(uid, 'appeal', settings);
    const ai = await model.generateContent(prompt);
    appealVerdict = cleanText(ai.response.text(), 1800);
    if (!appealVerdict) throw new Error('항소심 AI 응답이 비어 있습니다.');

    await db.runTransaction(async tx => {
      const latest = await tx.get(resultRef);
      if (!latest.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
      const appeal = latest.data().appeal || {};
      if (appeal.verdict) return;
      if (appeal.requestId !== requestId || appeal.status !== 'processing') {
        throw new HttpsError('aborted', '항소 처리 권한이 만료되었습니다.');
      }

      tx.update(resultRef, {
        'appeal.status': 'completed',
        'appeal.reason': reason,
        'appeal.verdict': appealVerdict,
        'appeal.createdAt': FieldValue.serverTimestamp(),
        'appeal.requestId': FieldValue.delete(),
        'appeal.processingStartedAt': FieldValue.delete(),
        'appeal.errorMessage': FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
      tx.set(caseRef, {
        hasAppeal: true,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    });
  } catch (err) {
    await db.runTransaction(async tx => {
      const latest = await tx.get(resultRef);
      if (!latest.exists) return;
      const appeal = latest.data().appeal || {};
      if (appeal.requestId !== requestId || appeal.status !== 'processing') return;
      tx.update(resultRef, {
        'appeal.status': 'error',
        'appeal.reason': reason,
        'appeal.errorMessage': '항소심 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.',
        'appeal.requestId': FieldValue.delete(),
        'appeal.processingStartedAt': FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
    }).catch(lockError => console.error('appeal lock cleanup failed:', lockError));
    if (err instanceof HttpsError) throw err;
    console.error('requestAppeal AI failed:', err);
    throw new HttpsError('unavailable', '항소심 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.');
  }

  return { success: true, verdict: appealVerdict };
});
