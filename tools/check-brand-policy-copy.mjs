import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const requireText = (source, phrase, label) => {
  if (!source.includes(phrase)) errors.push(`${label}: missing ${phrase}`);
};

const home = read('public/js/pages/home.js');
for (const phrase of [
  "doc(db, 'site_public', 'config')",
  'settings.dailyLimitEnabled === true',
  '현재 사건 접수 제한 없음',
  'data-home-daily-limit',
  '담당 판사는 사건마다 자동 배정',
  '7명의 AI 판사',
  '최근 공개 사건 5건',
  '판결은 가린 채 공개용 사건 기록만 미리 보여드립니다.',
  '비공개 접수 → 내 예상 판정 → AI 판결'
]) requireText(home, phrase, 'public/js/pages/home.js');
for (const removed of ['최근 공개 판결 5건', '판결문 보기 →', '실제 판례는 직접 판결해보세요.', 'AI 생활판결과 실제 판례 맞히기', '운명에 맡기기']) {
  if (home.includes(removed)) errors.push(`public/js/pages/home.js: removed or spoiler copy remains: ${removed}`);
}

const guide = read('public/js/pages/guide.js');
for (const phrase of [
  '접수 횟수와 재접수 대기시간은 현재 운영 설정에 따라 달라질 수 있으며',
  '현재 적용 중인 횟수와 재접수 대기시간은 사건 접수 화면에 표시됩니다.',
  '꼰대형·냉혈형·회피형·추궁형·오버형·드립형·빙의형',
  '내 예상 판정 후 판결 봉인 해제',
  '원하면 판결기록에 공개',
  '원고·피고·쌍방 중 먼저 판정',
  '판결과 내 판단 비교·토론',
  '검색엔진에 노출될 수 있으며',
  '개별 회원이 어느 선택을 했는지는 공개 목록에 표시하지 않고'
]) requireText(guide, phrase, 'public/js/pages/guide.js');
for (const removed of ['오늘의 실제 판례', '매일 실제 법원 판례', '일간·주간·누적 랭킹']) {
  if (guide.includes(removed)) errors.push(`public/js/pages/guide.js: removed feature copy remains: ${removed}`);
}

const policy = read('public/js/pages/policy.js');
for (const phrase of [
  '접수 횟수와 재접수 대기시간은 서비스 화면에 표시된 현재 운영 설정을 따르며',
  '작성자가 처음 입력한 접수 원문은 작성자 본인에게만',
  '공개용 사건 정보, 공개용 닉네임',
  '원고 승·피고 승·쌍방 과실 중 최초 1회 예상 판정',
  "getDoc(doc(db, 'policy_docs', safeType))",
  'const OBSOLETE_SIGNATURES = {'
]) requireText(policy, phrase, 'public/js/pages/policy.js');
for (const removed of ['NEW_DAILY_COPY', 'OLD_DAILY_COPY', 'NEW_DAILY_STATS_COPY']) {
  if (policy.includes(removed)) errors.push(`public/js/pages/policy.js: obsolete replacement helper remains: ${removed}`);
}
const defaultPolicyBlock = policy.split('export const DEFAULT_POLICIES = {')[1]?.split('\n};\n\nconst OBSOLETE_SIGNATURES')[0] || '';
for (const removed of ['오늘의 실제 판례', '매일 실제 법원 판례', '실제 판례 맞히기', '오늘의 재판 판결 제출']) {
  if (defaultPolicyBlock.includes(removed)) errors.push(`public/js/pages/policy.js: obsolete feature appears in current default policy: ${removed}`);
}

const index = read('public/index.html');
for (const phrase of [
  '소소한 일상을 판결하는 AI 생활법정',
  '민심소의 블라인드 투표와 토론'
]) requireText(index, phrase, 'public/index.html');
for (const removed of ['오늘의 재판', '/js/home-copy-guard.js', '/js/judge-final-guard.js', '/js/judge-runtime-guard.js']) {
  if (index.includes(removed)) errors.push(`public/index.html: removed feature/runtime patch remains: ${removed}`);
}
if (!/<script type="module" src="\/js\/app\.js\?v=[^"']+"><\/script>/.test(index)) {
  errors.push('public/index.html: versioned application entry is missing');
}

const app = read('public/js/app.js');
for (const moduleUrl of [
  './pages/home.js?v=20260830-final-blind-1',
  './pages/submit.js?v=20260830-final-audit-1',
  './pages/policy.js?v=20260830-final-audit-1',
  './pages/guide.js?v=20260830-final-audit-1',
  './components/footer.js?v=20260729-brand-policy-1',
  './components/nav.js?v=20260829-arena-1'
]) requireText(app, moduleUrl, 'public/js/app.js');
if (app.includes('renderDailyRealCourt') || app.includes('#/daily-court') || app.includes('daily-real-court.js')) {
  errors.push('public/js/app.js: removed feature route remains');
}
for (const retired of ['home-seven-judges.js', 'home-court.js', 'submit-guard.js', 'policy-configurable-limit.js']) {
  if (app.includes(retired)) errors.push(`public/js/app.js: retired wrapper remains: ${retired}`);
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
  '/js/pages/home.js?v=20260830-final-blind-1',
  '/js/pages/guide.js?v=20260830-final-audit-1',
  '/js/pages/policy.js?v=20260830-final-audit-1',
  '/js/pages/submit.js?v=20260830-final-audit-1',
  '/js/components/footer.js?v=20260729-brand-policy-1',
  '/js/components/nav.js?v=20260829-arena-1'
]) requireText(sw, asset, 'public/sw.js');
for (const retired of ['home-copy-guard.js', 'home-seven-judges.js', 'home-court.js', 'policy-configurable-limit.js', 'submit-guard.js', 'submit-court.js', 'judge-final-guard.js', 'judge-runtime-guard.js']) {
  if (sw.includes(retired)) errors.push(`public/sw.js: retired asset remains: ${retired}`);
}
if (sw.includes('daily-real-court.js') || sw.includes("'/daily-court'")) {
  errors.push('public/sw.js: removed daily-court assets remain');
}

const packageJson = read('package.json');
requireText(packageJson, 'node tools/check-brand-policy-copy.mjs', 'package.json');

if (errors.length) {
  console.error(`Brand and policy copy validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Brand and policy copy validation passed: current seven-judge flow, blind home entry, owner prediction, configurable limits, private-original disclosure, public participation, legacy-policy detection, and synchronized cache versions.');
