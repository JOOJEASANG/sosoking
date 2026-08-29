// 판결문 프롬프트가 다시 망가지지 않도록 지키는 검사.
//
// 이전 구조는 fetch를 가로채는 패치 5겹이 규칙 8,000자 이상을 덧붙였고
// 그중 대부분이 금지였다. 결과물이 밋밋해진 직접적인 원인이었다.
// 그래서 여기서는 프롬프트의 '문구'가 아니라 '성질'을 검사한다.

import fs from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildPrompt, JUDGES, HARD_LIMITS } = require('../functions/verdict-prompt.js');

const errors = [];
const MAX_PROMPT_CHARS = 3000;
const MAX_HARD_LIMITS = 6;

const prompt = buildPrompt('친구가 카톡 답장을 3일 동안 안 했어요', JUDGES[0], 7);

// 1. 프롬프트가 다시 비대해지지 않아야 한다.
if (prompt.length > MAX_PROMPT_CHARS) {
  errors.push(`프롬프트가 ${prompt.length}자로 상한 ${MAX_PROMPT_CHARS}자를 넘었습니다. 규칙을 더 쌓지 말고 정리하세요.`);
}

// 2. 금지 목록이 다시 불어나지 않아야 한다.
const limitCount = (HARD_LIMITS.match(/^\d+\./gm) || []).length;
if (limitCount > MAX_HARD_LIMITS) {
  errors.push(`금지 항목이 ${limitCount}개입니다. ${MAX_HARD_LIMITS}개를 넘기지 마세요. 금지를 늘리면 결과물이 밋밋해집니다.`);
}

// 3. 웃음을 만드는 기법이 '허용'으로 남아 있어야 한다.
for (const technique of ['지어낸 정밀함', '과잉 수사 절차', '지어낸 법령과 판례', '변명의 자멸', '콜백']) {
  if (!prompt.includes(technique)) {
    errors.push(`웃음 기법이 프롬프트에서 사라졌습니다: ${technique}`);
  }
}

// 4. 디테일을 지어내라는 허가가 남아 있어야 한다. 이걸 막으면 이 장르는 웃기지 않는다.
if (!prompt.includes('적극적으로 지어내라')) {
  errors.push('정황을 지어내라는 허가가 사라졌습니다. 이 허가가 없으면 결과물이 안전하고 밋밋해집니다.');
}

// 5. 민심소가 AI 판결과 민심을 비교하려면 승패가 구조화되어 있어야 한다.
const generator = fs.readFileSync('functions/generate-trial-lite.js', 'utf8');
if (!generator.includes('normalizeWinner') || !generator.includes("winner: { type: 'string' }")) {
  errors.push('generate-trial-lite.js에 winner 필드가 없습니다. 민심소의 판결 비교가 동작하지 않습니다.');
}

// 6. fetch 몽키패치 방식으로 되돌아가지 않아야 한다.
const main = fs.readFileSync('functions/main.js', 'utf8');
if (/require\('\.\/(humor-prompt|comedy-topic-context|five-stage-topic-comedy|judge-persona-prompt|document-output-quality)'\)/.test(main)) {
  errors.push('프롬프트 주입 패치가 다시 등록됐습니다. 프롬프트는 verdict-prompt.js 한 곳에서만 만듭니다.');
}

// 7. 문서 분량 상한이 다시 늘어나지 않아야 한다. 웃음은 밀도에서 나온다.
const caps = [...generator.matchAll(/cleanDocument\(parsed\?\.\w+, (\d+)\)/g)].map(match => Number(match[1]));
const capTotal = caps.reduce((sum, value) => sum + value, 0);
if (capTotal > 5000) {
  errors.push(`문서 분량 상한 합계가 ${capTotal}자입니다. 5,000자를 넘기지 마세요.`);
}

if (errors.length > 0) {
  console.error('판결문 프롬프트 검사 실패:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log(`판결문 프롬프트 검사 통과 (프롬프트 ${prompt.length}자, 금지 ${limitCount}개, 출력 상한 ${capTotal}자)`);
