import fs from 'node:fs';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';

const root = process.cwd();
const sourcePath = path.join(root, 'data', 'creative-cases-source.b64');
const outputPath = path.join(root, 'data', 'creative-cases-v1.b64');

const judges = [
  ['엄벌주의형', '👨‍⚖️', '작은 생활규칙 위반도 질서 파괴처럼 단호하고 엄숙하게 판단한다.'],
  ['감성형', '🥹', '서운함과 마음의 상처를 세심하게 살피며 따뜻한 비유를 사용한다.'],
  ['현실주의형', '🤦', '말보다 당장 실행할 수 있는 현실적인 생활 처분을 중시한다.'],
  ['과몰입형', '🔥', '평범한 생활분쟁도 대서사시처럼 극적으로 심리한다.'],
  ['피곤형', '😴', '한숨 섞인 문체를 쓰지만 핵심 쟁점과 책임은 정확히 짚는다.'],
  ['논리집착형', '🧮', '시간순서, 말의 모순, 사소한 단서를 집요하게 분석한다.'],
  ['드립형', '🎭', '문서 격식은 유지하면서 사건 맞춤형 비유와 드립을 적극 활용한다.']
];

function isoDate(offset) {
  const date = new Date(Date.UTC(2026, 3, 1 + offset));
  return date.toISOString().slice(0, 10);
}

function normalizeSentence(value) {
  const text = String(value || '').trim();
  if (!text) return '피고는 재발 방지 조치를 이행한다.';
  return /[.!?。]$/.test(text) ? text : `${text}.`;
}

function expand(row, index) {
  const [category, caseTitle, incident, evidence, excuse, remedy] = row;
  const [judgeType, judgeIcon, judgeStyle] = judges[index % judges.length];
  const number = index + 1;
  const plaintiff = '원고';
  const defendant = '피고';
  const caseDescription = `${plaintiff}는 ${incident}고 주장하며, ${defendant}의 해명에도 불구하고 생활상 선택권과 평온이 침해됐다고 호소했다.`;

  return {
    id: `seed_v1_${String(number).padStart(3, '0')}`,
    slug: `creative-case-${String(number).padStart(3, '0')}`,
    category,
    keywords: [category, '생활분쟁', 'AI 판결', caseTitle.replace(/ 사건$/, '')],
    publishedDate: isoDate(index),
    caseTitle,
    caseDescription,
    grievanceIndex: ((number * 7 + 3) % 10) + 1,
    nickname: '소소킹 창작재판부',
    judgeType,
    judgeIcon,
    judgeStyle,
    reception: `접수취지
${plaintiff}는 ${incident}며 본 생활법정에 판단을 구했다.

사건개요
확인된 핵심 정황은 ${evidence}이다. 당사자 사이의 문제는 금액보다 반복되는 불편과 설명 없는 행동에서 커졌다.

접수의견
본 건은 사소해 보이지만 일상의 신뢰와 순서를 흔든 사건이므로 정식 기록으로 접수한다.`,
    investigation: `확인 정황
조사 결과 ${evidence}이 확인됐다. 사건 전후 사정을 종합하면 원고의 불편이 단순한 기분 탓이라고 보기는 어렵다.

주요 증거
증거로는 ${evidence}, 당사자 대화 내용, 사건 직후의 반응을 채택한다.

조사관 의견
피고의 행동에는 일부 우연이 섞였을 수 있으나, 사후 정리나 설명이 부족해 분쟁이 확대된 것으로 판단한다.`,
    plaintiffArg: `청구취지
${plaintiff}는 재발 방지와 함께 다음 조치를 구한다. ${normalizeSentence(remedy)}

주장요지
원고는 사건 자체보다도 자신의 몫과 의사가 자연스럽게 생략된 점을 문제 삼는다. 작은 배려 한 번이면 끝날 일이 정식 사건번호를 받게 된 책임은 피고에게 있다고 주장한다.`,
    defendantArg: `답변취지
${defendant}는 고의적인 침해는 아니었다며 처분을 가볍게 정해 달라고 구한다.

항변요지
피고는 ${normalizeSentence(excuse)} 다만 사건 뒤 즉시 설명하거나 원상회복하지 못한 점은 인정한다.`,
    verdict: `주문
1. ${normalizeSentence(remedy)}
2. 피고는 같은 상황이 생기기 전에 원고의 의사를 먼저 확인한다.
3. 양측은 이 사건을 이후 말싸움의 무제한 재료로 사용하지 않는다.

판단이유
재판부는 ${evidence}을 핵심 자료로 본다. 피고의 해명도 일부 이해할 수 있으나, 생활공동체에서는 사소한 행동일수록 사전 확인과 사후 정리가 중요하다.

재판부 의견
${judgeStyle} 이번 사건은 거창한 법리가 아니라 한 번 묻고 한 번 정리했으면 끝났을 문제다. 따라서 위와 같이 생활형 처분을 선고한다.`,
    sentence: normalizeSentence(remedy)
  };
}

const compressed = Buffer.from(fs.readFileSync(sourcePath, 'utf8').trim(), 'base64');
const source = JSON.parse(gunzipSync(compressed).toString('utf8'));
if (!Array.isArray(source.rows) || source.rows.length < 120) {
  throw new Error(`Creative source rows are incomplete: ${source.rows?.length || 0}`);
}

const output = {
  version: source.version,
  generatedAt: source.generatedAt,
  cases: source.rows.map(expand)
};
const encoded = gzipSync(Buffer.from(JSON.stringify(output), 'utf8'), { level: 9, mtime: 0 }).toString('base64');
fs.writeFileSync(outputPath, encoded);
console.log(`Prepared ${output.cases.length} creative cases (${encoded.length} base64 chars).`);
