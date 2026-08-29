// 태그 기반 검색 노출 기능이 조용히 깨지지 않도록 지키는 검사.
//
// 태그는 (1) 생성·저장, (2) 결과 SEO 페이지 노출, (3) 태그 목록 페이지,
// (4) 사이트맵, (5) 라우팅·배포 다섯 곳이 맞물려야 동작한다. 하나만 빠져도
// 검색 유입이 죽으므로 연결 상태를 통째로 확인한다.

import fs from 'node:fs';

const errors = [];
const read = path => fs.readFileSync(path, 'utf8');

// 1. 생성·저장
const prompt = read('functions/verdict-prompt.js');
if (!prompt.includes('tags:') || !prompt.includes('검색어')) {
  errors.push('functions/verdict-prompt.js: 태그 출력 지시가 없습니다.');
}
const gen = read('functions/generate-trial-lite.js');
if (!gen.includes('function normalizeTags') || !gen.includes('tags: Array.isArray(data.tags)')) {
  errors.push('functions/generate-trial-lite.js: 태그 정규화·저장이 없습니다.');
}

// 2·3·4. SEO 페이지 + 태그 페이지 + 사이트맵
const seo = read('functions/public-seo.js');
for (const required of [
  'function normalizeTags',
  'function tagPageUrl',
  'function loadTaggedResults',
  'function renderTagPageHtml',
  'function listPublicTagEntries',
  'name="keywords"',
  'class="tag-chip"'
]) {
  if (!seo.includes(required)) errors.push(`functions/public-seo.js: ${required} 누락`);
}
if (!seo.includes("array-contains")) {
  errors.push('functions/public-seo.js: 태그 쿼리(array-contains)가 없습니다.');
}

const safe = read('functions/public-seo-safe.js');
if (!safe.includes('exports.publicTagPage') || !safe.includes('renderSitemapXml(entries, tagEntries)')) {
  errors.push('functions/public-seo-safe.js: publicTagPage 또는 사이트맵 태그 연결이 없습니다.');
}

// 5. 라우팅 + 배포 + 색인
const firebase = JSON.parse(read('firebase.json'));
const hasTagRewrite = (firebase.hosting.rewrites || []).some(
  r => r.source === '/tag/**' && r.function?.functionId === 'publicTagPage'
);
if (!hasTagRewrite) errors.push('firebase.json: /tag/** → publicTagPage 라우팅이 없습니다.');

const deploy = read('.github/workflows/firebase-deploy.yml');
if (!deploy.includes('functions:publicTagPage')) {
  errors.push('.github/workflows/firebase-deploy.yml: publicTagPage 배포 대상이 빠졌습니다.');
}

const indexes = JSON.parse(read('firestore.indexes.json'));
const hasTagIndex = (indexes.indexes || []).some(idx =>
  idx.collectionGroup === 'results'
  && idx.fields.some(f => f.fieldPath === 'tags' && f.arrayConfig === 'CONTAINS')
  && idx.fields.some(f => f.fieldPath === 'isPublic')
);
if (!hasTagIndex) errors.push('firestore.indexes.json: 태그 array-contains 색인이 없습니다.');

if (errors.length > 0) {
  console.error('태그 SEO 검사 실패:');
  for (const error of errors) console.error(` - ${error}`);
  process.exit(1);
}

console.log('태그 SEO 검사 통과: 생성·저장·SEO 페이지·태그 목록·사이트맵·라우팅·색인이 모두 연결되어 있습니다.');
