const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { cleanText, cleanParagraph, ordersAsText } = require('./judgment-v2');
const {
  requireVerifiedUser,
  validDocumentId,
  assertNoSensitiveContent,
  publicAuthorId,
} = require('./security-utils');

const db = getFirestore();
const geminiKey = defineSecret('GEMINI_API_KEY');
const REGION = 'asia-northeast3';
const REACTIONS = ['plaintiff', 'defendant', 'both', 'tooMuch', 'funny'];
const COMMENT_DAILY_LIMIT = 30;
const COMMENT_COOLDOWN_SEC = 20;
const APPEAL_DAILY_LIMIT = 5;
const APPEAL_COOLDOWN_SEC = 30;
const APPEAL_STALE_MS = 10 * 60 * 1000;
const BLOCK_COMMENT_RE = /(욕설|시발|씨발|ㅅㅂ|병신|개새끼|죽어|자살|실명|전화번호|주민번호|계좌번호|카톡아이디|카카오톡|인스타|instagram|telegram|텔레그램)/i;
const PRIVATE_RE = /(\d{2,3}[-.\s]?\d{3,4}[-.\s]?\d{4})|([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})|(\d{6}[-\s]?\d{7})/i;

function kstDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

async function loadNickname(uid, fallback = '익명 방청객') {
  const snap = await db.doc(`users/${uid}`).get().catch(() => null);
  return snap?.exists ? cleanText(snap.data().nickname, 20) || fallback : fallback;
}

async function loadSettings() {
  const snap = await db.doc('site_settings/config').get().catch(() => null);
  return snap?.exists ? snap.data() : {};
}

