'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const {
  extractCaseId,
  normalizePublicResult,
  renderPublicResultHtml,
  renderSitemapXml,
  publicResultUrl,
  normalizeTagParam,
  renderTagPageHtml,
  tagPageUrl
} = require('./public-seo');

const db = getFirestore();
const REGION = 'asia-northeast3';
const SITEMAP_RESULT_LIMIT = 5000;
const TAG_RESULT_LIMIT = 60;

function isSanitizedPublicResult(raw = {}) {
  return raw.isPublic === true
    && Number(raw.publicDataVersion || 0) === 1
    && !Object.prototype.hasOwnProperty.call(raw, 'userId')
    && !Object.prototype.hasOwnProperty.call(raw, 'caseDescription')
    && !Object.prototype.hasOwnProperty.call(raw, 'nickname');
}

function normalizeSafePublicResult(caseId, raw = {}) {
  return normalizePublicResult(caseId, {
    ...raw,
    caseDescription: String(raw.publicCaseDescription || '')
  });
}

function timestampMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isoDay(value) {
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : '';
  } catch {
    return '';
  }
}

async function loadSafePublicResult(caseId) {
  const snapshot = await db.doc(`results/${caseId}`).get();
  if (!snapshot.exists) return null;
  const raw = snapshot.data() || {};
  if (!isSanitizedPublicResult(raw)) return null;
  return normalizeSafePublicResult(caseId, raw);
}

function safePublicResultsQuery() {
  return db.collection('results')
    .where('isPublic', '==', true)
    .where('publicDataVersion', '==', 1);
}

async function listSafePublicResultEntries() {
  let snapshot;
  try {
    snapshot = await safePublicResultsQuery()
      .orderBy('createdAt', 'desc')
      .limit(SITEMAP_RESULT_LIMIT)
      .get();
  } catch (error) {
    console.warn('ordered safe public sitemap query failed; retrying without ordering:', error?.code || error);
    snapshot = await safePublicResultsQuery()
      .limit(SITEMAP_RESULT_LIMIT)
      .get();
  }

  return snapshot.docs
    .filter(document => isSanitizedPublicResult(document.data() || {}))
    .map(document => ({
      caseId: document.id,
      lastmod: isoDay(document.data()?.updatedAt || document.data()?.createdAt)
    }));
}

async function loadSafeTaggedResults(tag) {
  const normalizedTag = normalizeTagParam(tag);
  if (!normalizedTag) return [];

  const snapshot = await db.collection('results')
    .where('isPublic', '==', true)
    .where('tags', 'array-contains', normalizedTag)
    .limit(TAG_RESULT_LIMIT)
    .get();

  return snapshot.docs
    .filter(document => isSanitizedPublicResult(document.data() || {}))
    .map(document => {
      const raw = document.data() || {};
      return {
        ...normalizeSafePublicResult(document.id, raw),
        createdAtMillis: timestampMillis(raw.updatedAt || raw.createdAt)
      };
    })
    .sort((a, b) => b.createdAtMillis - a.createdAtMillis);
}

async function listSafePublicTagEntries() {
  let snapshot;
  try {
    snapshot = await safePublicResultsQuery()
      .orderBy('createdAt', 'desc')
      .limit(SITEMAP_RESULT_LIMIT)
      .get();
  } catch (error) {
    console.warn('ordered safe public tag query failed; retrying without ordering:', error?.code || error);
    snapshot = await safePublicResultsQuery()
      .limit(SITEMAP_RESULT_LIMIT)
      .get();
  }

  const seen = new Map();
  for (const document of snapshot.docs) {
    const raw = document.data() || {};
    if (!isSanitizedPublicResult(raw)) continue;
    const normalized = normalizeSafePublicResult(document.id, raw);
    const lastmod = isoDay(raw.updatedAt || raw.createdAt);
    for (const tag of normalized.tags || []) {
      if (!seen.has(tag) || lastmod > seen.get(tag)) seen.set(tag, lastmod);
    }
  }
  return [...seen.entries()].map(([tag, lastmod]) => ({ tag, lastmod }));
}

function renderNotFoundHtml() {
  return '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>공개 판결문을 찾을 수 없습니다 | 소소킹 판결소</title></head><body style="margin:0;background:#f6efe2;color:#2d241a;font-family:Arial,sans-serif;text-align:center;padding:80px 20px"><h1>공개 판결문을 찾을 수 없습니다</h1><p>비공개이거나 공개 데이터 정리가 완료되지 않은 사건일 수 있습니다.</p><p><a href="/board">공개 판결기록으로 이동</a></p></body></html>';
}

