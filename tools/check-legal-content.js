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
  'AI 캐릭터 판결·창작·상담',
  '전문적인 판단을 대신하지 않습니다',
  '회원이 직접 등록한 생활정보',
  '실제 A/B 투표 기록',
  '대표 이미지',
  '작성한 공개 콘텐츠와 업로드 파일을 삭제',
  '신고 우선순위 보조 AI',
]) {
  if (!terms.includes(phrase)) errors.push(`terms missing: ${phrase}`);
}

for (const phrase of [
  '개인 AI 결과',
  '최근 50개',
  '비회원에게도 공개될 수 있습니다',
  '회원 UID 경로',
  '전체 투표수·조회수',
  'Firebase Secret Manager',
  '관리자 처리 기록',
]) {
  if (!privacy.includes(phrase)) errors.push(`privacy missing: ${phrase}`);
}

for (const phrase of [
  '미친 상담소',
  '약 1.8MB 이하',
  '실제 현재 투표 기록',
  '매일 오전 7시 30분',
  '최근 50개',
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
  '자료에는 찬반투표나 댓글이 붙지 않습니다',
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
