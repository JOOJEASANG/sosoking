import fs from 'node:fs';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');

const userTrial = read('functions/generate-trial-lite.js');
for (const required of [
  '코미디 판결문 작가',
  '웃음코드를 충분히 넣는다',
  '사건 맞춤형 드립',
  '0~2개의 강한 말장난',
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
  "type: '드립형'",
  '사건의 핵심 사물, 행동, 실제 표현에서만 사건 맞춤형 드립을 뽑는다',
  '범용 유행어나 억지 말장난보다 그 사건에서만 가능한 한 방과 마지막 콜백을 중시한다',
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
  '웃긴 문장을 많이 쓰는 것이 아니라',
  '핵심 상황·행동·모순 하나',
  '평범한 시작 → 예상 밖 행동 → 변명과 증거의 충돌 → 판결에서 앞선 장면을 회수하는 결말',
  "결과문 안에 '웃음 포인트'",
  '다른 사건에도 그대로 붙일 수 있는 문장',
  '수사보고(investigation)',
  '대형 사건 수사본부가 다루는 것처럼 과잉 진지하게',
  '현장보존·현장감식·CCTV 동선 분석',
  '지문·족적·DNA 감식',
  '국과수 감정 의뢰 검토',
  '디지털 포렌식',
  '사용자가 실제 존재를 말한 경우에만 발견·확보·검출 사실',
  '실제 경찰·국과수에 신고·의뢰·출동한 사실',
  '전문 수사 절차의 과한 스케일이 스스로 우스워지는 배열',
  '앞 문서에서 나온 물건·말·행동을 다시 활용해 결말',
  'appendHumorRules'
]) {
  if (!humorPrompt.includes(required)) {
    errors.push(`functions/humor-prompt.js: natural comedy rule missing: ${required}`);
  }
}
for (const forbidden of ['최소 2개씩', '최소 10개의 서로 다른 유머 장면']) {
  if (humorPrompt.includes(forbidden)) {
    errors.push(`functions/humor-prompt.js: forced joke quota remains: ${forbidden}`);
  }
}

const main = read('functions/main.js');
const humorLoad = main.indexOf("require('./humor-prompt')");
const personaLoad = main.indexOf("require('./judge-persona-prompt')");
const dailyLoad = main.indexOf("require('./daily')");
const userTrialLoad = main.indexOf("require('./generate-trial-lite')");
if (humorLoad < 0 || personaLoad < 0 || dailyLoad < 0 || userTrialLoad < 0 || humorLoad > personaLoad || personaLoad > dailyLoad || personaLoad > userTrialLoad) {
  errors.push('functions/main.js: humor and judge persona prompts must load before user and daily AI functions');
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

console.log('Verdict humor validation passed: investigation reports use major-case forensic comedy without inventing evidence, both user and admin generators enforce case-specific callback humor, seven comedy judge personas load before generation, and active cache versions are synchronized.');