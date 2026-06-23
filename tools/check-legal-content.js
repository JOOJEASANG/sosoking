'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const terms = fs.readFileSync(path.join(ROOT, 'public/js/pages/terms.js'), 'utf8');
const privacy = fs.readFileSync(path.join(ROOT, 'public/js/pages/privacy.js'), 'utf8');
const errors = [];

for (const phrase of ['AI 캐릭터 놀이터', '전문적인 판단을 대신하지 않습니다', '개인 AI 결과']) {
  if (!terms.includes(phrase)) errors.push(`terms missing: ${phrase}`);
}

for (const phrase of ['개인 AI 결과', '최근 50개', '회원 탈퇴하면 삭제', '관리형 비밀 저장소']) {
  if (!privacy.includes(phrase)) errors.push(`privacy missing: ${phrase}`);
}

if (!terms.includes('2026년 6월 23일') || !privacy.includes('2026년 6월 23일')) {
  errors.push('legal effective date is not synchronized');
}

if (errors.length) {
  console.error('Legal content check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Legal content check passed.');
