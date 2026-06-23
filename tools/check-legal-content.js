'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const terms = fs.readFileSync(path.join(ROOT, 'public/js/pages/terms.js'), 'utf8');
const privacy = fs.readFileSync(path.join(ROOT, 'public/js/pages/privacy.js'), 'utf8');
const errors = [];

for (const phrase of [
  'AI 캐릭터 놀이터',
  '전문적인 판단을 대신하지 않습니다',
  '개인 AI 결과',
  '자료실은 정보 열람 중심 공간',
  '토론실은 자료실과 별도로 운영',
  'AI가 하루 한 번 생성',
]) {
  if (!terms.includes(phrase)) errors.push(`terms missing: ${phrase}`);
}

for (const phrase of [
  '개인 AI 결과',
  '최근 50개',
  '회원 탈퇴하면 삭제',
  '관리형 비밀 저장소',
  '생활자료실',
  '독립 토론실',
  '일일 생활자료와 토론 주제 생성',
]) {
  if (!privacy.includes(phrase)) errors.push(`privacy missing: ${phrase}`);
}

for (const retiredPhrase of ['자료실의 찬반 투표', '공개된 자료에 찬반 투표']) {
  if (terms.includes(retiredPhrase) || privacy.includes(retiredPhrase)) errors.push(`retired legal phrase remains: ${retiredPhrase}`);
}

if (!terms.includes('2026년 6월 24일') || !privacy.includes('2026년 6월 24일')) {
  errors.push('legal effective date is not synchronized');
}

if (errors.length) {
  console.error('Legal content check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Legal content check passed.');
