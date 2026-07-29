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

const humorPrompt = read('functions/humor-prompt.js');
for (const required of [
  '[소소킹 코미디 강도: 풍성하게]',
  '무거운 법률 사이트가 아니라',
  '최소 2개씩',
  '최소 10개의 서로 다른 유머 장면',
  '사건접수(reception)',
  '수사보고(investigation)',
  '원고측 변론(plaintiffArg)',
  '피고측 변론(defendantArg)',
  '재판부 판결(verdict)',
  '사건 속 사물·행동·타이밍',
  'appendHumorRules'
]) {
  if (!humorPrompt.includes(required)) {
    errors.push(`functions/humor-prompt.js: every-stage humor rule missing: ${required}`);
  }
}

const main = read('functions/main.js');
const humorLoad = main.indexOf("require('./humor-prompt')");
const dailyLoad = main.indexOf("require('./daily')");
const userTrialLoad = main.indexOf("require('./generate-trial-lite')");
if (humorLoad < 0 || dailyLoad < 0 || userTrialLoad < 0 || humorLoad > dailyLoad || humorLoad > userTrialLoad) {
  errors.push('functions/main.js: humor prompt must load before user and daily AI functions');
}

const resultComments = read('public/js/pages/result-comments.js');
for (const required of [
  '진지한 척 웃기는 오락형 생활법정',
  '실제 법률 판단이나 법적 효력은 없습니다',
  '사건접수',
  '수사보고',
  '원고측 변론',
  '피고측 변론',
  '재판부 판결',
  'result-stage-comedy'
]) {
  if (!resultComments.includes(required)) {
    errors.push(`public/js/pages/result-comments.js: visible comedy guidance missing: ${required}`);
  }
}

const app = read('public/js/app.js');
const index = read('public/index.html');
const worker = read('public/sw.js');
const humorVersion = '20260730-humor-every-stage-1';
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
for (const [file, source, required] of [
  ['public/js/app.js', app, `./pages/result-comments.js?v=${humorVersion}`],
  ['public/sw.js', worker, `/js/pages/result-comments.js?v=${humorVersion}`]
]) {
  if (!source.includes(required)) errors.push(`${file}: humor cache version missing: ${required}`);
}
if (!appVersion || !worker.includes(`/js/app.js?v=${appVersion}`)) {
  errors.push('public/index.html and public/sw.js: active app cache versions are inconsistent');
}
if (!/^const CACHE_NAME = 'sosoking-app-v[^']+';/m.test(worker)) {
  errors.push('public/sw.js: versioned application cache name is missing');
}

if (errors.length) {
  console.error(`Verdict humor validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Verdict humor validation passed: every AI document stage receives plentiful tailored comedy, the result screen states its entertainment purpose, and cache versions are synchronized.');
