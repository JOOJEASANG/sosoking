import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const fail = message => { throw new Error(message); };

const expected = ['꼰대형', '냉혈형', '회피형', '추궁형', '오버형', '드립형', '빙의형'];
const legacy = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형'];
const legacyTrialOrder = ['엄벌주의형', '감성형', '현실주의형', '과몰입형', '피곤형', '논리집착형', '드립형'];
const version = 'sosoking-judge-final-20260810-2';
const guardVersion = '20260810-judge-final-1';
const runtimeVersion = '20260810-judge-runtime-1';

const trial = read('functions/generate-trial-lite.js');
const persona = read('functions/judge-persona-prompt.js');
const homeEntry = read('public/js/pages/home-seven-judges.js');
const guide = read('public/js/pages/guide.js');
const guard = read('public/js/judge-final-guard.js');
const runtimeGuard = read('public/js/judge-runtime-guard.js');
const trialPage = read('public/js/pages/trial.js');
const board = read('public/js/pages/board.js');
const myCases = read('public/js/pages/my-cases.js');
const discussion = read('public/js/pages/discussion.js');
const index = read('public/index.html');
const marker = read('public/deploy-version.txt').trim();
const liveWorkflow = read('.github/workflows/verify-live-hosting.yml');

for (const name of expected) {
  if (!trial.includes(`type: '${name}'`)) fail(`생성 판사 누락: ${name}`);
  if (!persona.includes(`'${name}': {`)) fail(`판사 전용 프롬프트 누락: ${name}`);
  if (!homeEntry.includes(`name: '${name}'`)) fail(`활성 홈 판사 누락: ${name}`);
  if (!guide.includes(name)) fail(`이용안내 판사 누락: ${name}`);
  if (!guard.includes(`name: '${name}'`)) fail(`최종 UI 가드 판사 누락: ${name}`);
  if (!runtimeGuard.includes(`name: '${name}'`)) fail(`런타임 판사 가드 누락: ${name}`);
}

for (const name of legacy) {
  if (trial.match(/const JUDGES = \[(.*?)\n\];/s)?.[1]?.includes(name)) fail(`신규 생성 목록에 구형 판사 잔존: ${name}`);
  if (homeEntry.match(/const JUDGES = \[(.*?)\n\];/s)?.[1]?.includes(name)) fail(`활성 홈 목록에 구형 판사 잔존: ${name}`);
  if (guide.includes(name)) fail(`이용안내에 구형 판사 잔존: ${name}`);
}

if (!guard.includes(`const JUDGE_UI_VERSION = '${guardVersion}'`)) fail('최종 UI 가드 버전 누락');
if (!guard.includes('new MutationObserver(queueApply)')) fail('캐시된 구형 화면 재덮기 방지 관찰자 누락');
if (!guard.includes('HOME_HERO_HTML') || !guard.includes('heroSub.innerHTML !== HOME_HERO_HTML')) fail('구형 홈 카피 재덮기 방어 누락');
if (!guard.includes('syncHomeJudgeLineup') || !guard.includes('syncJudgeMetadata') || !guard.includes('syncGuide')) fail('최종 UI 표면 동기화 누락');

if (!runtimeGuard.includes(`const RUNTIME_JUDGE_VERSION = '${runtimeVersion}'`)) fail('런타임 판사 가드 버전 누락');
if (!runtimeGuard.includes('syncTrial(root)') || !runtimeGuard.includes('syncBoard(root)')) fail('재판 진행 또는 판결기록 보정 누락');
if (!runtimeGuard.includes("root.querySelectorAll('.board-judge-chip')")) fail('판결기록 판사 칩 보정 누락');
if (!runtimeGuard.includes("root.querySelector('#docket-meta')") || !runtimeGuard.includes("root.querySelector('#loading-text')")) fail('재판 진행 판사/메시지 보정 누락');

const trialJudgeBlock = trialPage.match(/const JUDGES = \[(.*?)\n\];/s)?.[1] || '';
const trialLegacyTypes = [...trialJudgeBlock.matchAll(/\['([^']+)'/g)].map(match => match[1]);
if (trialLegacyTypes.join('|') !== legacyTrialOrder.join('|')) {
  fail('trial.js 구형 표시 배열의 순서가 바뀌어 런타임 인덱스 호환 보정을 신뢰할 수 없습니다.');
}
for (let indexValue = 0; indexValue < expected.length; indexValue += 1) {
  const legacyName = legacyTrialOrder[indexValue];
  const currentName = expected[indexValue];
  if (!runtimeGuard.includes(`['${legacyName}', '${currentName}']`)) {
    fail(`재판 진행 인덱스 호환 매핑 누락: ${legacyName} -> ${currentName}`);
  }
}

if (!board.includes('class="board-judge-chip"')) fail('판결기록 판사 표시 지점을 찾을 수 없습니다.');
if (/judgeType|judgeIcon|judge-name|board-judge-chip/.test(myCases)) fail('내 사건 화면에 별도 판사 표시가 추가되어 최종 동기화 점검이 필요합니다.');
if (/judgeType|judgeIcon|judge-name|board-judge-chip/.test(discussion)) fail('토론 화면에 별도 판사 표시가 추가되어 최종 동기화 점검이 필요합니다.');

const guardAsset = '/js/judge-final-guard.js';
const runtimeAsset = '/js/judge-runtime-guard.js';
if (!index.includes(guardAsset)) fail('index.html에 최종 판사 UI 가드가 연결되지 않았습니다.');
if (!index.includes(runtimeAsset)) fail('index.html에 런타임 판사 가드가 연결되지 않았습니다.');
if (!index.includes(`<meta name="sosoking-deploy-version" content="${version}">`)) fail('HTML 배포 마커 누락');
if (marker !== version) fail(`정적 배포 마커 불일치: ${marker}`);

const homeGuardPos = index.indexOf('/js/home-copy-guard.js');
const finalGuardPos = index.indexOf(guardAsset);
const runtimeGuardPos = index.indexOf(runtimeAsset);
if (!(homeGuardPos >= 0 && finalGuardPos > homeGuardPos && runtimeGuardPos > finalGuardPos)) {
  fail('판사 가드 로딩 순서는 기존 홈 가드 -> 최종 UI 가드 -> 런타임 가드여야 합니다.');
}

for (const host of ['https://sosoking-481e6.web.app', 'https://sosoking.co.kr', 'https://www.sosoking.co.kr']) {
  if (!liveWorkflow.includes(`"${host}"`)) fail(`운영 호스트 배포 검증 누락: ${host}`);
}
if (!liveWorkflow.includes('workflows: ["Deploy Firebase"]')) fail('Firebase 배포 완료 후 운영 검증 연결 누락');
if (!liveWorkflow.includes(`EXPECTED_VERSION: ${version}`)) fail('운영 배포 검증 버전 불일치');

console.log('Final judge deployment validation passed: generation, five-stage persona, home/result/guide UI, trial progress, board chips, stale-cache protection, release markers, and all three production hosts are covered.');
