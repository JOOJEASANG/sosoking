function buildPublicResult(source = {}) {
  return {
    schemaVersion: 1,
    caseId: source.caseId,
    isPublic: source.isPublic === true,
    caseTitle: source.caseTitle || '',
    caseDescription: source.caseDescription || '',
    defendantName: source.defendantName || '피고 미지정',
    category: source.category || 'other',
    judgeType: source.judgeType || 'AI 판사',
    grievanceIndex: Number(source.grievanceIndex || 5),
    desiredVerdict: source.desiredVerdict || '',
    caseAnalysis: source.caseAnalysis || {},
    judgment: source.judgment || {},
    generationMode: source.generationMode || 'unknown',
    reactionCount: Math.max(0, Number(source.reactionCount || 0)),
    commentCount: Math.max(0, Number(source.commentCount || 0)),
    moderationStatus: source.moderationStatus || 'clear',
    createdAt: source.createdAt || null,
    updatedAt: source.updatedAt || source.createdAt || null,
  };
}

function shouldPublish(source = {}) {
  return source.isPublic === true && source.moderationStatus !== 'hidden' && Boolean(source.judgment);
}

module.exports = { buildPublicResult, shouldPublish };
