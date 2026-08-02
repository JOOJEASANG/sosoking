import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const requireText = (source, phrase, label) => {
  if (!source.includes(phrase)) errors.push(`${label}: missing ${phrase}`);
};

const homeCourt = read('public/js/pages/home-court.js');
for (const phrase of [
  'async function applySubmissionLimit(container)',
  "doc(db, 'site_public', 'config')",
  'settings.dailyLimitEnabled === true',
  '현재 사건 접수 제한 없음',
  'data-home-daily-limit',
  '공개 판결은 투표와 토론으로 함께 즐겨보세요.',
  '판결기록 참여'
]) requireText(homeCourt, phrase, 'public/js/pages/home-court.js');

const homeEntry = read('public/js/pages/home-seven-judges.js');
for (const phrase of [
  '공개 판결은 투표와 토론으로 함께 즐겨보세요.',
  'AI 생활판결과 공개 판결의 투표·토론'
]) requireText(homeEntry, phrase, 'public/js/pages/home-seven-judges.js');

const guide = read('public/js/pages/guide.js');
for (const phrase of [
  '접수 횟수와 대기시간은 운영 설정에 따라 달라질 수 있으며',
  '현재 적용 중인 횟수는 사건 접수 화면에 표시됩니다.',
  '판결기록 참여',
  '선택형 투표 참여',
  '토론에서 의견 나누기',
  '검색엔진에 노출될 수 있으며',
  '개별 회원의 선택은 공개하지 않고'
]) requireText(guide, phrase, 'public/js/pages/guide.js');
for (const removed of ['오늘의 실제 판례', '매일 실제 법원 판례', '일간·주간·누적 랭킹']) {
  if (guide.includes(removed)) errors.push(`public/js/pages/guide.js: removed daily-court copy remains: ${removed}`);
}

const policyLimit = read('public/js/pages/policy-configurable-limit.js');
for (const phrase of [
  '접수 횟수와 재접수 대기시간은 서비스 화면에 표시된 현재 운영 설정을 따릅니다.',
  'removeDailyCourtCopy',
  "getDoc(doc(db, 'policy_docs', type))",
  'removedLinePatterns'
]) requireText(policyLimit, phrase, 'public/js/pages/policy-configurable-limit.js');
for (const removed of ['NEW_DAILY_COPY', 'OLD_DAILY_COPY', 'NEW_DAILY_STATS_COPY']) {
  if (policyLimit.includes(removed)) errors.push(`public/js/pages/policy-configurable-limit.js: obsolete daily-court replacement remains: ${removed}`);
}

const index = read('public/index.html');
for (const phrase of [
  '소소한 일상을 판결하는 생활법정 놀이터',
  '공개 판결의 투표와 토론'
]) requireText(index, phrase, 'public/index.html');
if (index.includes('오늘의 재판')) errors.push('public/index.html: removed daily-court metadata remains');
if (!/<script type="module" src="\/js\/app\.js\?v=[^"']+"><\/script>/.test(index)) {
  errors.push('public/index.html: versioned application entry is missing');
}

const app = read('public/js/app.js');
for (const moduleUrl of [
  './pages/home-seven-judges.js?v=20260730-home-layout-route-1',
  './pages/submit-guard.js?v=20260731-private-first-publication-1',
  './pages/policy-configurable-limit.js?v=20260730-final-audit-1',
  './pages/guide.js?v=20260802-remove-daily-court-1',
  './components/footer.js?v=20260729-brand-policy-1',
  './components/nav.js?v=20260802-remove-daily-court-1'
]) requireText(app, moduleUrl, 'public/js/app.js');
if (app.includes('daily-court') || app.includes('daily-real-court')) {
  errors.push('public/js/app.js: removed daily-court route remains');
}

const footer = read('public/js/components/footer.js');
requireText(footer, 'AI 생활판결 · 공개 판결 투표·토론 · 법적 효력 없음', 'public/js/components/footer.js');
if (footer.includes('실제 판례 게임')) errors.push('public/js/components/footer.js: removed game copy remains');

const sw = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !sw.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: application versions differ');
}
if (!sw.includes(`const CACHE_NAME = 'sosoking-app-v${appVersion}';`)) {
  errors.push('public/index.html and public/sw.js: cache name differs from application version');
}
for (const asset of [
  '/js/pages/home.js?v=20260729-brand-policy-1',
  '/js/pages/guide.js?v=20260802-remove-daily-court-1',
  '/js/pages/policy.js?v=20260730-final-audit-1',
  '/js/pages/policy-configurable-limit.js?v=20260730-final-audit-1',
  '/js/pages/submit-guard.js?v=20260731-private-first-publication-1',
  '/js/pages/submit-court.js?v=20260731-private-first-publication-1',
  '/js/pages/submit.js?v=20260730-configurable-limit-1',
  '/js/components/footer.js?v=20260729-brand-policy-1',
  '/js/components/nav.js?v=20260802-remove-daily-court-1'
]) requireText(sw, asset, 'public/sw.js');
if (sw.includes('daily-real-court')) errors.push('public/sw.js: removed daily-court assets remain');

const packageJson = read('package.json');
requireText(packageJson, 'node tools/check-brand-policy-copy.mjs', 'package.json');

if (errors.length) {
  console.error(`Brand and policy copy validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Brand and policy copy validation passed: current submission limits, public verdict participation, cleaned policy output, and synchronized cache versions.');
