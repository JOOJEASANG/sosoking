import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicRoot = path.join(root, 'public');
const extensions = new Set(['.html', '.js', '.mjs', '.json']);
const skipped = new Set(['node_modules', '.git', '.firebase', 'dist']);
const matches = [];

function walk(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && skipped.has(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.isFile() || !extensions.has(path.extname(entry.name))) continue;
    const source = fs.readFileSync(full, 'utf8');
    source.split(/\r?\n/).forEach((line, index) => {
      if (line.includes('게임')) {
        matches.push(`${path.relative(root, full).replaceAll(path.sep, '/')}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

walk(publicRoot);
console.log('\n[사용자 노출 가능 게임 문구 스캔]');
if (!matches.length) {
  console.log('게임 문구 없음');
} else {
  matches.forEach(match => console.log(match));
  console.log(`총 ${matches.length}건`);
}
