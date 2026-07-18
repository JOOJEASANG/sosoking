const {
  cleanText,
  extractJson,
  normalizeJudgment,
  isCompleteJudgment,
} = require('./judgment-v2');
const {
  evaluateStorySpecificity,
  buildRewriteInstruction,
} = require('./judgment-story-v2');
const { DEFAULT_MODEL, generateJson } = require('./gemini-runtime');

const JUDGMENT_JSON_SCHEMA = {
  type: 'object',
  properties: {
    headline: { type: 'string' },
    incidentLevel: { type: 'string' },
    breakingNews: { type: 'string' },
    emergencyBriefing: { type: 'string' },
    impactAssessment: { type: 'string' },
    summary: { type: 'string' },
    facts: { type: 'string' },
    investigation: { type: 'string' },
    plaintiffClaim: { type: 'string' },
    defendantClaim: { type: 'string' },
    prosecution: { type: 'string' },
    defense: { type: 'string' },
    opinion: { type: 'string' },
    orders: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          number: { type: 'integer' },
          text: { type: 'string' },
        },
        required: ['number', 'text'],
      },
    },
    closingComment: { type: 'string' },
    legalNotice: { type: 'string' },
  },
  required: [
    'headline', 'incidentLevel', 'breakingNews', 'emergencyBriefing',
    'impactAssessment', 'summary', 'facts', 'investigation',
    'plaintiffClaim', 'defendantClaim', 'prosecution', 'defense',
    'opinion', 'orders', 'closingComment', 'legalNotice',
  ],
};

function addUsage(total = {}, next = {}) {
  const keys = [
    'promptTokenCount',
    'candidatesTokenCount',
    'totalTokenCount',
    'cachedContentTokenCount',
    'thoughtsTokenCount',
  ];
  return Object.fromEntries(keys.map(key => [key, Number(total[key] || 0) + Number(next[key] || 0)]));
}

function evaluationScore(value = {}) {
  let score = value.passed ? 10000 : 0;
  if (value.incidentLevelMatches) score += 30;
  score += Math.min(8, Number(value.sectionHits || 0)) * 8;
  score += Math.min(5, Number(value.primarySectionHits || 0)) * 6;
  score += Math.min(5, Number(value.mentionedAnchorCount || 0)) * 7;
  score += Math.min(3, Number(value.tailoredOrders || 0)) * 12;
  score += Math.min(12, Number(value.seriousHumorHits || 0)) * 5;
  score += Math.min(12, Number(value.legalReasoningHits || 0)) * 6;
  score += Math.min(14, Number(value.distinctSectionCount || 0)) * 3;
  score -= Math.min(10, Number(value.echoSectionHits || 0)) * 8;
  score -= Math.min(10, Number(value.heavyEchoSectionHits || 0)) * 12;
  score -= Math.min(20, Number(value.copiedPhraseHits || 0)) * 2;
  score -= Math.min(10, Number(value.selfAwareHumorHits || 0)) * 20;
  return score;
}

function qualitySummary(value = {}) {
  return {
    passed: value.passed === true,
    score: evaluationScore(value),
    sectionHits: Number(value.sectionHits || 0),
    mentionedAnchorCount: Number(value.mentionedAnchorCount || 0),
    tailoredOrders: Number(value.tailoredOrders || 0),
    seriousHumorHits: Number(value.seriousHumorHits || 0),
    legalReasoningHits: Number(value.legalReasoningHits || 0),
    selfAwareHumorHits: Number(value.selfAwareHumorHits || 0),
    echoSectionHits: Number(value.echoSectionHits || 0),
  };
}

async function generateAIJudgment({ apiKey, settings = {}, prompt, image, profile }) {
  const configuredModel = cleanText(settings.geminiModel, 80);
  let lastEvaluation = {};
  let lastError = null;
  let bestCandidate = null;
  let usage = {};
  let attempts = 0;
  let modelName = DEFAULT_MODEL;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    attempts += 1;
    try {
      const attemptPrompt = attempt === 0
        ? prompt
        : `${prompt}${buildRewriteInstruction(profile, lastEvaluation)}`;
      const generated = await generateJson({
        apiKey,
        configuredModel,
        prompt: attemptPrompt,
        image,
        responseJsonSchema: JUDGMENT_JSON_SCHEMA,
        temperature: 1.02,
        topP: 0.97,
        maxOutputTokens: 9000,
      });
      modelName = generated.modelName;
      usage = addUsage(usage, generated.usage);
      const judgment = normalizeJudgment(extractJson(generated.text));
      if (!isCompleteJudgment(judgment)) {
        lastError = new Error('AI judgment did not satisfy the V2 field contract');
        continue;
      }

      lastEvaluation = evaluateStorySpecificity(judgment, profile);
      const candidate = {
        judgment,
        evaluation: lastEvaluation,
        score: evaluationScore(lastEvaluation),
        modelName,
      };
      if (!bestCandidate || candidate.score > bestCandidate.score) bestCandidate = candidate;
      if (lastEvaluation.passed) {
        return {
          judgment,
          evaluation: lastEvaluation,
          qualityPassed: true,
          attempts,
          usage,
          modelName,
        };
      }
      lastError = new Error(`AI judgment quality rewrite requested: ${JSON.stringify(qualitySummary(lastEvaluation))}`);
    } catch (error) {
      lastError = error;
    }
  }

  if (bestCandidate) {
    return {
      judgment: bestCandidate.judgment,
      evaluation: bestCandidate.evaluation,
      qualityPassed: false,
      attempts,
      usage,
      modelName: bestCandidate.modelName,
    };
  }

  const failure = lastError || new Error('AI judgment generation failed');
  failure.usage = usage;
  failure.attempts = attempts;
  throw failure;
}

module.exports = {
  DEFAULT_MODEL,
  JUDGMENT_JSON_SCHEMA,
  addUsage,
  evaluationScore,
  qualitySummary,
  generateAIJudgment,
};
