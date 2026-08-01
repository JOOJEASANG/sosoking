import assert from 'node:assert/strict';
import fs from 'node:fs';

const nav = fs.readFileSync('public/js/components/nav.js', 'utf8');
const app = fs.readFileSync('public/js/app.js', 'utf8');
const index = fs.readFileSync('public/index.html', 'utf8');
const serviceWorker = fs.readFileSync('public/sw.js', 'utf8');

const dailyEntries = nav.match(/data-nav-key="daily-court"/g) || [];
assert.equal(dailyEntries.length, 1, '오늘재판 하단 메뉴 항목은 정확히 하나여야 합니다.');
assert.ok(nav.includes('<span class="nav-icon" aria-hidden="true">&#9878;</span>'), '오늘재판은 PC에서도 하나로 렌더링되는 단일 저울 문자를 사용해야 합니다.');
assert.ok(!nav.includes('🧑‍⚖️'), 'Windows에서 분리될 수 있는 판사 ZWJ 이모지는 사용하지 않아야 합니다.');
assert.ok(!nav.includes('\u200d'), '오늘재판 아이콘에 결합용 ZWJ 문자가 남아 있으면 안 됩니다.');

const navVersion = '20260801-pc-daily-icon-1';
const appVersion = '20260731-private-first-publication-1';
assert.ok(app.includes(`./components/nav.js?v=${navVersion}`), 'app.js가 수정된 하단 메뉴 버전을 불러와야 합니다.');
assert.ok(index.includes(`/js/app.js?v=${appVersion}`), 'index.html의 기존 private-first 앱 버전 계약을 유지해야 합니다.');
assert.ok(serviceWorker.includes(`/js/app.js?v=${appVersion}`), '서비스워커도 기존 활성 app.js 버전을 선행 캐시해야 합니다.');
assert.ok(serviceWorker.includes(`/js/components/nav.js?v=${navVersion}`), '서비스워커가 수정된 하단 메뉴 버전을 선행 캐시해야 합니다.');
assert.ok(serviceWorker.includes(`sosoking-app-v${navVersion}`), '서비스워커 캐시 이름은 아이콘 수정 버전으로 갱신되어야 합니다.');

console.log('PC daily-court navigation icon validation passed: one stable single-glyph icon and synchronized cache versions.');
