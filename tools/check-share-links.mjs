import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const courtIndex = read('public/index.html');
const resultShare = read('public/js/result-link-share.js');
const sw = read('public/sw.js');

for (const required of [
  "httpsCallable(functions, 'setResultVisibility')",
  '🔗 결과 링크 공유',
  'navigator.share',
  'navigator.clipboard?.writeText',
  '링크로 공유하려면 이 판결을 판결기록에 공개해야 합니다.',
  "await setResultVisibility({ caseId, isPublic: true })",
  "${location.origin}/result/${encodeURIComponent(caseId)}",
  "new MutationObserver(schedule).observe(document.body"
]) assert.ok(resultShare.includes(required), `판결 결과 공유 흐름 누락: ${required}`);

const resultAsset = '/js/result-link-share.js?v=20260811-result-share-1';
assert.ok(courtIndex.includes(resultAsset), '판결 결과 공유 모듈이 판결소에 연결되어야 합니다.');
assert.ok(sw.includes(`'${resultAsset}'`), '판결 결과 공유 모듈이 service worker 캐시에 포함되어야 합니다.');

console.log('Share link validation passed: court verdicts can be published and shared by link.');
