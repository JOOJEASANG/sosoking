import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(path.join(process.cwd(), 'functions', 'package.json'));
const { publicSanitizationPatch, safePublicCaseDescription, safePublicNickname } = require('./public-result-sanitizer.js');

test('non-public documents produce no patch', () => {
  assert.equal(publicSanitizationPatch({ isPublic: false, userId: 'u1' }), null);
  assert.equal(publicSanitizationPatch({}), null);
});

test('public documents drop sensitive fields and re-sanitize projections', () => {
  const patch = publicSanitizationPatch({
    isPublic: true,
    userId: 'uid-123',
    caseDescription: '원문 그대로의 민감한 내용',
    nickname: '실제닉네임',
    publicCaseDescription: '연락처 010-1234-5678 남겨요.', // unsafe -> stripped
    publicNickname: '   ', // blank -> fallback
    publicDataVersion: 0
  });

  assert.ok(patch, 'expected a patch');
  // Sensitive fields must be scheduled for deletion.
  assert.ok('userId' in patch);
  assert.ok('caseDescription' in patch);
  assert.ok('nickname' in patch);
  // Unsafe/blank projections are corrected, version normalized to 1.
  assert.equal(patch.publicCaseDescription, '');
  assert.equal(patch.publicNickname, '익명 원고');
  assert.equal(patch.publicDataVersion, 1);
});

test('a public document that is already clean produces no patch', () => {
  // The patch is a diff: unchanged, already-safe fields are omitted.
  const patch = publicSanitizationPatch({
    isPublic: true,
    publicCaseDescription: '평범한 사건입니다.',
    publicNickname: '치킨피해자',
    publicDataVersion: 1
  });
  assert.equal(patch, null);
});

test('safePublicCaseDescription keeps safe text and strips unsafe text', () => {
  assert.equal(safePublicCaseDescription('  평범한 사건 설명입니다.  '), '평범한 사건 설명입니다.');
  assert.equal(safePublicCaseDescription('연락처는 010-1234-5678 입니다.'), '');
  assert.equal(safePublicCaseDescription(''), '');
  assert.equal(safePublicCaseDescription(null), '');
});

test('safePublicCaseDescription truncates to 600 characters', () => {
  const long = '가'.repeat(700);
  assert.equal(safePublicCaseDescription(long).length, 600);
});

test('safePublicNickname collapses whitespace and falls back when unsafe', () => {
  assert.equal(safePublicNickname('  치킨   피해자  '), '치킨 피해자');
  assert.equal(safePublicNickname(''), '익명 원고');
  assert.equal(safePublicNickname(null), '익명 원고');
  // PII is rejected even though nicknames allow high-risk words.
  assert.equal(safePublicNickname('010-1234-5678'), '익명 원고');
});

test('safePublicNickname truncates to 20 characters', () => {
  assert.equal(safePublicNickname('가'.repeat(50)).length, 20);
});