function allowReadMethod(request, response) {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  response.set('Allow', 'GET, HEAD').status(405).send('Method Not Allowed');
  return false;
}

exports.publicResultPage = onRequest({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 20
}, async (request, response) => {
  if (!allowReadMethod(request, response)) return;
  const caseId = extractCaseId(request);
  if (!caseId) {
    response.set('X-Robots-Tag', 'noindex, nofollow').status(404).send(renderNotFoundHtml());
    return;
  }

  try {
    const result = await loadSafePublicResult(caseId);
    if (!result) {
      response
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('Cache-Control', 'public, max-age=0, s-maxage=60')
        .set('X-Robots-Tag', 'noindex, nofollow')
        .status(404)
        .send(renderNotFoundHtml());
      return;
    }

    const canonical = publicResultUrl(caseId);
    response
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400')
      .set('X-Robots-Tag', 'index, follow, max-snippet:-1, max-image-preview:large')
      .set('Link', `<${canonical}>; rel="canonical"`)
      .set('Vary', 'Accept-Encoding')
      .status(200)
      .send(renderPublicResultHtml(result));
  } catch (error) {
    console.error('safe public result page failed:', { caseId, code: error?.code || '', message: error?.message || '' });
    response
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'no-store')
      .set('X-Robots-Tag', 'noindex, nofollow')
      .status(500)
      .send(renderNotFoundHtml());
  }
});

function extractTagParam(request) {
  const path = String(request.path || request.url || '');
  const match = path.match(/\/tag\/([^/?#]+)/);
  return normalizeTagParam(match ? match[1] : '');
}

exports.publicTagPage = onRequest({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 10
}, async (request, response) => {
  if (!allowReadMethod(request, response)) return;
  const tag = extractTagParam(request);
  if (!tag) {
    response.set('X-Robots-Tag', 'noindex, nofollow').status(404).send(renderNotFoundHtml());
    return;
  }
  try {
    const items = await loadSafeTaggedResults(tag);
    const canonical = tagPageUrl(tag);
    response
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=86400')
      // 결과가 있을 때만 색인. 빈 태그 페이지가 검색에 뜨는 것을 막는다.
      .set('X-Robots-Tag', items.length ? 'index, follow, max-snippet:-1' : 'noindex, follow')
      .set('Link', `<${canonical}>; rel="canonical"`)
      .set('Vary', 'Accept-Encoding')
      .status(items.length ? 200 : 404)
      .send(renderTagPageHtml(tag, items));
  } catch (error) {
    console.error('public tag page failed:', { tag, code: error?.code || '', message: error?.message || '' });
    response
      .set('Content-Type', 'text/html; charset=utf-8')
      .set('Cache-Control', 'no-store')
      .set('X-Robots-Tag', 'noindex, nofollow')
      .status(500)
      .send(renderNotFoundHtml());
  }
});

exports.publicSitemap = onRequest({
  region: REGION,
  timeoutSeconds: 30,
  memory: '256MiB',
  maxInstances: 5
}, async (request, response) => {
  if (!allowReadMethod(request, response)) return;
  try {
    const [entries, tagEntries] = await Promise.all([
      listSafePublicResultEntries(),
      listSafePublicTagEntries().catch(() => [])
    ]);
    response
      .set('Content-Type', 'application/xml; charset=utf-8')
      .set('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=86400')
      .set('X-Robots-Tag', 'noindex')
      .set('Vary', 'Accept-Encoding')
      .status(200)
      .send(renderSitemapXml(entries, tagEntries));
  } catch (error) {
    console.error('safe public sitemap failed:', { code: error?.code || '', message: error?.message || '' });
    response.status(503).set('Retry-After', '300').send('Sitemap temporarily unavailable');
  }
});

Object.defineProperties(module.exports, {
  isSanitizedPublicResult: { value: isSanitizedPublicResult, enumerable: false },
  loadSafePublicResult: { value: loadSafePublicResult, enumerable: false },
  listSafePublicResultEntries: { value: listSafePublicResultEntries, enumerable: false },
  loadSafeTaggedResults: { value: loadSafeTaggedResults, enumerable: false },
  listSafePublicTagEntries: { value: listSafePublicTagEntries, enumerable: false },
  normalizeSafePublicResult: { value: normalizeSafePublicResult, enumerable: false }
});