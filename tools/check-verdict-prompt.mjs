// 판결문 프롬프트가 입력 사실을 벗어나지 않도록 지키는 검사.
import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildPrompt, JUDGES, HARD_LIMITS } = require('../functions/verdict-prompt.js');

const errors = [];
const MAX_PROMPT_CHARS = 3500;
const MAX_HARD_LIMITS = 6;

const prompt = buildPrompt('친구 2명과 냉면을 먹었는데 국물이 너무 시큼했고 친구들도 같은 반응이었다. 사장님에게 말했지만 원래 그렇다고 했다.', JUDGES[0], 7);

// 1. 프롬프트가 다시 비대해지지 않아야 한다.
if (prompt.length > MAX_PROMPT_CHARS) {
  errors.push(`프롬프트가 ${prompt.length}자로 상한 ${MAX_PROMPT_CHARS}자를 넘었습니다.`);
}

// 2. 핵심 사실성 제한은 짧고 명확하게 유지한다.
const limitCount = (HARD_LIMITS.match(/^\d+\./gm) || []).length;
if (limitCount > MAX_HARD_LIMITS) {
  errors.push(`사실성 제한 항목이 ${limitCount}개입니다. ${MAX_HARD_LIMITS}개를 넘기지 마세요.`);
}

// 3. 사건의 웃음은 사실 조작이 아니라 형식 과장에서 만들어야 한다.
for (const technique of ['사실 그대로의 정밀함', '과잉 문서화', '가정과 사실 분리', '사건 맞춤형 주문', '콜백']) {
  if (!prompt.includes(technique)) errors.push(`필수 판결 기법이 프롬프트에서 사라졌습니다: ${technique}`);
}

// 4. 입력에 없는 사실을 만들라는 과거 지시가 다시 들어오면 안 된다.
for (const forbidden of [
  '적극적으로 지어내라',
  '지어낸 날짜와 시각',
  '뜬금없는 목격자',
  'CCTV 분석·잠복 수사·국과수 의뢰',
  '지어낸 법령과 판례'
]) {
  if (prompt.includes(forbidden)) errors.push(`비정상적인 사실 생성 지시가 다시 들어왔습니다: ${forbidden}`);
}

for (const required of [
  '사용자가 입력하지 않은 사실',
  '입력에 없는 CCTV',
  '직접 답변은 제출되지 않았다',
  '기재 없음',
  '확인할 자료 없음'
]) {
  if (!prompt.includes(required)) errors.push(`사실성 보호 지시가 누락되었습니다: ${required}`);
}

// 5. 민심소 비교용 승패와 출력 구조가 유지되어야 한다.
const generator = fs.readFileSync('functions/generate-trial-lite.js', 'utf8');
if (!generator.includes('normalizeWinner') || !generator.includes("winner: { type: 'string' }")) {
  errors.push('generate-trial-lite.js에 winner 필드가 없습니다.');
}

// 6. AI가 입력에 없는 수사·증거를 만들어도 저장되지 않도록 서버 검사가 있어야 한다.
for (const required of [
  'GROUNDING_GUARDS',
  'ungroundedOutputCode',
  'UNSUPPORTED_CCTV',
  'UNSUPPORTED_FORENSICS',
  'UNSUPPORTED_WITNESS',
  "groundingStatus: 'input-grounded'"
]) {
  if (!generator.includes(required)) errors.push(`generate-trial-lite.js 사실성 가드가 누락되었습니다: ${required}`);
}

// 7. 예전의 조작된 로컬 대체 판결 문구가 남아 있으면 안 된다.
for (const fabricated of [
  '14시간 37분',
  '국과수 정밀 감정 의뢰 회신',
  '정황 목격자 진술 (인근 거주 김○○)',
  '잠복 조사 결과',
  '원고 진술과 물리적 정황의 일치율 87.3%'
]) {
  if (generator.includes(fabricated)) errors.push(`조작된 로컬 대체 판결 문구가 남아 있습니다: ${fabricated}`);
}

if (generator.includes('buildLocalFallback(') || generator.includes("'local-case-fallback'")) {
  errors.push('AI 실패를 정상 판결처럼 저장하는 local-case-fallback 경로가 남아 있습니다.');
}

// 8. fetch 몽키패치 방식으로 되돌아가지 않아야 한다.
const main = fs.readFileSync('functions/main.js', 'utf8');
if (/require\('\.\/(humor-prompt|comedy-topic-context|five-stage-topic-comedy|judge-persona-prompt|document-output-quality)'\)/.test(main)) {
  errors.push('프롬프트 주입 패치가 다시 등록됐습니다.');
}

// 9. 문서 분량 상한은 기존 계약을 유지한다.
const caps = [...generator.matchAll(/cleanDocument\(parsed\?\.\w+, (\d+)\)/g)].map(match => Number(match[1]));
const capTotal = caps.reduce((sum, value) => sum + value, 0);
if (capTotal > 9500) {
  errors.push(`문서 분량 상한 합계가 ${capTotal}자입니다. 9,500자를 넘기지 마세요.`);
}

if (errors.length > 0) {
  console.error('판결문 프롬프트 검사 실패:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`판결문 사실성 검사 통과 (프롬프트 ${prompt.length}자, 제한 ${limitCount}개, 출력 상한 ${capTotal}자)`);
