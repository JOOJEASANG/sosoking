import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = file => fs.readFileSync(file, 'utf8');
for (const file of [
  'public/dripso/theme.css',
  'public/dripso/theme.js',
  'public/js/theme-init.js',
  'public/js/components/theme.js'
]) assert.ok(fs.existsSync(file), `드립소 테마 필수 파일 누락: ${file}`);

const html = read('public/dripso/index.html');
const themeCss = read('public/dripso/theme.css');
const themeModule = read('public/dripso/theme.js');
const themeInit = read('public/js/theme-init.js');
const sharedTheme = read('public/js/components/theme.js');
const worker = read('public/sw.js');

const initAsset = '/js/theme-init.js?v=20260729-script-csp-1';
const cssAsset = '/dripso/theme.css?v=20260806-dripso-shared-theme-1';
const jsAsset = '/dripso/theme.js?v=20260806-dripso-shared-theme-1';
for (const asset of [initAsset, cssAsset, jsAsset]) {
  assert.ok(html.includes(asset), `드립소 테마 HTML 연결 누락: ${asset}`);
  assert.ok(worker.includes(`'${asset}'`), `드립소 테마 캐시 연결 누락: ${asset}`);
}
assert.ok(html.indexOf(initAsset) < html.indexOf('/dripso/dripso.css'), '초기 테마 스크립트는 CSS보다 먼저 실행되어야 합니다.');

for (const required of [
  "localStorage.getItem('theme')",
  "saved === 'light' || saved === 'dark' || saved === 'system'",
  "document.documentElement.setAttribute('data-theme', resolved)",
  "document.documentElement.setAttribute('data-theme-choice', saved)"
]) assert.ok(themeInit.includes(required), `공통 초기 테마 계약 누락: ${required}`);

for (const required of [
  "localStorage.setItem('theme', value)",
  "window.matchMedia?.('(prefers-color-scheme: light)')",
  "window.dispatchEvent(new CustomEvent('sosoking:themechange'",
  'export function renderThemeToggle()'
]) assert.ok(sharedTheme.includes(required), `공통 테마 모듈 계약 누락: ${required}`);

for (const required of [
  "import { initTheme, renderThemeToggle }",
  "from '/js/components/theme.js?v=20260729-theme-global-2'",
  'initTheme();',
  'renderThemeToggle();',
  "window.addEventListener('sosoking:themechange', syncBrowserThemeColor)",
  "theme === 'light' ? '#f8f5fb' : '#17121f'"
]) assert.ok(themeModule.includes(required), `드립소 테마 실행 누락: ${required}`);

for (const required of [
  "[data-theme='light']",
  '--bg: #f8f5fb',
  '--panel: #fffdfd',
  '--text: #2b2230',
  "[data-theme='light'] body",
  "[data-theme='light'] .site-header",
  "[data-theme='light'] .hero-card",
  "[data-theme='light'] .battle-duel-choice",
  "[data-theme='light'] .tournament-phase.final",
  "[data-theme='light'] .dripso-bottom-nav",
  "[data-theme='light'] .topic-dialog",
  "[data-theme='light'] .theme-toggle"
]) assert.ok(themeCss.includes(required), `드립소 라이트 테마 스타일 누락: ${required}`);

console.log('Dripso theme validation passed: court and Dripso share one stored system/light/dark preference with pre-paint initialization, a common toggle, complete light surfaces, and offline assets.');
