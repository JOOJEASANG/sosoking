const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { enforceActionRateLimit, requireVerifiedUser, reserveAiRequest } = require('./security');
const { inspectContent } = require('./content-safety');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';
const REACTIONS = ['plaintiff','defendant','both'];
const APPEAL_LOCK_TIMEOUT_MS = 4 * 60 * 1000;
const APPEAL_REQUEST_TIMEOUT_MS = 75 * 1000;

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function safeVoteCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function normalizeReactionCounts(data = {}) {
  const nested = data.counts && typeof data.counts === 'object' && !Array.isArray(data.counts)
    ? data.counts
    : {};
  const includeLegacyFlatFields = Number(data.reactionDataVersion || 0) < 2;
  return Object.fromEntries(REACTIONS.map(side => [
    side,
    safeVoteCount(nested[side])
      + (includeLegacyFlatFields ? safeVoteCount(data[`counts.${side}`]) : 0)
  ]));
}

function reactionCountTotal(counts = {}) {
  return REACTIONS.reduce((sum, side) => sum + safeVoteCount(counts[side]), 0);
}

function timestampMillis(value) {
  if (value?.toMillis) return value.toMillis();
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isDeletionLocked(...records) {
  return records.some(data => {
    const deletionStatus = String(data?.deletionStatus || '').toLowerCase();
    const status = String(data?.status || '').toLowerCase();
    const courtStage = String(data?.courtStage || '').toLowerCase();
    return deletionStatus === 'processing'
      || deletionStatus === 'deleting'
      || status === 'deleting'
      || courtStage === 'deleting';
  });
}

function isModerationHidden(...records) {
  return records.some(data => String(data?.moderationStatus || '').toLowerCase().startsWith('hidden'));
}

function publicResultText(caseData = {}, resultData = {}) {
  return [
    caseData.caseTitle,
    caseData.caseDescription,
    resultData.caseTitle,
    resultData.caseDescription,
    resultData.reception,
    resultData.investigation,
    resultData.plaintiffArg,
    resultData.defendantArg,
    resultData.verdict,
    resultData.sentence,
    resultData.appeal?.reason,
    resultData.appeal?.verdict
  ].filter(Boolean).join('\n');
}

function assertSafeForPublic(caseData, resultData) {
  const safety = inspectContent(publicResultText(caseData, resultData));
  if (!safety.safe) {
    throw new HttpsError(
      'failed-precondition',
      '공개할 수 없는 개인정보 또는 고위험 내용이 포함되어 있습니다. 내용을 확인해 주세요.'
    );
  }
}

function isSanitizedPublicResult(data = {}) {
  return data.isPublic === true
    && Number(data.publicDataVersion || 0) === 1
    && !Object.prototype.hasOwnProperty.call(data, 'userId')
    && !Object.prototype.hasOwnProperty.call(data, 'caseDescription')
    && !Object.prototype.hasOwnProperty.call(data, 'nickname');
}

function assertParticipablePublicResult(data = {}) {
  if (isDeletionLocked(data)) {
    throw new HttpsError('failed-precondition', '삭제 중인 판결문에는 참여할 수 없습니다.');
  }
  if (!isSanitizedPublicResult(data)) {
    throw new HttpsError('permission-denied', '공개 준비가 완료된 판결문만 참여할 수 있습니다.');
  }
}

function assertVisibilityChangeAllowed(caseData = {}, resultData = {}, isPublic = false) {
  if (isDeletionLocked(caseData, resultData)) {
    throw new HttpsError('failed-precondition', '삭제 중인 사건은 공개 상태를 변경할 수 없습니다.');
  }
  if (isPublic && isModerationHidden(caseData, resultData)) {
    throw new HttpsError('failed-precondition', '운영 검토로 숨김 처리된 판결문은 다시 공개할 수 없습니다.');
  }
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map(part => typeof part?.text === 'string' ? part.text : '')
    .filter(Boolean)
    .join('\n')
    .trim();
}

async function callAppealGemini(apiKey, modelName, prompt) {
  if (!apiKey) throw new Error('GEMINI_API_KEY가 비어 있습니다.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APPEAL_REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${GEMINI_ENDPOINT}/${encodeURIComponent(modelName)}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.85,
          topP: 0.95,
          maxOutputTokens: 1800
        }
      }),
      signal: controller.signal
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(cleanText(payload?.error?.message, 500) || `Gemini 요청 실패 (${response.status})`);
    }
    const text = extractGeminiText(payload);
    if (!text) throw new Error('항소심 AI 응답이 비어 있습니다.');
    return text;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('항소심 AI 응답 시간이 초과되었습니다.');
    throw error;
  } finally {
    clearTimeout(timer);
  }
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
  assertParticipablePublicResult(data);
  return { resultRef, data };
}

