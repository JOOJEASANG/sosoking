import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const home = read('public/js/pages/home.js');
for (const phrase of [
  '소소한 일상을 판결하는 생활법정 놀이터',
  '오늘은 판결감입니다.',
  '실제 판례는 직접 판결해보세요.',
  'AI 생활판결과 실제 판례 맞히기'
]) {
  if (!home.includes(phrase)) errors.push(`public/js/pages/home.js: 메인 문구 누락: ${phrase}`);
}

const homeCourt = read('public/js/pages/home-court.js');
for (const phrase of [
  'async function applySubmissionLimit(container)',
  "doc(db, 'site_public', 'config')",
  'settings.dailyLimitEnabled === true',
  '현재 사건 접수 제한 없음',
  'data-home-daily-limit'
]) {
  if (!homeCourt.includes(phrase)) errors.push(`public/js/pages/home-court.js: 동적 접수 한도 문구 누락: ${phrase}`);
}

const guide = read('public/js/pages/guide.js');
for (const phrase of [
  '접수 횟수와 대기시간은 운영 설정에 따라 달라질 수 있으며',
  '현재 적용 중인 횟수는 사건 접수 화면에 표시됩니다.',
  '오늘의 실제 판례 3건 읽기',
  '매일 실제 법원 판례 3건',
  '실제 판단과 민심 비교하기',
  '세 사건을 완료하면 일간 랭킹',
  '매일 판례 3건이 제공되며',
  '검색엔진에 노출될 수 있으며',
  '개별 회원의 선택은 공개하지 않고'
]) {
  if (!guide.includes(phrase)) errors.push(`public/js/pages/guide.js: 이용 안내 누락: ${phrase}`);
}
for (const legacy of ['회원당 하루 1회입니다.', '매일 실제 법원 판례 한 건', '매일 한 사건이 제공되며']) {
  if (guide.includes(legacy)) errors.push(`public/js/pages/guide.js: 구버전 안내가 남아 있습니다: ${legacy}`);
}

const policy = read('public/js/pages/policy.js');
for (const phrase of [
  '오늘의 재판 이용',
  '검색엔진을 통해 노출',
  '개인정보 처리 및 보유 기간',
  '오늘의 재판 참여 정보',
  '개인정보의 제3자 제공',
  '처리위탁 및 국외 처리',
  'Firebase Authentication은 미국 데이터센터',
  '개인정보 파기 절차 및 방법',
  '이용자의 권리와 행사 방법',
  '자동 저장 기술과 브라우저 정보',
  '안전성 확보조치',
  '개인정보 보호 담당 및 문의',
  '생성형 AI 표시',
  '오늘의 재판은 실제 판례'
]) {
  if (!policy.includes(phrase)) errors.push(`public/js/pages/policy.js: 정책 고지 누락: ${phrase}`);
}
for (const type of ['terms', 'privacy', 'ai_disclaimer']) {
  if (!policy.includes(`type === '${type}'`)) errors.push(`public/js/pages/policy.js: ${type} 구버전 교체 기준 누락`);
}

const policyLimit = read('public/js/pages/policy-configurable-limit.js');
for (const phrase of [
  '접수 횟수와 재접수 대기시간은 서비스 화면에 표시된 현재 운영 설정을 따릅니다.',
  '제한을 해제하거나 계정당 일일 건수를 조절할 수 있습니다.',
  '매일 실제 판례 3건',
  '각 사건에 한 번씩',
  '일간·주간·누적 랭킹',
  'replaceLegacyLimitCopy',
  'replaceCurrentPolicyCopy',
  'OLD_DAILY_COPY',
  'NEW_DAILY_COPY',
  "getDoc(doc(db, 'policy_docs', 'terms'))"
]) {
  if (!policyLimit.includes(phrase)) errors.push(`public/js/pages/policy-configurable-limit.js: 최신 약관 문구 누락: ${phrase}`);
}

const index = read('public/index.html');
for (const phrase of [
  '소소한 일상을 판결하는 생활법정 놀이터',
  'AI 생활판결과 오늘의 재판'
]) {
  if (!index.includes(phrase)) errors.push(`public/index.html: 브랜드 메타정보 누락: ${phrase}`);
}
if (!/<script type="module" src="\/js\/app\.js\?v=[^"']+"><\/script>/.test(index)) {
  errors.push('public/index.html: versioned application entry is missing');
}

const app = read('public/js/app.js');
const homeCourtVersion = app.match(/\.\/pages\/home-court\.js\?v=([^'";]+)/)?.[1] || '';
if (!homeCourtVersion) {
  errors.push('public/js/app.js: versioned home-court module is missing');
}
for (const moduleUrl of [
  './pages/home-court.js?v=20260730-configurable-limit-1',
  './pages/submit-guard.js?v=20260730-configurable-limit-1',
  './pages/policy-configurable-limit.js?v=20260730-final-audit-1',
  './pages/guide.js?v=20260730-final-audit-1',
  './components/footer.js?v=20260729-brand-policy-1'
]) {
  if (!app.includes(moduleUrl)) errors.push(`public/js/app.js: 최신 문구·한도 모듈 버전 누락: ${moduleUrl}`);
}
if (!homeCourt.includes("./home.js?v=20260729-brand-policy-1")) {
  errors.push('public/js/pages/home-court.js: 메인 문구 모듈 버전 누락');
}

const footer = read('public/js/components/footer.js');
if (!footer.includes('AI 생활판결 · 실제 판례 게임 · 법적 효력 없음')) {
  errors.push('public/js/components/footer.js: 서비스 구성 안내 누락');
}

const sw = read('public/sw.js');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!appVersion || !sw.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html 및 public/sw.js의 앱 버전이 일치하지 않음');
}
if (!homeCourtVersion || !sw.includes(`/js/pages/home-court.js?v=${homeCourtVersion}`)) {
  errors.push('public/js/app.js 및 public/sw.js의 홈 모듈 버전이 일치하지 않음');
}
for (const asset of [
  '/js/pages/home.js?v=20260729-brand-policy-1',
  '/js/pages/guide.js?v=20260730-final-audit-1',
  '/js/pages/policy.js?v=20260730-final-audit-1',
  '/js/pages/policy-configurable-limit.js?v=20260730-final-audit-1',
  '/js/pages/submit-guard.js?v=20260730-configurable-limit-1',
  '/js/pages/submit-court.js?v=20260730-configurable-limit-1',
  '/js/pages/submit.js?v=20260730-configurable-limit-1',
  '/js/components/footer.js?v=20260729-brand-policy-1'
]) {
  if (!sw.includes(asset)) errors.push(`public/sw.js: 최신 정책·한도 자산 캐시 누락: ${asset}`);
}

const packageJson = read('package.json');
if (!packageJson.includes('node tools/check-brand-policy-copy.mjs')) {
  errors.push('package.json: 브랜드·정책 회귀검사가 검사 체인에 없음');
}

if (errors.length) {
  console.error(`Brand and policy copy validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Brand and policy copy validation passed: dynamic submission limits, three-case real-court guidance, privacy disclosures, AI notice, and synchronized cache versions.');
