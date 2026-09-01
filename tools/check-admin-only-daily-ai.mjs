import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const daily = read('functions/daily.js');
for (const forbidden of [
  "firebase-functions/v2/scheduler",
  'onSchedule(',
  'exports.createDailyAiCase',
  "schedule: '0 9 * * *'"
]) {
  if (daily.includes(forbidden)) {
    errors.push(`functions/daily.js: automatic AI trigger remains: ${forbidden}`);
  }
}
for (const required of [
  'exports.generateDailyAiNow = onCall',
  'requireVerifiedUser(request)',
  'isAdminAuth(request.auth)',
  'return await createDailyAiCase(true);',
  '관리자 화면의 버튼이 호출하는 이 함수로만 실행한다.',
  'const configuredModel = cleanText(settings.geminiModel, 60);',
  'const modelNames = [...new Set([configuredModel, ...DEFAULT_MODELS].filter(Boolean))];'
]) {
  if (!daily.includes(required)) {
    errors.push(`functions/daily.js: administrator-only generation/model guard missing: ${required}`);
  }
}

for (const required of [
  'const RESPONSE_SCHEMA = {',
  "winner: { type: 'string' }",
  "'winner',",
  'function normalizeWinner(value, fallback = \'\')',
  'function buildPrompt(dateKey, judge, settings = {})',
  'function normalizeDailyContent(ai, dateKey, judge)',
  'function moderateDailyContent(data, dateKey, judge, settings = {})',
  'winner: normalizeWinner(ai?.winner, fallback.winner)',
  'winner: data.winner',
  "promptVersion: 'daily-document-v5-judge-winner'",
  'winner: 재판부 최종 승패를 반드시',
  "type: '꼰대형'",
  "type: '냉혈형'",
  "type: '회피형'",
  "type: '추궁형'",
  "type: '오버형'",
  "type: '드립형'",
  "type: '빙의형'",
  'reception:',
  'investigation:',
  'plaintiffArg:',
  'defendantArg:',
  'verdict:',
  'sentence:'
]) {
  if (!daily.includes(required)) {
    errors.push(`functions/daily.js: current AI result contract changed unexpectedly: ${required}`);
  }
}

const deploy = read('.github/workflows/firebase-deploy.yml');
if (deploy.includes('functions:createDailyAiCase')) {
  errors.push('.github/workflows/firebase-deploy.yml: obsolete automatic AI function is still deployed');
}
for (const required of [
  'functions:generateDailyAiNow',
  'Remove known obsolete Functions',
  'firebase functions:list --project sosoking-481e6 --json',
  'node tools/list-obsolete-deployed-functions.mjs',
  'firebase functions:delete'
]) {
  if (!deploy.includes(required)) {
    errors.push(`.github/workflows/firebase-deploy.yml: automatic schedule cleanup is incomplete: ${required}`);
  }
}

const obsoleteCleanup = read('tools/list-obsolete-deployed-functions.mjs');
for (const required of [
  "'createDailyAiCase'",
  'KNOWN_OBSOLETE_FUNCTIONS',
  'Unknown unmanaged Functions require review'
]) {
  if (!obsoleteCleanup.includes(required)) {
    errors.push(`tools/list-obsolete-deployed-functions.mjs: automatic schedule cleanup guard missing: ${required}`);
  }
}

const adminIndex = read('public/admin/index.html');
if (!adminIndex.includes('/admin/admin-manual-ai-mode.js?v=20260831-admin-ai-settings-save-fix-1')) {
  errors.push('public/admin/index.html: current administrator AI interface is not loaded');
}

const adminMode = read('public/admin/admin-manual-ai-mode.js');
for (const required of [
  "root.querySelector('#dailyOn')",
  'dailyToggle.checked = false;',
  'dailyToggle.disabled = true;',
  "toggleLabel.style.display = 'none';",
  '관리자 수동 AI 샘플 사건 생성',
  'AI 샘플 사건 수동 생성',
  '자동 예약 없음',
  '자동 예약 없음 · 관리자 버튼으로만 생성',
  '관리자가 버튼을 누른 경우에만 AI 샘플 사건을 생성',
  'const MANUAL_GENERATE_LABEL',
  'function setTextIfChanged(element, text)',
  "const aiCard = dailyToggle.closest('.card');",
  'if (scheduled) return;',
  'const observer = new MutationObserver(scheduleApply);',
  'const MODEL_OPTIONS = [',
  "value: 'gemini-2.5-flash'",
  "value: 'gemini-2.5-flash-lite'",
  "value: 'gemini-2.5-pro'",
  'function normalizeModelSelector(root)',
  "setTextIfChanged(group?.querySelector('.form-label'), 'AI 모델 선택');",
  "select.dataset.aiModelSelector = 'true';",
  'modelControl.replaceWith(select);',
  '현재 저장된 모델',
  '선택 모델 호출이 실패하면 서버의 기본 모델 순서로 자동 재시도합니다.'
]) {
  if (!adminMode.includes(required)) {
    errors.push(`public/admin/admin-manual-ai-mode.js: manual generation/model selector/save guard missing: ${required}`);
  }
}
if (adminMode.includes('toggleLabel?.remove()')) {
  errors.push('public/admin/admin-manual-ai-mode.js: hidden #dailyOn control is removed, which breaks the canonical settings save handler');
}
if (adminMode.includes("generateButton.textContent = 'AI 샘플 사건 수동 생성';")) {
  errors.push('public/admin/admin-manual-ai-mode.js: generate button text is rewritten unconditionally and can retrigger MutationObserver');
}

const admin = read('public/admin/admin.js');
for (const required of [
  "generateDaily: httpsCallable(functions, 'generateDailyAiNow')",
  "target.querySelector('#generate-daily-now')",
  "await callables.generateDaily({})",
  "dailyAiEnabled: target.querySelector('#dailyOn').checked",
  "target.querySelector('#model').value.trim() || 'gemini-2.5-flash'"
]) {
  if (!admin.includes(required)) {
    errors.push(`public/admin/admin.js: administrator generation/model save path missing: ${required}`);
  }
}

if (errors.length) {
  console.error(`Administrator-only daily AI validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Administrator-only AI validation passed: scheduled generation stays removed, generated daily verdicts include a structured winner, selectable Gemini models persist safely, and the deployed callable remains administrator-only.');
