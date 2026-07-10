const fs = require('node:fs');
const path = require('node:path');

function read(relativePath) {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');
}

const daily = read('./daily.js');
const generator = read('./generate-trial-v2.js');
const judgment = read('./judgment-v2.js');
const story = [
  read('./judgment-story-v2.js'),
  read('./judgment-story-config.js'),
  read('./judgment-story-writer.js'),
  read('./judgment-story-quality.js'),
].join('\n');
const trial = read('../public/js/pages/trial.js');
const home = read('../public/js/pages/home.js');
const app = read('../public/js/app.js');
const resultWrapper = read('../public/js/pages/result-case-story.js');
const index = read('../public/index.html');

const checks = [
  [daily.includes('function isCompleteDailyPayload'), 'Daily AI full-payload validator is missing'],
  [daily.includes('isCompleteDailyPayload(parsed)'), 'Daily AI raw JSON is not validated before acceptance'],
  [daily.includes('cleanText(value.caseTitle') && daily.includes('JUDGES.includes(value.judgeType)'), 'Daily AI top-level metadata validation is incomplete'],
  [daily.includes('await db.runTransaction'), 'Daily regeneration must use a transaction'],
  [daily.includes('transaction.get(reactionRef)') && daily.includes('transaction.get(commentRef)'), 'Daily regeneration must read live reaction and comment counters'],
  [daily.includes('LEGACY_RESULT_FIELDS') && daily.includes('FieldValue.delete()'), 'Daily V2 repair must remove legacy narrative fields'],
  [generator.includes('buildStoryPrompt(profile)'), 'User judgments must use the case-specific writing prompt'],
  [generator.includes('evaluateStorySpecificity') && generator.includes('buildRewriteInstruction'), 'Generic AI judgments must be rejected and rewritten'],
  [generator.includes('function addUsage') && generator.includes('usage = addUsage(usage'), 'Gemini usage must accumulate across rewrite attempts'],
  [generator.includes('failure.usage = usage') && generator.includes('usage = error.usage || usage'), 'Failed rewrite attempts must still report their token usage'],
  [generator.includes("generationMode: aiGenerated ? 'gemini-case-story-v1' : 'local-case-story-v1'"), 'Case-story generation mode must be recorded'],
  [judgment.includes('incidentLevel: cleanText') && judgment.includes('breakingNews: cleanParagraph'), 'Judgment normalization must preserve emergency metadata'],
  [judgment.includes('emergencyBriefing: cleanParagraph') && judgment.includes('impactAssessment: cleanParagraph'), 'Judgment normalization must preserve detailed emergency sections'],
  [story.includes('진지함 60%') && story.includes('과몰입 개그 40%'), 'Emergency-comedy writing ratio is missing'],
  [story.includes('웃음 구조는 세 번') && story.includes('국가적 비상은 아니지만'), 'Three-beat humor and no-retreat escalation rules are missing'],
  [trial.includes('Number(data.schemaVersion) === 2') && trial.includes('judgment.orders'), 'Trial page must recognize completed V2 judgments'],
  [trial.includes('if (isCompleteResult(data))'), 'Trial page must redirect when a V2 judgment completes'],
  [home.includes('result.judgment?.headline') && home.includes('result.judgment?.summary'), 'Home feed must display V2 judgment metadata'],
  [home.includes('result.judgment?.facts') && home.includes('resultSearchText'), 'Home search must include V2 judgment content'],
  [app.includes("result-case-story.js?v=20260710-emergency-comedy1"), 'App must load the emergency-comedy result wrapper'],
  [resultWrapper.includes('judgment.breakingNews') && resultWrapper.includes('judgment.emergencyBriefing'), 'Result pages must load emergency judgment sections'],
  [resultWrapper.includes('소소킹 긴급사건 특보') && resultWrapper.includes('방치 시 예상 파급효과'), 'Result pages must visibly render the emergency briefing'],
  [resultWrapper.includes('result.caseDescription') && resultWrapper.includes('original-case-card'), 'Result pages must show the original submitted case content'],
  [index.includes('/js/app.js?v=20260710-emergency-comedy1'), 'Index must bust the cached app entry for emergency-comedy judgments'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Judgment V2 integration failed: ${message}`));
  process.exit(1);
}

console.log('Verified detailed emergency comedy, rewrite usage accounting, original-case display and app cache integration.');
