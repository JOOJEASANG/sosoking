import fs from 'node:fs';
import path from 'node:path';

const errors = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const file of walk('public').filter(file => /\.(?:html|js|mjs)$/.test(file))) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    if (/\son[a-z]+\s*=\s*["']/.test(line)) {
      errors.push(`${file}:${index + 1}: inline event attribute remains`);
    }
    if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(line)) {
      errors.push(`${file}:${index + 1}: inline script block remains`);
    }
    if (/javascript\s*:/i.test(line)) {
      errors.push(`${file}:${index + 1}: javascript URL remains`);
    }
  });
}

const firebaseText = fs.readFileSync('firebase.json', 'utf8');
const firebase = JSON.parse(firebaseText);
const headerRules = firebase.hosting?.headers || [];
const globalHeaders = headerRules.find(rule => rule.source === '**')?.headers || [];
if (globalHeaders.some(header => header.key.startsWith('Content-Security-Policy'))) {
  errors.push('firebase.json: CSP must not apply globally to Firebase reserved authentication paths');
}

const protectedSources = [
  '/',
  '/index.html',
  '/admin',
  '/admin/**',
  '/@(board|submit|guide|auth|my-cases)',
  '/@(result|trial|discussion)/**'
];
for (const source of protectedSources) {
  const headers = headerRules.find(rule => rule.source === source)?.headers || [];
  const enforced = headers.find(header => header.key === 'Content-Security-Policy')?.value || '';
  const reportOnly = headers.find(header => header.key === 'Content-Security-Policy-Report-Only')?.value || '';
  if (!enforced) errors.push(`firebase.json: enforced CSP is missing for ${source}`);
  if (!reportOnly.includes("frame-ancestors 'none'")) {
    errors.push(`firebase.json: frame-ancestors report policy is missing for ${source}`);
  }
}

if (!firebaseText.includes("script-src 'self' https://www.gstatic.com https://apis.google.com")) {
  errors.push('firebase.json: external-script allowlist is missing');
}
if (!firebaseText.includes('https://www.google.com/recaptcha/')
  || !firebaseText.includes('https://www.recaptcha.net/recaptcha/')) {
  errors.push('firebase.json: future App Check reCAPTCHA origins are missing');
}
if (!firebaseText.includes("script-src-attr 'none'")) {
  errors.push('firebase.json: inline event attributes are not explicitly disabled');
}
for (const rule of headerRules) {
  const enforced = rule.headers?.find(header => header.key === 'Content-Security-Policy')?.value || '';
  if (enforced.includes("script-src 'self' 'unsafe-inline'")) {
    errors.push(`firebase.json: enforced script-src for ${rule.source} still permits unsafe-inline`);
  }
}

for (const file of ['public/index.html', 'public/admin/index.html']) {
  const html = fs.readFileSync(file, 'utf8');
  if (!html.includes('/js/theme-init.js?v=20260729-script-csp-1')) {
    errors.push(`${file}: external first-paint theme script version is missing`);
  }
}

const themeInit = fs.readFileSync('public/js/theme-init.js', 'utf8');
if (!themeInit.includes("localStorage.getItem('theme')") || !/try\s*\{[\s\S]*catch/.test(themeInit)) {
  errors.push('public/js/theme-init.js: guarded theme storage initialization is missing');
}

const app = fs.readFileSync('public/js/app.js', 'utf8');
for (const specifier of [
  "./pages/home.js?v=20260830-final-blind-1",
  "./pages/submit.js?v=20260830-final-audit-1",
  "./pages/result-comments.js?v=20260830-final-audit-1",
  "./pages/policy.js?v=20260830-final-audit-1",
  "./pages/hall.js?v=20260830-final-blind-1",
  "./pages/jury.js?v=20260830-final-blind-1"
]) {
  if (!app.includes(specifier)) errors.push(`public/js/app.js: canonical module import is missing ${specifier}`);
}
for (const retired of ['home-court.js', 'board-court.js', 'home-seven-judges.js', 'submit-guard.js', 'policy-configurable-limit.js']) {
  if (app.includes(retired)) errors.push(`public/js/app.js: retired module remains under CSP: ${retired}`);
}

const index = fs.readFileSync('public/index.html', 'utf8');
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
const worker = fs.readFileSync('public/sw.js', 'utf8');
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html/public/sw.js: active app version is not synchronized');
}

const adminIndex = fs.readFileSync('public/admin/index.html', 'utf8');
if (!adminIndex.includes('/admin/admin-bootstrap.js?v=20260729-report-moderation-1')) {
  errors.push('public/admin/index.html: consolidated administrator bootstrap version is missing');
}
const adminBootstrap = fs.readFileSync('public/admin/admin-bootstrap.js', 'utf8');
if (!adminBootstrap.includes("./admin.js?v=20260729-report-moderation-1")) {
  errors.push('public/admin/admin-bootstrap.js: consolidated dashboard cache version is missing');
}
if (adminBootstrap.includes('admin-enhancements.js') || adminBootstrap.includes('admin-security-overrides.js')) {
  errors.push('public/admin/admin-bootstrap.js: obsolete patch module import remains');
}

if (errors.length) {
  console.error(`Script CSP validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Script CSP validation passed: route-scoped policy, no inline execution, canonical modules, and synchronized app cache versions.');
