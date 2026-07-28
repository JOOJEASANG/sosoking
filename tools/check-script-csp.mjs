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

const firebase = fs.readFileSync('firebase.json', 'utf8');
if (!firebase.includes('"key": "Content-Security-Policy"')) {
  errors.push('firebase.json: enforced Content-Security-Policy header is missing');
}
if (!firebase.includes("script-src 'self' https://www.gstatic.com https://apis.google.com")) {
  errors.push('firebase.json: external-script allowlist is missing');
}
if (!firebase.includes('https://www.google.com/recaptcha/')
  || !firebase.includes('https://www.recaptcha.net/recaptcha/')) {
  errors.push('firebase.json: future App Check reCAPTCHA origins are missing');
}
if (!firebase.includes("script-src-attr 'none'")) {
  errors.push('firebase.json: inline event attributes are not explicitly disabled');
}
const enforcedPolicy = firebase.match(/"key": "Content-Security-Policy",\s*"value": "([^"]+)"/)?.[1] || '';
if (!enforcedPolicy || enforcedPolicy.includes("script-src 'self' 'unsafe-inline'")) {
  errors.push('firebase.json: enforced script-src still permits unsafe-inline');
}
if (!firebase.includes('"key": "Content-Security-Policy-Report-Only"')
  || !firebase.includes("frame-ancestors 'none'")) {
  errors.push('firebase.json: authentication-compatible frame-ancestors report policy is missing');
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
  './pages/home-court.js?v=20260729-script-csp-1',
  './pages/board-court.js?v=20260729-script-csp-1'
]) {
  if (!app.includes(specifier)) errors.push(`public/js/app.js: stale CSP module import remains instead of ${specifier}`);
}
const homeCourt = fs.readFileSync('public/js/pages/home-court.js', 'utf8');
if (!homeCourt.includes("./home.js?v=20260729-script-csp-1")) {
  errors.push('public/js/pages/home-court.js: stale home module cache version remains');
}
const boardCourt = fs.readFileSync('public/js/pages/board-court.js', 'utf8');
if (!boardCourt.includes("./board.js?v=20260729-script-csp-1")) {
  errors.push('public/js/pages/board-court.js: stale board module cache version remains');
}
const adminBootstrap = fs.readFileSync('public/admin/admin-bootstrap.js', 'utf8');
for (const moduleName of ['admin.js', 'admin-enhancements.js', 'admin-security-overrides.js']) {
  if (!adminBootstrap.includes(`./${moduleName}?v=20260729-script-csp-1`)) {
    errors.push(`public/admin/admin-bootstrap.js: stale ${moduleName} cache version remains`);
  }
}

if (errors.length) {
  console.error(`Script CSP validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Script CSP validation passed: no inline execution, enforced allowlist, and synchronized module cache versions.');
