import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const userTrial = read('functions/generate-trial-lite.js');
for (const required of [
  '코미디 판결문 작가',
  '웃음코드를 충분히 넣는다',
  '사건 맞춤형 드립',
  '반복되지 않는 웃음 포인트',
  "'드립형'",
  'temperature: 0.9',
  'function buildLocalFallback',
  'function judgeClosing'
]) {
  if (!userTrial.includes(required)) {
    errors.push(`functions/generate-trial-lite.js: humor foundation missing: ${required}`);
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
    errors.push(`functions/daily.js: humor foundation missing: ${required}`);
  }
}

const humorPrompt = read('functions/humor-prompt.js');
for (const required of [
  '[소소킹 코미디 방향: 상황 자체가 재미있게]',
  '[소소킹 미소 밀도: 읽다가 자연스럽게 피식]',
  '입꼬리가 자연스럽게 올라가게',
  '접수·수사에서 첫 미소',
  '변론에서 말의 빈틈',
  '판결의 콜백',
  '첫 미소: 사건접수 또는 수사보고',
  '변명의 틈:',
  '판결 콜백:',
  '드립형이 아니어도 각 판사의 성격에서 미소',
  '폭력, 학대, 성적 피해, 자해·죽음',
  '핵심 상황·행동·모순 하나',
  '평범한 시작 → 예상 밖 행동 → 변명과 증거의 충돌 → 판결에서 앞선 장면을 회수하는 결말',
  "결과문 안에 '웃음 포인트'",
  '다른 사건에도 그대로 붙일 수 있는 문장',
  '수사보고(investigation)',
  '시간순서, 실제 남은 흔적, 당사자의 말과 행동 사이의 모순',
  '앞 문서에서 나온 물건·말·행동을 다시 활용해 책임을 정리',
  'appendHumorRules'
]) {
  if (!humorPrompt.includes(required)) {
    errors.push(`functions/humor-prompt.js: natural smile rule missing: ${required}`);
  }
}
for (const forbidden of ['최소 2개씩', '최소 10개의 서로 다른 유머 장면']) {
  if (humorPrompt.includes(forbidden)) {
    errors.push(`functions/humor-prompt.js: forced joke quota remains: ${forbidden}`);
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
  '진지한 형식으로 즐기는 오락형 생활법정',
  '실제 법률 판단이나 법적 효력은 없습니다',
  'function addEntertainmentNotice',
  'result-comedy-notice'
]) {
  if (!resultComments.includes(required)) {
    errors.push(`public/js/pages/result-comments.js: entertainment notice missing: ${required}`);
  }
}
for (const forbidden of [
  'STAGE_COMEDY',
  'result-stage-comedy',
  '웃음 포인트',
  '사물에게 묵비권'
]) {
  if (resultComments.includes(forbidden)) {
    errors.push(`public/js/pages/result-comments.js: forced stage explanation remains: ${forbidden}`);
  }
}

const app = read('public/js/app.js');
const index = read('public/index.html');
const worker = read('public/sw.js');
const resultVersion = app.match(/\.\/pages\/result-comments\.js\?v=([^'";]+)/)?.[1] || '';
const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (!resultVersion) {
  errors.push('public/js/app.js: versioned result-comments module is missing');
} else if (!worker.includes(`/js/pages/result-comments.js?v=${resultVersion}`)) {
  errors.push('public/js/app.js and public/sw.js: result-comments cache versions differ');
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

console.log('Verdict humor validation passed: AI verdicts target a gentle smile through case-specific setup, contradiction and callback without forced joke quotas.');
