const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { isAdminAuth } = require('./admin-utils');

const db = getFirestore();
const REGION = 'asia-northeast3';
const ADMIN_OPTIONS = {
  region: REGION,
  timeoutSeconds: 300,
  memory: '256MiB',
  cors: true,
};

async function assertAdmin(request) {
  if (!request.auth || !(await isAdminAuth(request.auth))) {
    throw new HttpsError('permission-denied', '관리자만 실행할 수 있습니다.');
  }
}

async function scrubPublicResultIdentifiers() {
  const snapshot = await db.collection('results').where('isPublic', '==', true).get();
  const privateFields = [
    'userId',
    'ownerId',
    'visibilityUpdatedBy',
    'imageAttachment',
    'imageAttachmentMeta',
    'imageStoragePath',
  ];
  const targets = snapshot.docs.filter(document => {
    const data = document.data() || {};
    return privateFields.some(field => data[field] !== undefined);
  });

  let scrubbed = 0;
  for (let offset = 0; offset < targets.length; offset += 400) {
    const batch = db.batch();
    for (const document of targets.slice(offset, offset + 400)) {
      batch.set(document.ref, {
        userId: FieldValue.delete(),
        ownerId: FieldValue.delete(),
        visibilityUpdatedBy: FieldValue.delete(),
        imageAttachment: FieldValue.delete(),
        imageAttachmentMeta: FieldValue.delete(),
        imageStoragePath: FieldValue.delete(),
        publicIdentifiersScrubbedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      scrubbed += 1;
    }
    await batch.commit();
  }
  return { checked: snapshot.size, scrubbed };
}

async function scrubPublicCommentIdentifiers() {
  const snapshot = await db.collectionGroup('items').get();
  const targets = snapshot.docs.filter(document => {
    if (!document.ref.path.startsWith('court_comments/') || !document.ref.path.includes('/items/')) return false;
    const data = document.data() || {};
    return data.authorId !== undefined || data.uid !== undefined || data.userId !== undefined;
  });

  let scrubbed = 0;
  for (let offset = 0; offset < targets.length; offset += 400) {
    const batch = db.batch();
    for (const document of targets.slice(offset, offset + 400)) {
      batch.set(document.ref, {
        authorId: FieldValue.delete(),
        uid: FieldValue.delete(),
        userId: FieldValue.delete(),
        publicIdentifiersScrubbedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      scrubbed += 1;
    }
    await batch.commit();
  }
  return { checked: snapshot.size, scrubbed };
}

function legacyPublicIdCandidate(id) {
  return !id.startsWith('case_')
    && !id.startsWith('daily_')
    && /^.+_\d{13}_[a-z0-9]{6}$/.test(id);
}

async function auditLegacyPublicCaseIds() {
  const snapshot = await db.collection('results').where('isPublic', '==', true).get();
  const candidates = snapshot.docs.filter(document => legacyPublicIdCandidate(document.id));
  const confirmed = [];

  for (let offset = 0; offset < candidates.length; offset += 50) {
    const group = candidates.slice(offset, offset + 50);
    const caseSnapshots = await Promise.all(
      group.map(document => db.doc(`cases/${document.id}`).get().catch(() => null)),
    );
    group.forEach((document, index) => {
      const caseSnapshot = caseSnapshots[index];
      const caseData = caseSnapshot?.exists ? caseSnapshot.data() || {} : {};
      const uid = String(caseData.userId || '');
      if (uid && document.id.startsWith(`${uid}_`)) {
        const resultData = document.data() || {};
        confirmed.push({
          caseId: document.id,
          caseTitle: String(resultData.caseTitle || caseData.caseTitle || '').slice(0, 80),
          createdAt: resultData.createdAt?.toDate ? resultData.createdAt.toDate().toISOString() : '',
        });
      }
    });
  }

  return {
    checked: snapshot.size,
    candidateCount: candidates.length,
    confirmedCount: confirmed.length,
    migrationRequired: confirmed.length > 0,
    cases: confirmed.slice(0, 100),
    truncated: confirmed.length > 100,
  };
}

// 신규 공개 전환은 즉시 식별정보를 제거하므로 자동 점검은 월 1회면 충분하다.
// 기존 댓글 전체 스캔은 관리자 수동 정리 때만 실행해 읽기 비용 증가를 방지한다.
exports.scrubPublicResultIdentifiers = onSchedule({
  region: REGION,
  schedule: '40 3 1 * *',
  timeZone: 'Asia/Seoul',
  timeoutSeconds: 300,
  memory: '256MiB',
}, async () => {
  console.log('monthly public result identifier scrub:', await scrubPublicResultIdentifiers());
});

exports.scrubPublicResultIdentifiersNow = onCall(ADMIN_OPTIONS, async request => {
  await assertAdmin(request);
  const [results, comments] = await Promise.all([
    scrubPublicResultIdentifiers(),
    scrubPublicCommentIdentifiers(),
  ]);
  return { results, comments };
});

exports.auditLegacyPublicCaseIdsNow = onCall(ADMIN_OPTIONS, async request => {
  await assertAdmin(request);
  return await auditLegacyPublicCaseIds();
});