async function assertPublicResult(caseId) {
  const resultRef = db.doc(`results/${caseId}`);
  const snap = await resultRef.get();
  if (!snap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
  const data = snap.data();
  if (!data.isPublic) throw new HttpsError('permission-denied', '공개 판결문만 참여할 수 있습니다.');
  return { resultRef, data };
}

function normalizedReactionCounts(value = {}) {
  return Object.fromEntries(REACTIONS.map(key => {
    const number = Number(value?.[key] || 0);
    return [key, Number.isFinite(number) && number > 0 ? Math.floor(number) : 0];
  }));
}

exports.voteResult = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = requireVerifiedUser(request, '방청객 투표는 구글 또는 인증된 이메일 로그인 후 이용할 수 있습니다.');
  const caseId = validDocumentId(request.data?.caseId, '사건 ID');
  const reaction = cleanText(request.data?.reaction, 20);
  if (!REACTIONS.includes(reaction)) throw new HttpsError('invalid-argument', '잘못된 반응입니다.');
  const { resultRef } = await assertPublicResult(caseId);

  const summaryRef = db.doc(`result_reactions/${caseId}`);
  const voteRef = db.doc(`result_reactions/${caseId}/votes/${uid}`);
  await db.runTransaction(async transaction => {
    const [voteSnap, summarySnap] = await Promise.all([
      transaction.get(voteRef),
      transaction.get(summaryRef),
    ]);
    const previous = voteSnap.exists ? voteSnap.data().reaction : '';
    const counts = normalizedReactionCounts(summarySnap.exists ? summarySnap.data().counts : {});
    if (previous !== reaction) {
      if (REACTIONS.includes(previous)) counts[previous] = Math.max(0, counts[previous] - 1);
      counts[reaction] += 1;
    }
    const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
    transaction.set(summaryRef, { counts, total, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(voteRef, { uid, reaction, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(resultRef, {
      reactionCounts: counts,
      reactionTotal: total,
      totalVotes: total,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  return { success: true };
});

exports.addCourtComment = onCall({ region: REGION, timeoutSeconds: 30, memory: '256MiB' }, async request => {
  const uid = requireVerifiedUser(request, '방청석 한마디는 구글 또는 인증된 이메일 로그인 후 남길 수 있습니다.');
  const caseId = validDocumentId(request.data?.caseId, '사건 ID');
  const text = cleanText(request.data?.text, 120);
  if (text.length < 2) throw new HttpsError('invalid-argument', '방청석 한마디는 2자 이상 입력해주세요.');
  if (BLOCK_COMMENT_RE.test(text) || PRIVATE_RE.test(text)) throw new HttpsError('failed-precondition', '개인정보 또는 부적절한 표현이 포함되어 있습니다.');
  assertNoSensitiveContent(text, '댓글에 공개할 수 없는 정보');
  const { resultRef } = await assertPublicResult(caseId);
  const nickname = await loadNickname(uid);
  const today = kstDateKey();
  const limitRef = db.doc(`comment_limits/${uid}`);
  const commentRef = db.collection(`court_comments/${caseId}/items`).doc();

  await db.runTransaction(async transaction => {
    const limitSnap = await transaction.get(limitRef);
    const current = limitSnap.exists ? limitSnap.data() : {};
    const count = current.date === today ? Number(current.count || 0) : 0;
    if (count >= COMMENT_DAILY_LIMIT) throw new HttpsError('resource-exhausted', `오늘 방청석 한마디 한도 ${COMMENT_DAILY_LIMIT}개를 모두 사용했습니다.`);
    if (current.lastCommentedAt && current.date === today) {
      const lastMs = current.lastCommentedAt.toMillis ? current.lastCommentedAt.toMillis() : new Date(current.lastCommentedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (diffSec < COMMENT_COOLDOWN_SEC) throw new HttpsError('resource-exhausted', `${COMMENT_COOLDOWN_SEC - diffSec}초 후에 다시 남길 수 있습니다.`);
    }
    transaction.set(commentRef, {
      authorId: publicAuthorId(uid),
      nickname,
      text,
      status: 'visible',
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.set(db.doc(`court_comment_stats/${caseId}`), { count: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(resultRef, { commentCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(limitRef, { date: today, count: count + 1, lastCommentedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
  return { success: true };
});

function localAppealVerdict(reason, firstOrders) {
  return `항소심 주문\n원심의 황당 처분은 유지하되, 집행 과정에서 당사자 모두 한 번씩 웃을 기회를 보장한다.\n\n항소 이유 요지\n항소인은 “${cleanText(reason, 160)}”라는 이유로 원심이 지나치게 엄숙하다고 주장하였다.\n\n항소심 판단\n이 재판부는 원심 주문이 실제 법적 처분이 아니라 생활 속 갈등을 과장해 정리한 오락적 제안임을 다시 확인한다. 원심 주문의 핵심은 다음과 같다.\n${cleanParagraph(firstOrders, 1200)}\n\n최종 소소형량\n원심을 유지한다. 다만 이 판결은 실제 법적 효력이 없으며 당사자의 자율적인 화해를 우선한다.`;
}

exports.requestAppeal = onCall({ region: REGION, secrets: [geminiKey], timeoutSeconds: 180, memory: '512MiB' }, async request => {
  const uid = requireVerifiedUser(request, '항소심 신청은 구글 또는 인증된 이메일 로그인 후 이용할 수 있습니다.');
  const caseId = validDocumentId(request.data?.caseId, '사건 ID');
  const reason = cleanText(request.data?.reason, 160) || '1심 판결이 지나치게 엄숙하여 다시 판단을 구합니다.';
  assertNoSensitiveContent(reason, '항소 이유에 공개할 수 없는 정보');
  const caseRef = db.doc(`cases/${caseId}`);
  const resultRef = db.doc(`results/${caseId}`);
  const limitRef = db.doc(`appeal_limits/${uid}`);
  const today = kstDateKey();
  let caseData = {};
  let resultData = {};
  let alreadyExists = false;

  await db.runTransaction(async transaction => {
    const [caseSnap, resultSnap, limitSnap] = await Promise.all([
      transaction.get(caseRef),
      transaction.get(resultRef),
      transaction.get(limitRef),
    ]);
    if (!caseSnap.exists) throw new HttpsError('not-found', '사건을 찾을 수 없습니다.');
    if (!resultSnap.exists) throw new HttpsError('not-found', '판결문을 찾을 수 없습니다.');
    caseData = caseSnap.data() || {};
    resultData = resultSnap.data() || {};
    if (caseData.userId !== uid) throw new HttpsError('permission-denied', '본인 사건만 항소할 수 있습니다.');
    if (resultData.appeal?.verdict) {
      alreadyExists = true;
      return;
    }

    const startedAt = resultData.appeal?.startedAt?.toMillis ? resultData.appeal.startedAt.toMillis() : 0;
    if (resultData.appeal?.status === 'processing' && startedAt && Date.now() - startedAt < APPEAL_STALE_MS) {
      throw new HttpsError('already-exists', '항소심 판결을 이미 작성 중입니다.');
    }

    const current = limitSnap.exists ? limitSnap.data() : {};
    const count = current.date === today ? Number(current.count || 0) : 0;
    if (count >= APPEAL_DAILY_LIMIT) throw new HttpsError('resource-exhausted', `오늘 항소심 신청 한도 ${APPEAL_DAILY_LIMIT}회를 모두 사용했습니다.`);
    if (current.lastRequestedAt && current.date === today) {
      const lastMs = current.lastRequestedAt.toMillis ? current.lastRequestedAt.toMillis() : new Date(current.lastRequestedAt).getTime();
      const diffSec = Math.floor((Date.now() - lastMs) / 1000);
      if (diffSec < APPEAL_COOLDOWN_SEC) throw new HttpsError('resource-exhausted', `${APPEAL_COOLDOWN_SEC - diffSec}초 후에 다시 신청할 수 있습니다.`);
    }

    transaction.set(resultRef, {
      appeal: {
        status: 'processing',
        reason,
        startedAt: FieldValue.serverTimestamp(),
      },
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    transaction.set(limitRef, {
      date: today,
      count: count + 1,
      lastRequestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });

  if (alreadyExists) return { success: true, alreadyExists: true };

  const firstOrders = ordersAsText(resultData.judgment?.orders) || cleanParagraph(resultData.sentence, 2400);
  const firstOpinion = cleanParagraph(resultData.judgment?.opinion || resultData.verdict || resultData.courtOpinion, 5000);
  let appealVerdict = localAppealVerdict(reason, firstOrders);
  let aiGenerated = false;

  try {
    const key = geminiKey.value().trim();
    if (key) {
      const settings = await loadSettings();
      const model = new GoogleGenerativeAI(key).getGenerativeModel({ model: cleanText(settings.geminiModel, 60) || 'gemini-2.5-flash' });
      const prompt = `소소킹 판결소의 항소심 판결문을 작성한다. 실제 법적 효력은 없는 오락 콘텐츠임을 포함한다.\n\n사건명: ${caseData.caseTitle || resultData.caseTitle}\n1심 판사: ${resultData.judgeType || 'AI'}\n1심 주문:\n${firstOrders}\n\n1심 판결 이유:\n${firstOpinion}\n\n항소 이유: ${reason}\n\n형식은 항소심 주문, 항소 이유 요지, 항소심 판단, 최종 소소형량 순서로 작성한다. 사소한 생활 사건을 지나치게 진지하게 다루되 1,800자 이내로 작성한다.`;
      const ai = await model.generateContent(prompt);
      const generated = cleanParagraph(ai.response.text(), 1800);
      if (generated.length >= 80) {
        appealVerdict = generated;
        aiGenerated = true;
      }
    }
  } catch (error) {
    console.error('appeal generation failed, using local appeal:', error.message || error);
  }

  const batch = db.batch();
  batch.set(resultRef, {
    appeal: {
      status: 'completed',
      reason,
      verdict: appealVerdict,
      aiGenerated,
      createdAt: FieldValue.serverTimestamp(),
    },
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  batch.set(caseRef, { hasAppeal: true, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit();
  return { success: true, verdict: appealVerdict, aiGenerated };
});
