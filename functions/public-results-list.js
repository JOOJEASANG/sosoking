'use strict';

const { onCall } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { requireAppCheck } = require('./security');

const db = getFirestore();
const REGION = 'asia-northeast3';
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

function clampLimit(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(parsed)));
}

function isSanitizedPublicResult(data = {}) {
  return data.isPublic === true
    && Number(data.publicDataVersion || 0) === 1
    && !Object.prototype.hasOwnProperty.call(data, 'userId')
    && !Object.prototype.hasOwnProperty.call(data, 'caseDescription')
    && !Object.prototype.hasOwnProperty.call(data, 'nickname');
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function safeTags(value) {
  return (Array.isArray(value) ? value : [])
    .map(tag => cleanText(tag, 10))
    .filter(tag => /^[가-힣a-zA-Z0-9]{2,10}$/.test(tag))
    .slice(0, 5);
}

function safeAppeal(value = {}) {
  if (!value || typeof value !== 'object') return null;
  const verdict = cleanText(value.verdict, 1800);
  const reason = cleanText(value.reason, 160);
  if (!verdict && !reason) return null;
  return {
    status: cleanText(value.status, 30),
    reason,
    verdict,
    createdAt: timestampMillis(value.createdAt)
  };
}

// 공개 화면에서 실제 사용하는 필드만 명시적으로 복사한다.
// 새 내부 필드가 results 문서에 추가되더라도 이 함수에 허용하지 않는 한 외부로 나가지 않는다.
function publicProjection(raw = {}) {
  return {
    source: cleanText(raw.source, 30),
    dailyDate: cleanText(raw.dailyDate, 20),
    docketNumber: cleanText(raw.docketNumber, 100),
    courtName: cleanText(raw.courtName, 80),
    courtroom: cleanText(raw.courtroom, 80),
    division: cleanText(raw.division, 80),
    isPublic: true,
    publicDataVersion: 1,
    publicCaseDescription: cleanText(raw.publicCaseDescription, 600),
    publicNickname: cleanText(raw.publicNickname, 30) || '익명 원고',
    caseTitle: cleanText(raw.caseTitle, 80) || '생활분쟁 사건',
    grievanceIndex: Math.max(1, Math.min(10, Number(raw.grievanceIndex) || 5)),
    tags: safeTags(raw.tags),
    judgeType: cleanText(raw.judgeType, 40),
    judgeIcon: cleanText(raw.judgeIcon, 16),
    judgeStyle: cleanText(raw.judgeStyle, 400),
    winner: ['plaintiff', 'defendant', 'both'].includes(String(raw.winner || '')) ? raw.winner : '',
    reception: cleanText(raw.reception, 5000),
    investigation: cleanText(raw.investigation, 6000),
    plaintiffArg: cleanText(raw.plaintiffArg, 5000),
    defendantArg: cleanText(raw.defendantArg, 5000),
    verdict: cleanText(raw.verdict, 7000),
    sentence: cleanText(raw.sentence, 1000),
    aiSource: cleanText(raw.aiSource, 60),
    aiModel: cleanText(raw.aiModel, 80),
    contentSafetyStatus: cleanText(raw.contentSafetyStatus, 30),
    reactionTotal: Math.max(0, Number(raw.reactionTotal) || 0),
    commentCount: Math.max(0, Number(raw.commentCount) || 0),
    courtStage: cleanText(raw.courtStage, 30),
    appeal: safeAppeal(raw.appeal),
    createdAt: timestampMillis(raw.createdAt),
    updatedAt: timestampMillis(raw.updatedAt || raw.createdAt)
  };
}

function isMissingIndexError(error) {
  const code = String(error?.code || '').toLowerCase();
  const message = String(error?.message || '').toLowerCase();
  return code.includes('failed-precondition')
    || code === '9'
    || message.includes('requires an index')
    || message.includes('index is currently building');
}

async function loadRows(maxRows) {
  const base = db.collection('results')
    .where('isPublic', '==', true)
    .where('publicDataVersion', '==', 1);

  let documents;
  try {
    const snapshot = await base.orderBy('createdAt', 'desc').limit(maxRows).get();
    documents = snapshot.docs;
  } catch (error) {
    if (!isMissingIndexError(error)) throw error;
    const snapshot = await base.limit(Math.min(MAX_LIMIT * 2, Math.max(maxRows, 100))).get();
    documents = snapshot.docs
      .sort((left, right) => timestampMillis(right.data()?.createdAt) - timestampMillis(left.data()?.createdAt))
      .slice(0, maxRows);
  }

  return documents
    .filter(document => isSanitizedPublicResult(document.data() || {}))
    .map(document => ({ id: document.id, data: publicProjection(document.data() || {}) }));
}

exports.listPublicResults = onCall({
  region: REGION,
  timeoutSeconds: 20,
  memory: '256MiB',
  maxInstances: 20
}, async request => {
  requireAppCheck(request);
  const maxRows = clampLimit(request.data?.maxRows);
  return { rows: await loadRows(maxRows) };
});

Object.defineProperties(module.exports, {
  isSanitizedPublicResult: { value: isSanitizedPublicResult, enumerable: false },
  publicProjection: { value: publicProjection, enumerable: false }
});
