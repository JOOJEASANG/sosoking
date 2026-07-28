import fs from 'node:fs';

const path = 'functions/generate-trial-lite.js';
let source = fs.readFileSync(path, 'utf8');

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Patch target missing: ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`Patch target is not unique: ${label}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  "  const totals = { requests: 0, inputTokens: 0, outputTokens: 0 };\n\n  let data = null;\n  let usedModel = '';\n  let lastError = null;\n\n  for (let attempt = 0; attempt < modelNames.length; attempt += 1) {",
  "  const totals = { attempts: 0, successfulResponses: 0, inputTokens: 0, outputTokens: 0 };\n\n  let data = null;\n  let usedModel = '';\n  let lastError = null;\n  let quotaAvailable = true;\n  let saved = false;\n\n  // 사용자·전체 일일 한도는 모델 재시도 횟수가 아니라 재판 요청 1건당 한 번만 예약한다.\n  try {\n    await reserveAiRequest(uid, 'trial', settings);\n  } catch (err) {\n    quotaAvailable = false;\n    lastError = err;\n    console.warn('generateTrial AI quota reservation failed; using local fallback:', safeErrorCode(err));\n  }\n\n  for (let attempt = 0; quotaAvailable && attempt < modelNames.length; attempt += 1) {",
  'operation-level quota reservation'
);

replaceOnce(
  "    try {\n      await reserveAiRequest(uid, 'trial', settings);\n      const response = await callGemini(apiKey, modelName, buildPrompt(description, judge, grievanceIndex, attempt > 0));\n      totals.requests += 1;\n      totals.inputTokens += Number(response.usageMetadata.promptTokenCount || 0);",
  "    try {\n      totals.attempts += 1;\n      const response = await callGemini(apiKey, modelName, buildPrompt(description, judge, grievanceIndex, attempt > 0));\n      totals.successfulResponses += 1;\n      totals.inputTokens += Number(response.usageMetadata.promptTokenCount || 0);",
  'attempt accounting'
);

replaceOnce(
  "  const fallbackCode = data ? '' : safeErrorCode(lastError);\n  if (!data) data = buildLocalFallback(description, judge, grievanceIndex, fallbackCode);\n  const finalTitle = normalizeCaseTitle(data.caseTitle, description);\n  const aiSource = usedModel ? 'gemini-rest' : 'local-case-fallback';",
  "  let fallbackCode = data ? '' : safeErrorCode(lastError);\n  if (!data) data = buildLocalFallback(description, judge, grievanceIndex, fallbackCode);\n\n  // 모델 출력도 공개·저장 전에 다시 검사한다. 문제가 있으면 검증 가능한 로컬 판결로 대체한다.\n  const generatedSafety = inspectContent([\n    data.caseTitle,\n    data.reception,\n    data.investigation,\n    data.plaintiffArg,\n    data.defendantArg,\n    data.verdict\n  ].filter(Boolean).join('\\n'));\n  if (!generatedSafety.safe) {\n    fallbackCode = `UNSAFE_AI_OUTPUT_${String(generatedSafety.code || 'UNKNOWN').toUpperCase().replace(/[^A-Z0-9]+/g, '_')}`;\n    data = buildLocalFallback(description, judge, grievanceIndex, fallbackCode);\n    usedModel = '';\n  }\n\n  const finalTitle = normalizeCaseTitle(data.caseTitle, description);\n  const aiSource = usedModel ? 'gemini-rest' : 'local-case-fallback';",
  'post-generation safety moderation'
);

replaceOnce(
  "      promptVersion: 'simple-document-v1.4-judge-layout',\n      reactionTotal: 0,",
  "      promptVersion: 'simple-document-v1.5-accounting-safety',\n      contentSafetyStatus: 'passed',\n      contentSafetyCheckedAt: FieldValue.serverTimestamp(),\n      reactionTotal: 0,",
  'result safety metadata'
);

replaceOnce(
  "    await batch.commit();\n  } catch (err) {",
  "    await batch.commit();\n    saved = true;\n  } catch (err) {",
  'successful save tracking'
);

replaceOnce(
  "        geminiRequests: FieldValue.increment(totals.requests),\n        geminiInputTokens: FieldValue.increment(totals.inputTokens),\n        geminiOutputTokens: FieldValue.increment(totals.outputTokens),\n        caseCount: FieldValue.increment(1),\n        fallbackCount: FieldValue.increment(usedModel ? 0 : 1),",
  "        // 실제 외부 API 호출 시도는 실패 응답도 포함한다.\n        geminiRequests: FieldValue.increment(totals.attempts),\n        geminiSuccessfulResponses: FieldValue.increment(totals.successfulResponses),\n        geminiInputTokens: FieldValue.increment(totals.inputTokens),\n        geminiOutputTokens: FieldValue.increment(totals.outputTokens),\n        caseCount: FieldValue.increment(saved ? 1 : 0),\n        fallbackCount: FieldValue.increment(saved && !usedModel ? 1 : 0),",
  'accurate usage statistics'
);

if (source.includes("await reserveAiRequest(uid, 'trial', settings);\n      const response")) {
  throw new Error('Per-attempt quota reservation remains');
}
if (!source.includes("for (let attempt = 0; quotaAvailable && attempt < modelNames.length")) {
  throw new Error('Operation-level retry guard missing');
}

fs.writeFileSync(path, source);
console.log('Patched generate-trial-lite.js for operation-level quota and accurate usage accounting.');
