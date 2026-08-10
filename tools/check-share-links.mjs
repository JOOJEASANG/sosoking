import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
const dripsoHtml = read('public/dripso/index.html');
const dripsoShare = read('public/dripso/two-games-share.js');
const official = read('functions/dripso-official.js');
const courtIndex = read('public/index.html');
const resultShare = read('public/js/result-link-share.js');
const sw = read('public/sw.js');

const options = [...dripsoHtml.matchAll(/<option value="([^"]+)"[^>]*>/g)].map(match => match[1]);
const modeOptions = options.filter(value => ['blank', 'naming', 'comeback', 'wrong', 'headline', 'excuse', 'manual'].includes(value));
assert.deepEqual(modeOptions, ['naming', 'wrong'], '드립소 경기 선택은 미친작명소와 오답제작소 두 종목만 노출되어야 합니다.');
assert.ok(dripsoHtml.includes('🤪 미친작명소'));
assert.ok(dripsoHtml.includes('💥 오답제작소'));

for (const required of [
  "const ACTIVE_MODES = Object.freeze({",
  "label: '미친작명소'",
  "label: '오답제작소'",
  "navigator.share",
  "navigator.clipboard?.writeText",
  "💬 카톡·친구 초대",
  "초대 링크를 복사했습니다. 카카오톡에 붙여넣어 보내주세요.",
  "${location.origin}/dripso/#/topic/${encodeURIComponent(topicId)}",
  "정답 쓰면 지는 게임. 오답으로 붙자.",
  "window.addEventListener('dripso:rendered', schedule)",
  "window.addEventListener('pageshow', schedule)"
]) assert.ok(dripsoShare.includes(required), `드립소 공유 흐름 누락: ${required}`);
assert.ok(!dripsoShare.includes('new MutationObserver'), '드립소 공유 보정기가 자기 DOM 변경을 다시 감지하는 전역 observer를 사용하면 안 됩니다.');

for (const required of [
  "const ACTIVE_MODES = new Set(['naming', 'wrong'])",
  'const ACTIVE_OFFICIAL_BATTLES = OFFICIAL_BATTLES.filter(item => ACTIVE_MODES.has(item.mode))',
  'selectedIndex = currentIndex % ACTIVE_OFFICIAL_BATTLES.length',
  'selected = ACTIVE_OFFICIAL_BATTLES[selectedIndex]'
]) assert.ok(official.includes(required), `관리자 공식 주제 2종 제한 누락: ${required}`);

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

for (const asset of [
  '/dripso/two-games-share.css?v=20260811-two-games-share-1',
  '/dripso/two-games-share.js?v=20260811-two-games-share-2'
]) {
  assert.ok(dripsoHtml.includes(asset), `드립소 공유 자산이 index에 없습니다: ${asset}`);
  assert.ok(sw.includes(`'${asset}'`), `드립소 공유 자산이 service worker에 없습니다: ${asset}`);
}
const resultAsset = '/js/result-link-share.js?v=20260811-result-share-1';
assert.ok(courtIndex.includes(resultAsset), '판결 결과 공유 모듈이 판결소에 연결되어야 합니다.');
assert.ok(sw.includes(`'${resultAsset}'`), '판결 결과 공유 모듈이 service worker 캐시에 포함되어야 합니다.');

console.log('Share link validation passed: Dripso exposes two signature games with friend invitations without recursive DOM observation, and court verdicts can be published and shared by link.');
