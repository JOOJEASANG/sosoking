import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const gameShare = read('public/game/chosung/chosung.js');
const gameIndex = read('public/game/chosung/index.html');
const courtIndex = read('public/index.html');
const resultShare = read('public/js/result-link-share.js');
const sw = read('public/sw.js');

for (const required of [
  'async function shareRoom()',
  'navigator.share',
  'navigator.clipboard.writeText(url)',
  "${location.origin}/game/chosung/?room=${encodeURIComponent(roomId)}",
  "title: '소소킹 초성 폭탄 초대'",
  '카카오톡에 붙여넣어 주세요.',
  "window.prompt('이 링크를 복사해 카카오톡으로 보내주세요.'"
]) {
  assert.ok(gameShare.includes(required), `게임소 초대 공유 흐름 누락: ${required}`);
}
assert.ok(gameIndex.includes('id="share-room"'), '초성 폭탄 화면에 초대 공유 버튼이 있어야 합니다.');
assert.ok(!gameShare.includes('new MutationObserver'), '게임 초대 공유 흐름은 전역 DOM observer에 의존하면 안 됩니다.');

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

console.log('Share link validation passed: game rooms can be invited by mobile share/copy link and court verdicts can be published and shared by link.');
