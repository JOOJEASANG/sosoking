'use strict';

function cleanText(value, maxLen) {
  return String(value || '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
}

function cleanDocument(value, maxLen) {
  return String(value || '')
    .replace(/\r/g, '')
    .replace(/[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLen);
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isSanitizedPublicResult(data = {}) {
  return data.isPublic === true
    && Number(data.publicDataVersion || 0) === 1
    && !Object.prototype.hasOwnProperty.call(data, 'userId')
    && !Object.prototype.hasOwnProperty.call(data, 'caseDescription')
    && !Object.prototype.hasOwnProperty.call(data, 'nickname');
}

function safeTags(value) {
  return (Array.isArray(value) ? value : [])
    .map(tag => cleanText(tag, 10))
    .filter(tag => /^[가-힣a-zA-Z0-9]{2,10}$/.test(tag))
    .slice(0, 5);
}

function storageAppeal(value = {}) {
  if (!value || typeof value !== 'object') return null;
  const reason = cleanText(value.reason, 160);
  const verdict = cleanDocument(value.verdict, 1800);
  if (!reason && !verdict) return null;
  return {
    status: cleanText(value.status, 30),
    reason,
    verdict,
    contentSafetyStatus: cleanText(value.contentSafetyStatus, 30),
    createdAt: value.createdAt || null
  };
}

// This is the only schema that may be persisted in public_results.
// It intentionally omits ownership, raw submissions, private nicknames, processing locks,
// moderation internals, AI quota/accounting data and any future fields unless explicitly added here.
function publicStorageProjection(raw = {}) {
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
    reception: cleanDocument(raw.reception, 5000),
    investigation: cleanDocument(raw.investigation, 6000),
    plaintiffArg: cleanDocument(raw.plaintiffArg, 5000),
    defendantArg: cleanDocument(raw.defendantArg, 5000),
    verdict: cleanDocument(raw.verdict, 7000),
    sentence: cleanDocument(raw.sentence, 1000),
    aiSource: cleanText(raw.aiSource, 60),
    aiModel: cleanText(raw.aiModel, 80),
    aiFallbackReason: cleanText(raw.aiFallbackReason, 200),
    promptVersion: cleanText(raw.promptVersion, 80),
    contentSafetyStatus: cleanText(raw.contentSafetyStatus, 30),
    contentSafetyCheckedAt: raw.contentSafetyCheckedAt || null,
    reactionTotal: Math.max(0, Number(raw.reactionTotal) || 0),
    commentCount: Math.max(0, Number(raw.commentCount) || 0),
    courtStage: cleanText(raw.courtStage, 30),
    appeal: storageAppeal(raw.appeal),
    createdAt: raw.createdAt || null,
    updatedAt: raw.updatedAt || raw.createdAt || null
  };
}

function publicClientProjection(raw = {}) {
  const stored = publicStorageProjection(raw);
  return {
    ...stored,
    contentSafetyCheckedAt: timestampMillis(stored.contentSafetyCheckedAt),
    createdAt: timestampMillis(stored.createdAt),
    updatedAt: timestampMillis(stored.updatedAt),
    appeal: stored.appeal
      ? { ...stored.appeal, createdAt: timestampMillis(stored.appeal.createdAt) }
      : null
  };
}

module.exports = {
  isSanitizedPublicResult,
  publicClientProjection,
  publicStorageProjection,
  timestampMillis
};
