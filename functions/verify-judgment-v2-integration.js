const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

const daily = read('./daily.js');
const main = read('./main.js');
const aiGenerator = read('./generate-trial-ai-first.js');
const aiEngine = read('./ai-judgment-engine.js');
const judgment = read('./judgment-v2.js');
const story = [
  read('./judgment-story-v2.js'),
  read('./judgment-story-config.js'),
  read('./judgment-story-writer.js'),
  read('./judgment-story-quality.js'),
].join('\n');
const trial = read('../public/js/pages/trial.js');
const trialGame = read('../public/js/pages/trial-game.js');
const home = read('../public/js/pages/home.js');
const app = read('../public/js/app.js');
const resultWrapper = read('../public/js/pages/result-case-story.js');
const resultAI = read('../public/js/pages/result-ai-first.js');
const index = read('../public/index.html');
const readability = read('../public/css/site-readability.css');

const checks = [
  [daily.includes('function isCompleteDailyPayload'), 'Daily AI full-payload validator is missing'],
  [daily.includes('isCompleteDailyPayload(parsed)'), 'Daily AI raw JSON is not validated before acceptance'],
  [daily.includes('cleanText(value.caseTitle') && daily.includes('JUDGES.includes(value.judgeType)'), 'Daily AI top-level metadata validation is incomplete'],
  [daily.includes('await db.runTransaction'), 'Daily regeneration must use a transaction'],
  [daily.includes('transaction.get(reactionRef)') && daily.includes('transaction.get(commentRef)'), 'Daily regeneration must read live reaction and comment counters'],
  [daily.includes('LEGACY_RESULT_FIELDS') && daily.includes('FieldValue.delete()'), 'Daily V2 repair must remove legacy narrative fields'],
  [main.includes("require('./generate-trial-ai-first')") && !main.includes("require('./generate-trial-v2')"), 'The deployed generateTrial export must use only the AI-first generator'],
  [aiGenerator.includes('buildStoryPrompt(profile)') && aiGenerator.includes('generateAIJudgment'), 'User judgments must call the case-specific AI writing engine'],
  [aiGenerator.includes('completeAIResult') && aiGenerator.includes("data.aiGenerated === true"), 'Existing local fallback results must not block AI regeneration'],
  [aiGenerator.includes('local fallback was not saved') && !aiGenerator.includes('buildStoryFallback'), 'AI failures must not be silently replaced by local judgment text'],
  [aiGenerator.includes("generationMode: 'gemini-error'") && aiGenerator.includes("throw new HttpsError('unavailable'"), 'AI failures must stay retryable and visible'],
  [aiEngine.includes('bestCandidate') && aiEngine.includes('qualityPassed: false'), 'The best complete AI candidate must survive strict quality retries'],
  [aiEngine.includes('function addUsage') && aiEngine.includes('usage = addUsage(usage'), 'Gemini usage must accumulate across rewrite attempts'],
  [aiEngine.includes('failure.usage = usage') && aiGenerator.includes('usage = error.usage || usage'), 'Failed AI attempts must still report their token usage'],
  [judgment.includes('incidentLevel: cleanText') && judgment.includes('breakingNews: cleanParagraph'), 'Judgment normalization must preserve emergency metadata'],
  [judgment.includes('emergencyBriefing: cleanParagraph') && judgment.includes('impactAssessment: cleanParagraph'), 'Judgment normalization must preserve detailed emergency sections'],
  [judgment.includes('plaintiffClaim: cleanParagraph') && judgment.includes('defendantClaim: cleanParagraph'), 'Judgment normalization must preserve quick opposing claims'],
  [story.includes('진지함 55%') && story.includes('자유로운 해석과 정색한 과몰입 개그 45%'), 'Interpretive comedy writing ratio is missing'],
  [story.includes('원문은 사실 확인용 자료') && story.includes('4개 단어 이상 연속된 표현을 복사하지 마라'), 'Source-copy prevention rules are missing'],
  [story.includes('mainAnchorMentions <= 10') && story.includes('copiedPhraseHits <= 7'), 'Low-repetition quality gates are missing'],
  [story.includes('"plaintiffClaim"') && story.includes('"defendantClaim"'), 'AI story prompt must request opposing quick claims'],
  [trial.includes('Number(data.schemaVersion) === 2') && trial.includes('judgment.orders'), 'Trial page must recognize completed V2 judgments'],
  [trial.includes('if (isCompleteResult(data))'), 'Trial page must redirect when a V2 judgment completes'],
  [trialGame.includes('THEATER_STAGES') && trialGame.includes('renderMiniClaims'), 'Trial wrapper must stage the full process and reveal quick claims'],
  [home.includes('result.judgment?.headline') && home.includes('result.judgment?.summary'), 'Home feed must display V2 judgment metadata'],
  [home.includes('result.judgment?.plaintiffClaim') && home.includes('result.judgment?.defendantClaim'), 'Home search must include quick claims'],
  [home.includes('사건 접수부터 선고까지 6단계'), 'Home must explain the full court process'],
  [app.includes('result-ai-first.js?v=20260717-ai1'), 'App must load the AI-source-aware result wrapper'],
  [resultWrapper.includes('judgment.breakingNews') && resultWrapper.includes('judgment.emergencyBriefing'), 'Result pages must load emergency judgment sections'],
  [resultWrapper.includes('judgment.plaintiffClaim') && resultWrapper.includes('judgment.defendantClaim'), 'Result pages must load quick opposing claims'],
  [resultWrapper.includes('claim-showdown') && resultWrapper.includes('같은 사건, 다른 해석'), 'Result pages must visibly render independent claim interpretations'],
  [resultWrapper.includes('<details class="result-card original-case-card">') && resultWrapper.includes('접수 원문은 판결과 분리'), 'Submitted source text must remain collapsed and separate from the judgment'],
  [resultAI.includes('Gemini AI 개별 판결') && resultAI.includes('Gemini AI로 다시 판결받기'), 'Result pages must identify AI output and offer local-result regeneration'],
  [resultAI.includes("httpsCallable(functions, 'generateTrial')") && resultAI.includes('result.aiGenerated === true'), 'AI regeneration must use the secured callable and stored source flag'],
  [resultWrapper.includes('--alert-title') && resultWrapper.includes('var(--ui-text-main'), 'Runtime result styles must use theme-aware text variables'],
  [resultWrapper.includes('setCaseVisibility') && resultWrapper.includes('reportResult'), 'Result actions must use secured publishing and reporting Functions'],
  [readability.includes('html[data-theme="light"] body #page-content') && readability.includes('--readable-body'), 'Final light-mode readability guard is missing'],
  [index.includes('/css/site-readability.css?v=20260711-interpret1'), 'Index must load the final readability guard'],
  [index.includes('/js/app.js?v=20260717-ai1'), 'Index must bust the AI-first application cache'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Judgment V2 integration failed: ${message}`));
  process.exit(1);
}

console.log('Verified AI-first judgments, transparent generation source, staged trial and result regeneration.');
