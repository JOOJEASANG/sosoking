const { GoogleGenerativeAI } = require('@google/generative-ai');
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

const DEFAULT_MODEL = 'gemini-2.5-flash';

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
  const modelName = cleanText(settings.geminiModel, 60) || DEFAULT_MODEL;
  const model = new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 1.02,
      topP: 0.97,
      maxOutputTokens: 7000,
      responseMimeType: 'application/json',
    },
  });

  let lastEvaluation = {};
  let lastError = null;
  let bestCandidate = null;
  let usage = {};
  let attempts = 0;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    attempts += 1;
    try {
      const attemptPrompt = attempt === 0
        ? prompt
        : `${prompt}${buildRewriteInstruction(profile, lastEvaluation)}`;
      const parts = [{ text: attemptPrompt }];
      if (image) parts.push({ inlineData: image });
      const response = await model.generateContent({ contents: [{ role: 'user', parts }] });
      usage = addUsage(usage, response.response.usageMetadata || {});
      const judgment = normalizeJudgment(extractJson(response.response.text()));
      if (!isCompleteJudgment(judgment)) {
        lastError = new Error('AI judgment did not satisfy the V2 field contract');
        continue;
      }

      lastEvaluation = evaluateStorySpecificity(judgment, profile);
      const candidate = {
        judgment,
        evaluation: lastEvaluation,
        score: evaluationScore(lastEvaluation),
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

  // 완성된 AI 결과가 있으면 품질 점수가 가장 높은 것을 사용한다. 로컬 문구로 바꾸지 않는다.
  if (bestCandidate) {
    return {
      judgment: bestCandidate.judgment,
      evaluation: bestCandidate.evaluation,
      qualityPassed: false,
      attempts,
      usage,
      modelName,
    };
  }

  const failure = lastError || new Error('AI judgment generation failed');
  failure.usage = usage;
  failure.attempts = attempts;
  throw failure;
}

module.exports = {
  DEFAULT_MODEL,
  addUsage,
  evaluationScore,
  qualitySummary,
  generateAIJudgment,
};
