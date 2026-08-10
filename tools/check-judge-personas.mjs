import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

const trial = read('functions/generate-trial-lite.js');
const persona = read('functions/judge-persona-prompt.js');
const main = read('functions/main.js');
const home = read('public/js/pages/home-seven-judges.js');
const guide = read('public/js/pages/guide.js');
const index = read('public/index.html');
const worker = read('public/sw.js');

const expected = ['꼰대형', '냉혈형', '회피형', '추궁형', '오버형', '드립형', '빙의형'];
const legacy = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형'];

for (const type of expected) {
  if ([...type].length !== 3) throw new Error(`판사 유형은 정확히 3글자여야 합니다: ${type}`);
  if (!trial.includes(`type: '${type}'`)) throw new Error(`generate-trial-lite.js 판사 누락: ${type}`);
  if (!persona.includes(`'${type}': {`)) throw new Error(`judge-persona-prompt.js 전용 연출 누락: ${type}`);
  if (!home.includes(`name: '${type}'`)) throw new Error(`메인 판사 카드 누락: ${type}`);
  if (!guide.includes(type)) throw new Error(`이용안내 판사 유형 누락: ${type}`);
}

const judgeBlock = trial.match(/const JUDGES = \[(.*?)\n\];/s)?.[1] || '';
const judgeTypes = [...judgeBlock.matchAll(/type: '([^']+)'/g)].map(match => match[1]);
if (judgeTypes.length !== 7) throw new Error(`판사는 정확히 7명이어야 합니다. 현재 ${judgeTypes.length}명`);
if (new Set(judgeTypes).size !== 7) throw new Error('판사 유형 이름이 중복되었습니다.');
if (judgeTypes.join('|') !== expected.join('|')) throw new Error(`판사 순서가 기대값과 다릅니다: ${judgeTypes.join(', ')}`);

const homeJudgeBlock = home.match(/const JUDGES = \[(.*?)\n\];/s)?.[1] || '';
const homeJudgeTypes = [...homeJudgeBlock.matchAll(/name: '([^']+)'/g)].map(match => match[1]);
if (homeJudgeTypes.join('|') !== expected.join('|')) {
  throw new Error(`메인 판사 카드 순서가 생성 판사 순서와 다릅니다: ${homeJudgeTypes.join(', ')}`);
}

for (const oldType of legacy) {
  if (judgeBlock.includes(oldType)) throw new Error(`구형 판사 유형이 신규 JUDGES 목록에 남았습니다: ${oldType}`);
  if (homeJudgeBlock.includes(oldType)) throw new Error(`구형 판사 유형이 메인 판사 카드에 남았습니다: ${oldType}`);
  if (guide.includes(oldType)) throw new Error(`이용안내에 구형 판사 유형이 남았습니다: ${oldType}`);
}

for (const type of expected) {
  const requiredPersonaHints = ['사건접수', '수사보고', '원고측 변론', '피고측 변론', '판결·주문', '마지막 콜백'];
  const start = persona.indexOf(`'${type}': {`);
  const nextCandidates = expected
    .filter(other => other !== type)
    .map(other => persona.indexOf(`'${other}': {`, start + 1))
    .filter(index => index > start);
  const end = nextCandidates.length ? Math.min(...nextCandidates) : persona.indexOf('\n});', start);
  const block = persona.slice(start, end > start ? end : undefined);
  for (const key of ['core:', 'reception:', 'investigation:', 'plaintiff:', 'defendant:', 'ruling:', 'voice:', 'closing:']) {
    if (!block.includes(key)) throw new Error(`${type} 전용 연출에 ${key} 항목이 없습니다.`);
  }
  for (const hint of requiredPersonaHints) {
    if (!persona.includes(hint)) throw new Error(`판사 전용 프롬프트 공통 단계 누락: ${hint}`);
  }
}

if (!persona.includes('사용자가 실제로 하지 않은 발언은 인용하지 않는다')) {
  throw new Error('추궁형의 허위 인용 방지 규칙이 없습니다.');
}
if (!persona.includes('현실 기관이 실제 출동했다고 꾸미지 않는다')) {
  throw new Error('오버형의 허위 기관 개입 방지 규칙이 없습니다.');
}
if (!persona.includes('최신 패치·제품사양·전문수치를 지어내지 않는다')) {
  throw new Error('빙의형의 주제 전문정보 환각 방지 규칙이 없습니다.');
}
if (!persona.includes('0~2개 원칙')) {
  throw new Error('드립형의 말장난 절제 규칙이 없습니다.');
}

const humorIndex = main.indexOf("require('./humor-prompt')");
const topicIndex = main.indexOf("require('./five-stage-topic-comedy')");
const personaIndex = main.indexOf("require('./judge-persona-prompt')");
const qualityIndex = main.indexOf("require('./document-output-quality')");
if (!(humorIndex >= 0 && topicIndex > humorIndex && personaIndex > topicIndex && qualityIndex > personaIndex)) {
  throw new Error('판사 전용 프롬프트의 로딩 순서가 잘못되었습니다.');
}

if (!trial.includes("promptVersion: 'simple-document-v1.6-judge-personas'")) {
  throw new Error('새 판사 체계의 promptVersion이 연결되지 않았습니다.');
}

if (!home.includes('성격부터 판결 방식까지 다른 7명')) {
  throw new Error('메인 판사 라인업 설명이 새 캐릭터 체계를 반영하지 않습니다.');
}
if (!home.includes('같은 사건도 담당 판사의 성격에 따라 전혀 다른 방식')) {
  throw new Error('메인 히어로 설명이 판사별 차이를 안내하지 않습니다.');
}

const appVersion = index.match(/<script type="module" src="\/js\/app\.js\?v=([^"']+)"/)?.[1] || '';
if (appVersion !== '20260810-mycase-original-fix-1') {
  throw new Error(`현재 앱 캐시 버전이 기대값과 다릅니다: ${appVersion || '없음'}`);
}
if (!worker.includes(`/js/app.js?v=${appVersion}`) || !worker.includes(`const CACHE_NAME = 'sosoking-app-v${appVersion}';`)) {
  throw new Error('현재 앱 캐시 버전이 index/service worker 사이에서 일치하지 않습니다.');
}

console.log('Judge persona validation passed: seven distinct 3-character comedy judges are synchronized across generation, five-stage prompting, main UI, guide copy, current app cache, fallback rulings, and safety constraints.');
