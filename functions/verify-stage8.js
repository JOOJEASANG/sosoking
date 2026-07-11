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
const judgmentRefinementCss = read('public/css/judgment-refinement.css');
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
  [index.includes('/css/judgment-refinement.css?v=20260711-judgment2') && index.includes('/js/judgment-refinement.js?v=20260711-judgment2'), 'Judgment refinement resources are not loaded'],
  [bottomNavJs.includes("'#/board'") && bottomNavJs.includes("'#/submit'") && bottomNavJs.includes("'#/my-cases'"), 'Bottom navigation routes are incomplete'],
  [bottomNavCss.includes('position:fixed') && bottomNavCss.includes('safe-area-inset-bottom') && bottomNavCss.includes('.bottom-nav-primary'), 'Bottom navigation styling is incomplete'],
  [judgmentRefinementJs.includes('판결문에서 건진 두 줄') && judgmentRefinementJs.includes('판결 근거 자세히 보기'), 'Concise judgment layout is incomplete'],
  [judgmentRefinementCss.includes('.judgment-detail-fold') && judgmentRefinementCss.includes('.comedy-grid'), 'Concise judgment styling is incomplete'],
  [productionJs.includes("window.addEventListener('offline'") && productionJs.includes("window.addEventListener('online'"), 'Connection handling is incomplete'],
  [productionJs.includes('unhandledrejection') && productionJs.includes('notifyUnexpectedError'), 'Unexpected error handling is incomplete'],
  [productionCss.includes('.connection-banner') && productionCss.includes('.is-offline'), 'Connection styling is incomplete'],
  [robots.includes('Sitemap: https://sosoking.co.kr/sitemap.xml'), 'Robots sitemap declaration is missing'],
  [sitemap.includes('<loc>https://sosoking.co.kr/</loc>'), 'Sitemap home URL is missing'],
  [health.status === 'ok'
    && health.service === 'sosoking-web'
    && /^2026\.07\.11-(stage8|editorial3)$/.test(health.version)
    && (!health.judgmentEngine || health.judgmentEngine === 'analysis-concepts-editor-v3'), 'Static health contract is invalid'],
  [globalCache.includes('no-cache') && globalCache.includes('must-revalidate'), 'SPA routes or static assets may remain stale after deployment'],
  [globalHeaderNames.has('X-Content-Type-Options') && globalHeaderNames.has('Referrer-Policy') && globalHeaderNames.has('Permissions-Policy') && globalHeaderNames.has('X-Frame-Options'), 'Security headers are incomplete'],
  [readme.includes('public_results/{caseId}') && readme.includes('공개 데이터 동기화'), 'Operations documentation is stale'],
  [!index.includes('GEMINI_API_KEY') && !productionJs.includes('GEMINI_API_KEY'), 'A server secret name leaked into the public application'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Stage 8 verification failed: ${message}`));
  process.exit(1);
}

console.log('Verified Stage 8 bottom navigation, concise judgments, SPA cache safety, security headers and recovery handling.');
