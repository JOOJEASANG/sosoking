function buildPublicResult(source = {}) {
  const trial = source.trialRecord || null;
  return {
    schemaVersion: 3,
    resultVersion: source.resultVersion || '',
    generationRevision: source.generationRevision || '',
    caseId: source.caseId,
    isPublic: source.isPublic === true,
    docketNumber: source.docketNumber || trial?.docketNumber || '',
    courtName: source.courtName || trial?.courtName || '',
    courtroom: source.courtroom || trial?.courtroom || '',
    division: source.division || trial?.division || '',
    recordClerk: source.recordClerk || trial?.recordClerk || '',
    analystName: source.analystName || trial?.analystName || '',
    prosecutorName: source.prosecutorName || trial?.prosecutorName || '',
    defenderName: source.defenderName || trial?.defenderName || '',
    caseTitle: source.caseTitle || '',
    caseDescription: source.caseDescription || '',
    defendantName: source.defendantName || '피고 미지정',
    category: source.category || 'other',
    judgeType: source.judgeType || trial?.judgeType || 'AI 판사',
    grievanceIndex: Number(source.grievanceIndex || 5),
    desiredVerdict: source.desiredVerdict || '',
    caseAnalysis: source.caseAnalysis || {},
    trialRecord: trial ? {
      resultVersion: trial.resultVersion || source.resultVersion || '',
      docketNumber: trial.docketNumber || source.docketNumber || '',
      courtName: trial.courtName || source.courtName || '',
      courtroom: trial.courtroom || source.courtroom || '',
      division: trial.division || source.division || '',
      recordClerk: trial.recordClerk || source.recordClerk || '',
      analystName: trial.analystName || source.analystName || '',
      prosecutorName: trial.prosecutorName || source.prosecutorName || '',
      defenderName: trial.defenderName || source.defenderName || '',
      judgeType: trial.judgeType || source.judgeType || '',
      refinedCaseTitle: trial.refinedCaseTitle || source.caseTitle || '',
      expandedCase: trial.expandedCase || '',
      caseTimeline: trial.caseTimeline || '',
      forensicReport: trial.forensicReport || '',
      plaintiffArg: trial.plaintiffArg || '',
      defendantArg: trial.defendantArg || '',
      courtOpinion: trial.courtOpinion || '',
      sentence: trial.sentence || '',
      closingComment: trial.closingComment || '',
      absurdDetails: Array.isArray(trial.absurdDetails) ? trial.absurdDetails : [],
      evidenceBits: Array.isArray(trial.evidenceBits) ? trial.evidenceBits : [],
      defendantExcuses: Array.isArray(trial.defendantExcuses) ? trial.defendantExcuses : [],
      penaltyIdeas: Array.isArray(trial.penaltyIdeas) ? trial.penaltyIdeas : [],
    } : null,
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
  return source.isPublic === true
    && source.moderationStatus !== 'hidden'
    && Boolean(source.judgment)
    && (!source.resultVersion || source.resultVersion === 'role-based-trial-v10' || Number(source.judgment?.engineVersion || 0) >= 3);
}

module.exports = { buildPublicResult, shouldPublish };
