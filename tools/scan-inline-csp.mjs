import fs from 'node:fs';
import path from 'node:path';

// Re-run after replacing inline script handlers and first-paint scripts.
function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const findings = [];
for (const file of walk('public').filter(file => /\.(?:html|js|mjs)$/.test(file))) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, index) => {
    const reasons = [];
    if (/\son[a-z]+\s*=\s*["']/.test(line)) reasons.push('inline-event');
    if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(line)) reasons.push('inline-script');
    if (/javascript\s*:/i.test(line)) reasons.push('javascript-url');
    if (reasons.length) findings.push(`${file}:${index + 1}:${reasons.join(',')}:${line.trim()}`);
  });
}

console.log(`INLINE_CSP_FINDINGS=${findings.length}`);
findings.forEach(finding => console.log(finding));
