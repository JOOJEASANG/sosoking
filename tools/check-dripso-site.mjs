import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const errors = [];
const read = file => fs.readFileSync(file, 'utf8');
const requiredFiles = [
  'public/dripso/index.html',
  'public/dripso/dripso.css',
  'public/dripso/copy-helper.css',
  'public/dripso/dripso.js',
  'public/dripso/jokes.js'
];

for (const file of requiredFiles) {
  if (!fs.existsSync(file)) errors.push(`${file}: file is missing`);
}

if (!errors.length) {
  const html = read('public/dripso/index.html');
  const css = read('public/dripso/dripso.css');
  const copyCss = read('public/dripso/copy-helper.css');
  const app = read('public/dripso/dripso.js');
  const nav = read('public/js/components/nav.js');
  const brand = read('public/css/brand-logo.css');
  const index = read('public/index.html');
  const sw = read('public/sw.js');

  for (const required of [
    '<title>드립소 - 잠깐 웃고 가는 곳</title>',
    'http-equiv="Content-Security-Policy"',
    '/dripso/dripso.css?v=20260731-dripso-1',
    '/dripso/copy-helper.css?v=20260731-dripso-1',
    '/dripso/dripso.js?v=20260731-dripso-1',
    'id="random-joke"',
    'id="saved-toggle"',
    'id="joke-grid"',
    '소소킹 판결소로 돌아가기'
  ]) {
    if (!html.includes(required)) errors.push(`public/dripso/index.html: missing ${required}`);
  }

  if (/<script(?![^>]*\bsrc=)[^>]*>/i.test(html)) {
    errors.push('public/dripso/index.html: inline script must not be used');
  }
  if (/\son[a-z]+\s*=\s*["']/i.test(html)) {
    errors.push('public/dripso/index.html: inline event attributes must not be used');
  }

  for (const required of [
    '.joke-grid',
    '.spotlight',
    '@media (max-width: 580px)',
    '@media (prefers-reduced-motion: reduce)',
    'button:focus-visible',
    'env(safe-area-inset-bottom)'
  ]) {
    if (!css.includes(required)) errors.push(`public/dripso/dripso.css: missing ${required}`);
  }
  if (!copyCss.includes('.copy-helper') || !copyCss.includes('left: -10000px')) {
    errors.push('public/dripso/copy-helper.css: CSP-safe clipboard fallback style is missing');
  }

  for (const required of [
    "import { JOKES } from './jokes.js?v=20260731-dripso-1'",
    "'dripso.saved.v1'",
    "'dripso.laughs.v1'",
    'navigator.clipboard.writeText',
    'navigator.share',
    "area.className = 'copy-helper'",
    'renderSpotlight(dailyJoke())',
    "state.category === '전체'",
    "action === 'laugh'",
    "action === 'save'",
    "action === 'copy'"
  ]) {
    if (!app.includes(required)) errors.push(`public/dripso/dripso.js: missing ${required}`);
  }

  for (const forbidden of [
    'firebase',
    'firestore',
    'httpsCallable',
    'gemini',
    'generateContent',
    'innerHTML = joke',
    'eval(',
    'area.style.'
  ]) {
    if (app.toLowerCase().includes(forbidden.toLowerCase())) {
      errors.push(`public/dripso/dripso.js: standalone page contains forbidden dependency or unsafe pattern ${forbidden}`);
    }
  }

  if (!nav.includes('href="/dripso/"') || !nav.includes('>드립소</span>')) {
    errors.push('public/js/components/nav.js: Dripso primary navigation item is missing');
  }
  if (!brand.includes('flex: 1 1 16.666%')) {
    errors.push('public/css/brand-logo.css: six-column navigation width is missing');
  }
  if (!index.includes('/css/brand-logo.css?v=20260731-dripso-nav-1')) {
    errors.push('public/index.html: Dripso navigation stylesheet version is missing');
  }

  for (const required of [
    "const CACHE_NAME = 'sosoking-app-v20260731-dripso-2'",
    "'/dripso/index.html'",
    "'/dripso/dripso.css?v=20260731-dripso-1'",
    "'/dripso/copy-helper.css?v=20260731-dripso-1'",
    "'/dripso/dripso.js?v=20260731-dripso-1'",
    "'/dripso/jokes.js?v=20260731-dripso-1'",
    "url.pathname === '/dripso' || url.pathname.startsWith('/dripso/')",
    "networkFirst(request, '/dripso/index.html')"
  ]) {
    if (!sw.includes(required)) errors.push(`public/sw.js: Dripso cache or navigation integration missing ${required}`);
  }

  const moduleUrl = `${pathToFileURL(path.resolve('public/dripso/jokes.js')).href}?check=${Date.now()}`;
  const { JOKES } = await import(moduleUrl);
  if (!Array.isArray(JOKES) || JOKES.length < 50) {
    errors.push(`public/dripso/jokes.js: expected at least 50 original jokes, found ${JOKES?.length || 0}`);
  } else {
    const ids = new Set();
    const texts = new Set();
    const categories = new Set(['직장', '일상', '음식', '디지털', '관계']);
    for (const [index, joke] of JOKES.entries()) {
      if (!/^[a-z]+-\d{3}$/.test(String(joke.id || ''))) errors.push(`joke ${index + 1}: invalid id`);
      if (ids.has(joke.id)) errors.push(`joke ${index + 1}: duplicate id ${joke.id}`);
      if (texts.has(joke.text)) errors.push(`joke ${index + 1}: duplicate text`);
      if (!categories.has(joke.category)) errors.push(`joke ${index + 1}: invalid category ${joke.category}`);
      if (String(joke.text || '').trim().length < 15) errors.push(`joke ${index + 1}: text is too short`);
      ids.add(joke.id);
      texts.add(joke.text);
    }
  }
}

if (errors.length) {
  console.error(`Dripso validation failed (${errors.length})`);
  errors.forEach(error => console.error(`- ${error}`));
  process.exit(1);
}

console.log('Dripso validation passed: standalone page, 50 original jokes, local-only reactions and saves, responsive UI, secure external scripts, navigation, and offline routing.');
