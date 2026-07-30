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
  '법원 문서처럼 진지하게 읽히면서도',
  '여러 번 피식 웃게 만드는 것',
  '물건·행동·시간·순서·말투·기대와 실제 결과의 차이',
  '남은 흔적 확인',
  '구체성과 분량 원칙',
  '확인 가능한 세부사항을 3개 이상',
  '각 소제목은 보통 2~4문장',
  '수사보고의 진술 검토와 판결의 판단이유',
  '유머의 밀도와 방식',
  '재치 있는 문장이 각각 자연스럽게 한두 번',
  '사실 설명 두세 문장 사이에 정확히 맞는 재치 한 문장',
  '모든 판사가 웃기되 엄벌주의형은',
  "결과문 안에 '웃음 포인트'",
  '인터넷 유행어, 억지 신조어',
  '다른 사건에도 그대로 붙일 수 있는 문장',
  '수사보고(investigation)',
  '시간순서, 실제 남은 흔적, 당사자의 말과 행동 사이의 모순',
  '피고를 바보로 만들지 말고',
  '앞 문서의 물건·말·행동을 새 문장으로 되받아쳐',
  '자연스러운 웃긴 문장이 여러 번 등장하는가',
  'appendHumorRules'
]) {
  if (!humorPrompt.includes(required)) {
    errors.push(`functions/humor-prompt.js: richer natural comedy rule missing: ${required}`);
  }
}
for (const forbidden of [
  '최소 2개씩',
  '최소 10개의 서로 다른 유머 장면',
  '무조건 밈을 사용',
  '사건마다 같은 드립'
]) {
  if (humorPrompt.includes(forbidden)) {
    errors.push(`functions/humor-prompt.js: forced or repetitive joke rule remains: ${forbidden}`);
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

console.log('Verdict humor validation passed: AI verdicts use concrete case details, several natural comedy beats, distinct judge voices, and serious document structure without forced stage callouts.');
