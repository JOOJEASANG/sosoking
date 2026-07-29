import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const home = read('public/js/pages/home.js');
for (const phrase of [
  '소소한 일상을 판결하는 생활법정 놀이터',
  '오늘은 판결감입니다.',
  '실제 판례는 직접 판결해보세요.',
  '회원당 하루 1회',
  'AI 생활판결과 실제 판례 맞히기'
]) {
  if (!home.includes(phrase)) errors.push(`public/js/pages/home.js: 메인 문구 누락: ${phrase}`);
}

const guide = read('public/js/pages/guide.js');
for (const phrase of [
  '회원당 하루 1회입니다.',
  '오늘의 실제 판례 읽기',
  '실제 판단과 민심 비교하기',
  '검색엔진에 노출될 수 있으며',
  '개별 회원의 선택은 공개하지 않고'
]) {
  if (!guide.includes(phrase)) errors.push(`public/js/pages/guide.js: 이용 안내 누락: ${phrase}`);
}

const policy = read('public/js/pages/policy.js');
for (const phrase of [
  '계정당 하루 1회',
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
const homeCourt = read('public/js/pages/home-court.js');
for (const moduleUrl of [
  './pages/home-court.js?v=20260729-brand-policy-1',
  './pages/policy.js?v=20260729-brand-policy-1',
  './pages/guide.js?v=20260729-brand-policy-1',
  './components/footer.js?v=20260729-brand-policy-1'
]) {
  if (!app.includes(moduleUrl)) errors.push(`public/js/app.js: 새 문구 모듈 버전 누락: ${moduleUrl}`);
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
for (const asset of [
  '/js/pages/home-court.js?v=20260729-brand-policy-1',
  '/js/pages/home.js?v=20260729-brand-policy-1',
  '/js/pages/guide.js?v=20260729-brand-policy-1',
  '/js/pages/policy.js?v=20260729-brand-policy-1',
  '/js/components/footer.js?v=20260729-brand-policy-1'
]) {
  if (!sw.includes(asset)) errors.push(`public/sw.js: 새 정책·문구 자산 캐시 누락: ${asset}`);
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

console.log('Brand and policy copy validation passed: main message, daily limits, real-case game, privacy disclosures, AI notice, and cache versions.');
