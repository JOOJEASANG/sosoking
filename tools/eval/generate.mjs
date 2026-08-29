// 프롬프트를 바꿀 때마다 같은 사건 20개를 돌려 결과를 나란히 읽기 위한 도구.
//
// 이 서비스는 결과물의 재미가 곧 제품이다. 그런데 재미는 자동으로 측정할 수 없다.
// 그래서 이 스크립트는 판정하지 않고, 사람이 읽고 비교할 수 있는 파일만 만든다.
//
// 사용법:
//   GEMINI_API_KEY=... node tools/eval/generate.mjs [모델명] [사건개수]
// 결과:
//   tools/eval/out/<모델명>-<타임스탬프>.md

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildPrompt, JUDGES } = require('../../functions/verdict-prompt.js');

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error('GEMINI_API_KEY 환경변수가 필요합니다.');
  process.exit(1);
}

const model = process.argv[2] || 'gemini-2.5-pro';
const count = Number(process.argv[3]) || 5;
const cases = JSON.parse(fs.readFileSync(new URL('./cases.json', import.meta.url), 'utf8')).slice(0, count);

const SCHEMA = {
  type: 'object',
  properties: {
    caseTitle: { type: 'string' },
    winner: { type: 'string' },
    reception: { type: 'string' },
    investigation: { type: 'string' },
    plaintiffArg: { type: 'string' },
    defendantArg: { type: 'string' },
    verdict: { type: 'string' }
  },
  required: ['caseTitle', 'winner', 'reception', 'investigation', 'plaintiffArg', 'defendantArg', 'verdict']
};

async function generate(description, judge, grievance) {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildPrompt(description, judge, grievance) }] }],
        generationConfig: {
          temperature: 0.9,
          topP: 0.95,
          maxOutputTokens: 4096,
          responseMimeType: 'application/json',
          responseSchema: SCHEMA
        }
      })
    }
  );
  if (!response.ok) throw new Error(`${model} 호출 실패: HTTP ${response.status}`);
  const payload = await response.json();
  const text = payload?.candidates?.[0]?.content?.parts?.map(part => part.text).join('') || '';
  return JSON.parse(text);
}

const outDir = new URL('./out/', import.meta.url);
fs.mkdirSync(outDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outPath = path.join(outDir.pathname, `${model}-${stamp}.md`);

const sections = [`# 판결문 평가 — ${model}`, '', `생성 시각: ${new Date().toISOString()}`, `사건 수: ${cases.length}`, ''];

for (const [index, description] of cases.entries()) {
  const judge = JUDGES[index % JUDGES.length];
  const grievance = (index % 10) + 1;
  process.stdout.write(`[${index + 1}/${cases.length}] ${judge.type} … `);
  try {
    const result = await generate(description, judge, grievance);
    console.log('완료');
    sections.push(
      `## ${index + 1}. ${result.caseTitle}`, '',
      `- 입력: ${description}`,
      `- 판사: ${judge.type} ${judge.icon}`,
      `- 승패: ${result.winner}`,
      `- 분량: ${[result.reception, result.investigation, result.plaintiffArg, result.defendantArg, result.verdict].join('').length}자`,
      '',
      '### 사건접수', result.reception, '',
      '### 수사보고', result.investigation, '',
      '### 원고측 변론', result.plaintiffArg, '',
      '### 피고측 변론', result.defendantArg, '',
      '### 재판부 판결', result.verdict, '',
      '---', ''
    );
  } catch (error) {
    console.log('실패');
    sections.push(`## ${index + 1}. (생성 실패)`, '', `- 입력: ${description}`, `- 오류: ${error.message}`, '', '---', '');
  }
}

fs.writeFileSync(outPath, sections.join('\n'), 'utf8');
console.log(`\n결과 저장: ${outPath}`);
console.log('두 모델을 비교하려면 모델명을 바꿔 한 번 더 실행한 뒤 두 파일을 나란히 읽으세요.');
