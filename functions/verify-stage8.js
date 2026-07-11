const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const index = read('public/index.html');
const productionJs = read('public/js/production-integration.js');
const productionCss = read('public/css/production.css');
const bottomNavJs = read('public/js/bottom-navigation.js');
const bottomNavCss = read('public/css/bottom-navigation.css');
const judgmentRefinementJs = read('public/js/judgment-refinement.js');
const roleTrialCss = read('public/css/role-trial.css');
const judgmentUi = read('public/js/judgment-ui.js');
const robots = read('public/robots.txt');
const sitemap = read('public/sitemap.xml');
const health = JSON.parse(read('public/health.json'));
const firebase = JSON.parse(read('firebase.json'));
const readme = read('README.md');

const headerRules = firebase.hosting?.headers || [];
const globalRule = headerRules.find(rule => rule.source === '**');
const globalHeaders = globalRule?.headers || [];
const globalCache = globalHeaders.find(item => item.key === 'Cache-Control')?.value || '';
const globalHeaderNames = new Set(globalHeaders.map(item => item.key));

const checks = [
  [index.includes('rel="canonical"') && index.includes('https://sosoking.co.kr/'), 'Canonical URL is missing'],
  [index.includes('property="og:url"') && index.includes('name="twitter:card"'), 'Social metadata is incomplete'],
  [index.includes('/css/production.css?v=20260711-stage8'), 'Production stylesheet is not loaded'],
  [index.includes('/js/production-integration.js?v=20260711-stage8'), 'Production integration is not loaded'],
  [index.includes('/css/bottom-navigation.css?v=20260711-bottomnav1') && index.includes('/js/bottom-navigation.js?v=20260711-bottomnav1'), 'Bottom navigation resources are not loaded'],
  [index.includes('/css/role-trial.css?v=20260711-rolev10'), 'Role trial stylesheet is not loaded'],
  [bottomNavJs.includes("'#/board'") && bottomNavJs.includes("'#/submit'") && bottomNavJs.includes("'#/my-cases'"), 'Bottom navigation routes are incomplete'],
  [bottomNavCss.includes('position:fixed') && bottomNavCss.includes('safe-area-inset-bottom') && bottomNavCss.includes('.bottom-nav-primary'), 'Bottom navigation styling is incomplete'],
  [judgmentRefinementJs.includes("shell.classList.contains('role-trial-document')"), 'Role trial document is not protected from concise-result rewriting'],
  [roleTrialCss.includes('.role-docket-cover') && roleTrialCss.includes('.fiction-notice') && roleTrialCss.includes('.role-sentence-section'), 'Role trial production styling is incomplete'],
  [judgmentUi.includes('가상 감식 주의') && judgmentUi.includes('실제 확인 결과가 아닙니다'), 'Fictional evidence disclosure is incomplete'],
  [productionJs.includes("window.addEventListener('offline'") && productionJs.includes("window.addEventListener('online'"), 'Connection handling is incomplete'],
  [productionJs.includes('unhandledrejection') && productionJs.includes('notifyUnexpectedError'), 'Unexpected error handling is incomplete'],
  [productionCss.includes('.connection-banner') && productionCss.includes('.is-offline'), 'Connection styling is incomplete'],
  [robots.includes('Sitemap: https://sosoking.co.kr/sitemap.xml'), 'Robots sitemap declaration is missing'],
  [sitemap.includes('<loc>https://sosoking.co.kr/</loc>'), 'Sitemap home URL is missing'],
  [health.status === 'ok'
    && health.service === 'sosoking-web'
    && health.version === '2026.07.11-rolev10'
    && health.judgmentEngine === 'role-based-trial-v10', 'Static health contract is invalid'],
  [globalCache.includes('no-cache') && globalCache.includes('must-revalidate'), 'SPA routes or static assets may remain stale after deployment'],
  [globalHeaderNames.has('X-Content-Type-Options') && globalHeaderNames.has('Referrer-Policy') && globalHeaderNames.has('Permissions-Policy') && globalHeaderNames.has('X-Frame-Options'), 'Security headers are incomplete'],
  [readme.includes('role-based-trial-v10') && readme.includes('가상 CCTV'), 'Operations documentation is stale'],
  [!index.includes('GEMINI_API_KEY') && !productionJs.includes('GEMINI_API_KEY'), 'A server secret name leaked into the public application'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Stage 8 verification failed: ${message}`));
  process.exit(1);
}

console.log('Verified Stage 8 role-based trial records, fictional evidence disclosure, bottom navigation, cache safety and security headers.');
