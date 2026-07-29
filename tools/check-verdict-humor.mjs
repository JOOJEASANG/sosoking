import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const userTrial = read('functions/generate-trial-lite.js');
for (const required of [
  "코미디 판결문 작가",
  '웃음코드를 충분히 넣는다',
  '사건 맞춤형 드립',
  '반복되지 않는 웃음 포인트',
  "'드립형'",
  'temperature: 0.9',
  'function buildLocalFallback',
  'function judgeClosing'
]) {
  if (!userTrial.includes(required)) {
    errors.push(`functions/generate-trial-lite.js: humor requirement missing: ${required}`);
  }
}

const dailyTrial = read('functions/daily.js');
for (const required of [
  '웃음코드를 충분히 넣는다',
  '사건 맞춤형 비유와 드립을 적극 활용한다',
  'temperature: 0.92',
  '냉장고 마지막 푸딩 실종 사건',
  '숟가락이 증거번호를 받을 일은 없었을 것이다'
]) {
  if (!dailyTrial.includes(required)) {
    errors.push(`functions/daily.js: humor requirement missing: ${required}`);
  }
}

if (errors.length) {
  console.error(`Verdict humor validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Verdict humor validation passed: user and daily verdict prompts retain tailored wit, judge-character comedy, and humorous fallbacks.');