exports.voteResult = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const reaction = cleanText(request.data?.reaction, 20);
  if (!/^[A-Za-z0-9_-]{1,180}$/.test(caseId) || !REACTIONS.includes(reaction)) {
    throw new HttpsError('invalid-argument', '원고 승, 피고 승, 쌍방 과실 중 하나를 선택해 주세요.');
  }

  const { resultRef } = await assertPublicResult(caseId);
  await enforceActionRateLimit(uid, 'court-vote', {
    cooldownSeconds: 2,
    dailyLimit: 200
  });

  const summaryRef = db.doc(`result_reactions/${caseId}`);
  const voteRef = db.doc(`result_reactions/${caseId}/votes/${uid}`);
  let savedReaction = reaction;
  let alreadyVoted = false;
  let summaryCounts = Object.fromEntries(REACTIONS.map(side => [side, 0]));
  let summaryTotal = 0;

  await db.runTransaction(async tx => {
    const [latestResultSnap, voteSnap, summarySnap] = await Promise.all([
      tx.get(resultRef),
      tx.get(voteRef),
      tx.get(summaryRef)
    ]);
    if (!latestResultSnap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
    assertParticipablePublicResult(latestResultSnap.data());

    const summaryData = summarySnap.exists ? summarySnap.data() : {};
    summaryCounts = normalizeReactionCounts(summaryData);
    const previousRaw = voteSnap.exists ? cleanText(voteSnap.data().reaction, 20) : '';

    if (REACTIONS.includes(previousRaw)) {
      savedReaction = previousRaw;
      alreadyVoted = true;
    } else {
      summaryCounts[reaction] = safeVoteCount(summaryCounts[reaction]) + 1;
      tx.set(voteRef, {
        uid,
        reaction,
        createdAt: voteSnap.exists ? (voteSnap.data().createdAt || FieldValue.serverTimestamp()) : FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    summaryTotal = reactionCountTotal(summaryCounts);
    tx.set(summaryRef, {
      reactionDataVersion: 2,
      counts: summaryCounts,
      total: summaryTotal,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.update(resultRef, {
      reactionTotal: summaryTotal,
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return {
    success: true,
    reaction: savedReaction,
    alreadyVoted,
    summary: { counts: summaryCounts, total: summaryTotal }
  };
});

exports.addCourtComment = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);

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
  await enforceActionRateLimit(uid, 'court-comment', {
    cooldownSeconds: 15,
    dailyLimit: 20
  });

  const nickname = await loadNickname(uid);
  const commentRef = db.collection(`court_comments/${caseId}/items`).doc();
  const authorRef = db.doc(`court_comment_authors/${caseId}/items/${commentRef.id}`);
  const statsRef = db.doc(`court_comment_stats/${caseId}`);

  await db.runTransaction(async tx => {
    const latestResultSnap = await tx.get(resultRef);
    if (!latestResultSnap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
    assertParticipablePublicResult(latestResultSnap.data());

    tx.set(commentRef, {
      nickname,
      text,
      status: 'visible',
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(authorRef, {
      uid,
      caseId,
      commentId: commentRef.id,
      createdAt: FieldValue.serverTimestamp()
    });
    tx.set(statsRef, {
      count: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    tx.update(resultRef, {
      commentCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp()
    });
  });

  return { success: true };
});

exports.setResultVisibility = onCall({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB'
}, async request => {
  requireVerifiedUser(request);

  const uid = request.auth.uid;
  const caseId = cleanText(request.data?.caseId, 180);
  const isPublic = request.data?.isPublic;
  if (!caseId || typeof isPublic !== 'boolean') {
    throw new HttpsError('invalid-argument', '공개 상태 요청이 올바르지 않습니다.');
  }

  await enforceActionRateLimit(uid, 'result-visibility', {
    cooldownSeconds: 5,
    dailyLimit: 50
  });

  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  await db.runTransaction(async tx => {
    const [caseSnap, resultSnap] = await Promise.all([
      tx.get(caseRef),
      tx.get(resultRef)
    ]);
    if (!caseSnap.exists || !resultSnap.exists) {
      throw new HttpsError('not-found', '사건 또는 판결문을 찾을 수 없습니다.');
    }
    const caseData = caseSnap.data();
    const resultData = resultSnap.data();
    if (caseData.userId !== uid) {
      throw new HttpsError('permission-denied', '본인 판결문만 공개 상태를 변경할 수 있습니다.');
    }
    assertVisibilityChangeAllowed(caseData, resultData, isPublic);
    if (isPublic) assertSafeForPublic(caseData, resultData);

    tx.update(caseRef, {
      isPublic,
      updatedAt: FieldValue.serverTimestamp()
    });
    tx.update(resultRef, {
      isPublic,
      userId: FieldValue.delete(),
      caseDescription: FieldValue.delete(),
      nickname: FieldValue.delete(),
      publicCaseDescription: resultData.publicCaseDescription || '',
      publicNickname: resultData.publicNickname || '익명 원고',
      publicDataVersion: 1,
      contentSafetyStatus: isPublic ? 'passed' : (resultData.contentSafetyStatus || 'not-public'),
      contentSafetyCheckedAt: isPublic ? FieldValue.serverTimestamp() : (resultData.contentSafetyCheckedAt || FieldValue.delete()),
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
    const [caseSnap, resultSnap] = await Promise.all([
      tx.get(caseRef),
      tx.get(resultRef)
    ]);
    if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    if (!resultSnap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');

    const caseData = caseSnap.data();
    const resultData = resultSnap.data();
    if (caseData.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 항소할 수 있습니다.');
    if (isDeletionLocked(caseData, resultData)) {
      throw new HttpsError('failed-precondition', '삭제 중인 사건은 항소할 수 없습니다.');
    }
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

  const prompt = `소소킹 판결소 항소심 판결문을 작성하세요. 실제 법적 효력은 없고 오락 목적임을 포함하세요.\n\n사건명: ${c.caseTitle || r.caseTitle}\n1심 판사: ${r.judgeType || 'AI'}\n1심 주문: ${r.sentence || ''}\n1심 판결 이유: ${r.verdict || ''}\n항소이유: ${reason}\n\n형식:\n1. 항소심 주문\n2. 항소이유 요지\n3. 항소심 판단\n4. 최종 생활형 처분\n\n진짜 판결문처럼 진지하지만 별것 아닌 생활사건이라 웃기게, 3문단 이내.`;
  let appealVerdict = '';
  try {
    const settingsSnap = await db.doc('site_settings/config').get();
    const settings = settingsSnap.exists ? settingsSnap.data() : {};
    await reserveAiRequest(uid, 'appeal', settings);
    const modelName = cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash';
    appealVerdict = cleanText(
      await callAppealGemini(geminiKey.value().trim(), modelName, prompt),
      1800
    );
    if (!appealVerdict) throw new Error('항소심 AI 응답이 비어 있습니다.');
    const appealSafety = inspectContent(appealVerdict);
    if (!appealSafety.safe) throw new Error(`항소심 AI 안전검사 실패: ${appealSafety.code || 'unknown'}`);

    await db.runTransaction(async tx => {
      const [latestResult, latestCase] = await Promise.all([
        tx.get(resultRef),
        tx.get(caseRef)
      ]);
      if (!latestResult.exists || !latestCase.exists) {
        throw new HttpsError('not-found', '사건 또는 판결문을 찾을 수 없습니다.');
      }
      if (isDeletionLocked(latestCase.data(), latestResult.data())) {
        throw new HttpsError('failed-precondition', '삭제 중인 사건은 항소 결과를 저장할 수 없습니다.');
      }
      const appeal = latestResult.data().appeal || {};
      if (appeal.verdict) return;
      if (appeal.requestId !== requestId || appeal.status !== 'processing') {
        throw new HttpsError('aborted', '항소 처리 권한이 만료되었습니다.');
      }

      tx.update(resultRef, {
        'appeal.status': 'completed',
        'appeal.reason': reason,
        'appeal.verdict': appealVerdict,
        'appeal.contentSafetyStatus': 'passed',
        'appeal.createdAt': FieldValue.serverTimestamp(),
        'appeal.requestId': FieldValue.delete(),
        'appeal.processingStartedAt': FieldValue.delete(),
        'appeal.errorMessage': FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp()
      });
      tx.update(caseRef, {
        hasAppeal: true,
        updatedAt: FieldValue.serverTimestamp()
      });
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

Object.defineProperties(module.exports, {
  isDeletionLocked: { value: isDeletionLocked, enumerable: false },
  isModerationHidden: { value: isModerationHidden, enumerable: false },
  assertParticipablePublicResult: { value: assertParticipablePublicResult, enumerable: false },
  assertVisibilityChangeAllowed: { value: assertVisibilityChangeAllowed, enumerable: false }
});