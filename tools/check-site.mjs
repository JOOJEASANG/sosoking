import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const publicDir = path.resolve('public');
const requiredFiles = ['index.html', 'styles.css', 'robots.txt'];
const failures = [];

const entries = await readdir(publicDir).catch(() => null);
if (!entries) {
  failures.push('public/ 디렉터리가 없습니다.');
} else {
  for (const file of requiredFiles) {
    if (!entries.includes(file)) {
      failures.push(`public/${file} 이(가) 없습니다.`);
    }
  }
}

if (entries?.includes('index.html')) {
  const html = await readFile(path.join(publicDir, 'index.html'), 'utf8');
  if (!html.includes('<html lang="ko"')) {
    failures.push('public/index.html 에 lang="ko" 선언이 없습니다.');
  }
  if (!/<title>[^<]+<\/title>/.test(html)) {
    failures.push('public/index.html 에 <title> 이 없습니다.');
  }
  if (!html.includes('name="viewport"')) {
    failures.push('public/index.html 에 viewport 메타 태그가 없습니다.');
  }
}

const rules = await readFile(path.resolve('firestore.rules'), 'utf8').catch(() => '');
if (!rules.includes("rules_version = '2'")) {
  failures.push('firestore.rules 의 rules_version 이 2가 아닙니다.');
}

if (failures.length > 0) {
  console.error('사이트 검증 실패:');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('사이트 검증 통과');
