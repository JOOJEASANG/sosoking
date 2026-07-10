const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');
const exists = relative => fs.existsSync(path.join(root, relative));

const index = read('public/index.html');
const app = read('public/js/app.js');
const home = read('public/js/pages/home.js');
const guide = read('public/js/pages/guide.js');
const policy = read('public/js/pages/policy.js');
const defaults = read('public/js/data/default-policy-docs.js');
const footer = read('public/js/components/footer.js');
const submitCourt = read('public/js/pages/submit-court.js');
const privacyDefault = read('public/js/components/submit-privacy-default.js');
const trial = read('public/js/pages/trial-game.js');
const result = read('public/js/pages/result-case-story.js');
const theme = read('public/js/components/theme.js');
const courtDesign = read('public/js/components/court-design.js');
const siteSystem = read('public/css/site-system.css');
const readability = read('public/css/site-readability.css');
const judgment = read('functions/judgment-v2.js');
const writer = read('functions/judgment-story-writer.js');
const quality = read('functions/judgment-story-quality.js');

const removedThemeFiles = [
  'public/css/home-light-fix.css',
  'public/css/theme-contrast-fix.css',
  'public/css/theme-mode-polish.css',
  'public/css/theme-targeted-fixes.css',
  'public/css/home-hero-light-contrast.css',
  'public/css/light-mode-complete-contrast.css',
  'public/css/home-stats-cta-polish.css',
  'public/css/submit-light-fix.css',
  'public/js/components/contrast-fix.js',
];

const checks = [
  [index.includes('/css/site-system.css?v=20260710-full-audit1'), 'Index must load the unified site design system'],
  [index.includes('/css/site-readability.css?v=20260711-interpret1'), 'Index must load the final light-mode readability guard'],
  [removedThemeFiles.every(file => !exists(file)), 'Legacy theme patch files must remain removed'],
  [!index.includes('home-light-fix.css') && !index.includes('theme-contrast-fix.css'), 'Index must not reference legacy theme patches'],
  [siteSystem.includes('--ui-bg:') && siteSystem.includes('html[data-theme="light"]'), 'Unified CSS must define dark and light tokens'],
  [siteSystem.includes('.home-logo-frame') && siteSystem.includes('.home-logo-banner'), 'Unified CSS must provide theme-aware logo treatment'],
  [readability.includes('html[data-theme="light"] body #page-content') && readability.includes('html:not([data-theme="dark"]) body #page-content'), 'Readability guard must cover explicit and system light modes'],
  [readability.includes('.result-card:not(.emergency-briefing-card) p') && readability.includes('.judgment-document pre'), 'Readability guard must cover generated result text'],
  [readability.includes('.trial-mini-claim p') && readability.includes('.judge-option-desc'), 'Readability guard must cover trial and form text'],
  [theme.includes('document.documentElement.style.colorScheme'), 'Theme controller must set browser color scheme'],
  [courtDesign.includes('var(--ui-line-strong') && !courtDesign.includes('contrast-fix.js'), 'Court design must use unified tokens without runtime contrast patches'],
  [app.includes("from './pages/home.js?v=20260710-full-audit1'"), 'App must load the audited home directly'],
  [app.includes("result-case-story.js?v=20260711-interpret1"), 'App must load the interpretive result wrapper'],
  [!exists('public/js/pages/home-court.js'), 'Redundant home decoration wrapper must remain removed'],
  [home.includes('사건 접수부터 선고까지 6단계') && home.includes('원고·피고 주장'), 'Home must explain the full court journey'],
  [home.includes('사건수사') && home.includes('법정공방') && home.includes('최종판결'), 'Home must explain investigation, courtroom and judgment'],
  [trial.includes('THEATER_STAGES') && trial.includes('원고 주장') && trial.includes('피고 반박'), 'Trial must display staged investigation and opposing claims'],
  [trial.includes("doc(db, 'results', caseId)") && trial.includes('renderMiniClaims'), 'Trial must reveal generated quick claims'],
  [judgment.includes('plaintiffClaim: cleanParagraph') && judgment.includes('defendantClaim: cleanParagraph'), 'Judgment schema must preserve quick claims'],
  [writer.includes('원문은 사실 확인용 자료') && writer.includes('전체 판결에서 3~8회'), 'AI prompt must reinterpret instead of repeating submitted wording'],
  [quality.includes('copiedPhraseHits <= 7') && quality.includes('mainAnchorMentions <= 10'), 'Quality gate must reject source echo and keyword stuffing'],
  [quality.includes('opposingClaimOverlap <= 0.72'), 'Quality gate must keep opposing claims distinct'],
  [result.includes('claim-showdown') && result.includes('같은 사건, 다른 해석'), 'Result page must render contrasting claim interpretations'],
  [result.includes('<details class="result-card original-case-card">') && result.includes('접수 원문은 판결과 분리'), 'Original submission must be collapsed and separated from the AI result'],
  [result.includes('--alert-title') && result.includes('var(--ui-text-main'), 'Result runtime styles must use theme-aware variables'],
  [guide.includes('전체 과정 시작') && guide.includes('원고·피고 주장'), 'Guide must explain the complete experience'],
  [!guide.includes('관리자 페이지 정책 탭'), 'Public guide must not show administrator instructions'],
  [defaults.includes('사건 접수, 초동수사, 생활증거 감식, 원고측 주장, 피고측 반박'), 'Terms must describe actual service stages'],
  [defaults.includes('Google Gemini API') && defaults.includes('기본 비공개'), 'Privacy policy must describe AI processing and privacy defaults'],
  [!defaults.includes('웃김 점수') && !defaults.includes('소소 형량'), 'Obsolete product wording must remain removed from policies'],
  [policy.includes('isStaleStoredPolicy') && policy.includes('2026년 7월 8일'), 'Policy page must reject stale stored defaults'],
  [footer.includes('사건 접수 → 초동수사 → 원고·피고 주장 → 법정공방 → 황당판결'), 'Footer must summarize the service concept'],
  [footer.includes('#/guide') && footer.includes('#/policy/privacy'), 'Footer must link guide and privacy policy'],
  [!submitCourt.includes('function applySaferPublicDefault'), 'Submit wrapper must not duplicate privacy defaults'],
  [privacyDefault.includes('checkbox.checked = false'), 'Privacy default component must keep submissions private'],
];

const failed = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failed.length) {
  failed.forEach(message => console.error(`Site audit failed: ${message}`));
  process.exit(1);
}

console.log('Verified unified themes, final light-mode readability, interpretive judgments and full court journey.');
