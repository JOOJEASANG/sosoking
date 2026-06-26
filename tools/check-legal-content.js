'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const terms = fs.readFileSync(path.join(ROOT, 'public/js/pages/terms.js'), 'utf8');
const privacy = fs.readFileSync(path.join(ROOT, 'public/js/pages/privacy.js'), 'utf8');
const guide = fs.readFileSync(path.join(ROOT, 'public/js/pages/guide.js'), 'utf8');
const readme = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const errors = [];

for (const phrase of [
  'AI 캐릭터 놀이터',
  '전문적인 판단을 대신하지 않습니다',
  '회원이 직접 등록한 자료',
  'A 또는 B를 선택',
  '대표 이미지',
  '회원 탈퇴 시 회원이 작성한 공개 콘텐츠와 업로드 파일은 삭제',
]) {
  if (!terms.includes(phrase)) errors.push(`terms missing: ${phrase}`);
}

for (const phrase of [
  '개인 AI 결과',
  '최근 50개',
  '자료실·토론실에 직접 등록한 글·댓글·이미지',
  '업로드한 이미지 파일을 삭제',
  '작성자를 식별하지 않는 전체 집계',
  '관리형 비밀 저장소',
]) {
  if (!privacy.includes(phrase)) errors.push(`privacy missing: ${phrase}`);
}

for (const phrase of [
  '미친 상담소',
  '이미지 자동 최적화',
  'A 또는 B를 먼저 선택',
]) {
  if (!guide.includes(phrase)) errors.push(`guide missing: ${phrase}`);
}

for (const phrase of [
  '회원 `createUserMaterial`',
  '회원 `createUserDebate`',
  '선택 입장 연동 댓글',
  '약 1.8MB 이하',
]) {
  if (!readme.includes(phrase)) errors.push(`README missing: ${phrase}`);
}

for (const retiredPhrase of [
  '자료 자체에는 찬반투표와 댓글 기능을 제공하지 않습니다',
  '찬반투표와 댓글 기능 없음',
  '공개 댓글은 대화 흐름 유지를 위해 작성자 정보를 익명 처리',
  '실제 역사·정치·사회 사건 자료',
]) {
  if (terms.includes(retiredPhrase) || privacy.includes(retiredPhrase) || guide.includes(retiredPhrase) || readme.includes(retiredPhrase)) {
    errors.push(`retired legal/service phrase remains: ${retiredPhrase}`);
  }
}

if (!terms.includes('2026년 6월 26일') || !privacy.includes('2026년 6월 26일')) {
  errors.push('legal effective date is not synchronized');
}

if (errors.length) {
  console.error('Legal content check failed:');
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Legal content check passed.');
