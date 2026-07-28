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
  if (!html.includes('/js/theme-init.js?v=')) {
    errors.push(`${file}: external first-paint theme script is missing`);
  }
}

const themeInit = fs.readFileSync('public/js/theme-init.js', 'utf8');
if (!themeInit.includes("localStorage.getItem('theme')") || !/try\s*\{[\s\S]*catch/.test(themeInit)) {
  errors.push('public/js/theme-init.js: guarded theme storage initialization is missing');
}

if (errors.length) {
  console.error(`Script CSP validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Script CSP validation passed: no inline script execution and enforced external-script policy.');
