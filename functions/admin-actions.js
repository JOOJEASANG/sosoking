const admin = require('firebase-admin');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const REGION = 'asia-northeast3';
const ADMIN_EMAILS = new Set(['joojeasang@gmail.com']);
const ACTIONS = new Set(['dismiss', 'hide', 'restore']);

function requireAdmin(request) {
  const token = request.auth?.token || {};
  const email = String(token.email || '').toLowerCase();
  if (!request.auth?.uid || (token.admin !== true && !ADMIN_EMAILS.has(email))) {
    throw new HttpsError('permission-denied', '관리자 권한이 필요합니다.');
  }
  return { uid: request.auth.uid, email };
}

function cleanId(value) {
  const id = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{8,180}$/.test(id)) throw new HttpsError('invalid-argument', '올바른 식별자가 아닙니다.');
  return id;
}

function cleanText(value, maxLength = 300) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function countValue(snapshot) {
  return Number(snapshot?.data?.().count || 0);
}

function timestampIso(value) {
  return value?.toDate?.().toISOString?.() || null;
}

exports.getAdminDashboard = onCall({ region: REGION, cors: true }, async request => {
  requireAdmin(request);

  const [
    caseCountSnap,
    resultCountSnap,
    publicCountSnap,
    hiddenCountSnap,
    pendingCountSnap,
    reportsSnap,
    recentResultsSnap,
  ] = await Promise.all([
    db.collection('cases').count().get(),
    db.collection('results').count().get(),
    db.collection('results').where('isPublic', '==', true).count().get(),
    db.collection('results').where('moderationStatus', '==', 'hidden').count().get(),
    db.collection('reports').where('status', '==', 'pending').count().get(),
    db.collection('reports').where('status', '==', 'pending').limit(50).get(),
    db.collection('results').orderBy('createdAt', 'desc').limit(100).get(),
  ]);

  const reportRows = await Promise.all(reportsSnap.docs.map(async reportDoc => {
    const report = reportDoc.data();
    const [resultSnap, caseSnap] = await Promise.all([
      db.collection('results').doc(report.caseId).get(),
      db.collection('cases').doc(report.caseId).get(),
    ]);
    const result = resultSnap.exists ? resultSnap.data() : {};
    const caseData = caseSnap.exists ? caseSnap.data() : {};
    return {
      id: reportDoc.id,
      caseId: report.caseId,
      reason: cleanText(report.reason, 240),
      status: report.status || 'pending',
      reporterUserId: cleanText(report.userId, 120),
      createdAt: timestampIso(report.createdAt),
      caseTitle: cleanText(result.caseTitle || caseData.title || '삭제된 사건', 100),
      caseDescription: cleanText(result.caseDescription || caseData.caseDescription || '', 320),
      isPublic: result.isPublic === true,
      moderationStatus: result.moderationStatus || caseData.moderationStatus || 'clear',
      reactionCount: Number(result.reactionCount || 0),
      commentCount: Number(result.commentCount || 0),
    };
  }));

  reportRows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));

  const recentResults = recentResultsSnap.docs.map(item => item.data());
  const usage = recentResults.reduce((sum, item) => {
    sum.totalTokens += Number(item.usage?.totalTokens || 0);
    sum.gemini += item.generationMode === 'gemini' ? 1 : 0;
    sum.fallback += item.generationMode === 'gemini' ? 0 : 1;
    return sum;
  }, { totalTokens: 0, gemini: 0, fallback: 0 });

  return {
    counts: {
      cases: countValue(caseCountSnap),
      results: countValue(resultCountSnap),
      publicResults: countValue(publicCountSnap),
      hiddenResults: countValue(hiddenCountSnap),
      pendingReports: countValue(pendingCountSnap),
    },
    usage,
    reports: reportRows,
    generatedAt: new Date().toISOString(),
  };
});

exports.moderateReport = onCall({ region: REGION, cors: true }, async request => {
  const moderator = requireAdmin(request);
  const reportId = cleanId(request.data?.reportId);
  const action = cleanText(request.data?.action, 20);
  const note = cleanText(request.data?.note, 300);
  if (!ACTIONS.has(action)) throw new HttpsError('invalid-argument', '지원하지 않는 처리 방식입니다.');

  const reportRef = db.collection('reports').doc(reportId);
  const now = admin.firestore.Timestamp.now();
  let caseId = '';

  await db.runTransaction(async transaction => {
    const reportSnap = await transaction.get(reportRef);
    if (!reportSnap.exists) throw new HttpsError('not-found', '신고 기록을 찾을 수 없습니다.');
    const report = reportSnap.data();
    caseId = cleanId(report.caseId);
    const caseRef = db.collection('cases').doc(caseId);
    const resultRef = db.collection('results').doc(caseId);
    const [caseSnap, resultSnap] = await Promise.all([transaction.get(caseRef), transaction.get(resultRef)]);

    const audit = {
      moderationAction: action,
      moderationNote: note,
      moderatedBy: moderator.uid,
      moderatedAt: now,
      updatedAt: now,
    };

    if (action === 'hide') {
      if (caseSnap.exists) transaction.update(caseRef, { ...audit, moderationStatus: 'hidden', isPublic: false });
      if (resultSnap.exists) transaction.update(resultRef, { ...audit, moderationStatus: 'hidden', isPublic: false });
    }
    if (action === 'restore') {
      if (caseSnap.exists) transaction.update(caseRef, { ...audit, moderationStatus: 'clear', isPublic: true });
      if (resultSnap.exists) transaction.update(resultRef, { ...audit, moderationStatus: 'clear', isPublic: true });
    }

    transaction.update(reportRef, {
      status: action === 'dismiss' ? 'dismissed' : action === 'hide' ? 'resolved_hidden' : 'resolved_restored',
      resolutionNote: note,
      resolvedBy: moderator.uid,
      resolvedAt: now,
      updatedAt: now,
    });
  });

  logger.info('Report moderated', { reportId, caseId, action, moderator: moderator.uid });
  return { reportId, caseId, action, completed: true };
});
