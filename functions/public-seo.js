'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const SITE_ORIGIN = 'https://sosoking.co.kr';
const RESULT_ID_PATTERN = /^[A-Za-z0-9_-]{1,180}$/;
const SITEMAP_RESULT_LIMIT = 5000;

function htmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function xmlEscape(value) {
  return htmlEscape(value);
}

function cleanText(value, maxLength = 12000) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function compactText(value, maxLength = 160) {
  const text = cleanText(value, Math.max(maxLength * 3, maxLength))
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function safeDate(value) {
  try {
    const date = value?.toDate ? value.toDate() : new Date(value);
    return Number.isFinite(date.getTime()) ? date : null;
  } catch {
    return null;
  }
}

function isoDate(value) {
  const date = safeDate(value);
  return date ? date.toISOString() : '';
}

function isoDay(value) {
  const date = safeDate(value);
  return date ? date.toISOString().slice(0, 10) : '';
}

function publicResultUrl(caseId) {
  return `${SITE_ORIGIN}/result/${encodeURIComponent(caseId)}`;
}

function extractCaseId(request) {
  const rawUrl = String(request?.originalUrl || request?.url || request?.path || '');
  let pathname = '';
  try {
    pathname = new URL(rawUrl, SITE_ORIGIN).pathname;
  } catch {
    pathname = String(request?.path || '');
  }

  const match = pathname.match(/\/result\/([^/?#]+)\/?$/);
  if (!match) return '';

  let decoded = '';
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    return '';
  }
  return RESULT_ID_PATTERN.test(decoded) ? decoded : '';
}

function jsonLdScript(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
}

function sectionMarkup(title, content) {
  const text = cleanText(content);
  if (!text) return '';
  return `<section class="document-section"><h2>${htmlEscape(title)}</h2><div class="document-body">${htmlEscape(text)}</div></section>`;
}

function normalizePublicResult(caseId, raw = {}) {
  const caseTitle = cleanText(raw.caseTitle, 140) || '생활분쟁 사건';
  const caseDescription = cleanText(raw.caseDescription, 6000);
  const verdict = cleanText(raw.verdict, 12000);
  const description = compactText(
    caseDescription || raw.sentence || verdict || raw.reception || `${caseTitle}에 대한 소소킹 AI 생활판결 기록입니다.`,
    170
  );

  return {
    caseId,
    caseTitle,
    caseDescription,
    description,
    docketNumber: cleanText(raw.docketNumber, 120),
    judgeType: cleanText(raw.judgeType, 80) || '소소킹 AI 재판부',
    judgeIcon: cleanText(raw.judgeIcon, 12) || '⚖️',
    grievanceIndex: Math.max(1, Math.min(10, Number(raw.grievanceIndex) || 5)),
    reception: cleanText(raw.reception),
    investigation: cleanText(raw.investigation),
    plaintiffArg: cleanText(raw.plaintiffArg),
    defendantArg: cleanText(raw.defendantArg),
    verdict,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt || raw.createdAt
  };
}

async function loadPublicResult(caseId) {
  if (!RESULT_ID_PATTERN.test(String(caseId || ''))) return null;
  const snapshot = await db.doc(`results/${caseId}`).get();
  if (!snapshot.exists) return null;
  const raw = snapshot.data() || {};
  if (raw.isPublic !== true) return null;
  return normalizePublicResult(caseId, raw);
}

function renderPublicResultHtml(result) {
  const canonical = publicResultUrl(result.caseId);
  const pageTitle = `${result.caseTitle} | 소소킹 판결소`;
  const published = isoDate(result.createdAt);
  const modified = isoDate(result.updatedAt) || published;
  const appUrl = `${SITE_ORIGIN}/#/result/${encodeURIComponent(result.caseId)}`;
  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: result.caseTitle,
    headline: result.caseTitle,
    description: result.description,
    url: canonical,
    mainEntityOfPage: canonical,
    inLanguage: 'ko-KR',
    genre: 'AI 오락 생활판결문',
    isAccessibleForFree: true,
    datePublished: published || undefined,
    dateModified: modified || undefined,
    author: { '@type': 'Organization', name: '소소킹 판결소', url: SITE_ORIGIN },
    publisher: {
      '@type': 'Organization',
      name: '소소킹 판결소',
      url: SITE_ORIGIN,
      logo: { '@type': 'ImageObject', url: `${SITE_ORIGIN}/logo.png` }
    }
  };

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${htmlEscape(pageTitle)}</title>
  <meta name="description" content="${htmlEscape(result.description)}">
  <meta name="robots" content="index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1">
  <link rel="canonical" href="${htmlEscape(canonical)}">
  <link rel="icon" href="/icons/favicon-48.png" type="image/png">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="소소킹 판결소">
  <meta property="og:title" content="${htmlEscape(result.caseTitle)}">
  <meta property="og:description" content="${htmlEscape(result.description)}">
  <meta property="og:url" content="${htmlEscape(canonical)}">
  <meta property="og:image" content="${SITE_ORIGIN}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${htmlEscape(result.caseTitle)}">
  <meta name="twitter:description" content="${htmlEscape(result.description)}">
  <meta name="twitter:image" content="${SITE_ORIGIN}/og-image.png">
  <script type="application/ld+json">${jsonLdScript(structuredData)}</script>
  <style>
    :root{color-scheme:light;--ink:#2d241a;--muted:#6e6255;--gold:#9a6a13;--line:#dfd1b6;--paper:#fffdf8;--cream:#f6efe2}
    *{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#fbf7ef,#f1e7d5);color:var(--ink);font-family:Arial,'Noto Sans KR',sans-serif;line-height:1.75}
    a{color:inherit}.site-header{border-bottom:1px solid var(--line);background:rgba(255,253,248,.94);position:sticky;top:0;z-index:2}.site-header-inner{max-width:760px;margin:auto;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px}.brand{display:flex;align-items:center;gap:9px;text-decoration:none;font-weight:900;color:#745315}.brand img{width:38px;height:38px;object-fit:contain}.header-link{font-size:13px;text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:7px 12px;background:#fffaf0}
    main{max-width:760px;margin:0 auto;padding:26px 16px 48px}.cover,.document-section{background:var(--paper);border:1px solid var(--line);border-radius:22px;box-shadow:0 12px 28px rgba(91,66,29,.08)}.cover{padding:30px 24px;text-align:center}.court-name{font-size:11px;letter-spacing:.14em;font-weight:900;color:var(--gold)}h1{font-family:Georgia,'Noto Serif KR',serif;font-size:30px;line-height:1.4;margin:12px 0 8px;word-break:keep-all}.summary{color:var(--muted);font-size:14px;margin:0 auto;max-width:620px}.meta{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:18px}.chip{border:1px solid var(--line);background:var(--cream);border-radius:999px;padding:7px 11px;font-size:12px;color:#654b24;font-weight:800}
    .case-description{margin-top:16px;padding:18px 20px;text-align:left;background:#fffaf0;border:1px solid var(--line);border-radius:16px;white-space:pre-wrap;word-break:keep-all}.documents{display:flex;flex-direction:column;gap:14px;margin-top:18px}.document-section{padding:24px}.document-section h2{font-family:Georgia,'Noto Serif KR',serif;margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid var(--line);font-size:21px;color:#4a3518}.document-body{white-space:pre-wrap;overflow-wrap:anywhere;word-break:keep-all;font-family:Georgia,'Noto Serif KR',serif;font-size:15px;color:#352f29}.notice{margin:18px 0;padding:14px 16px;border:1px solid #e0c9a3;border-radius:14px;background:#fff8e9;color:#6e5938;font-size:12px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.button{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:14px;text-decoration:none;font-weight:900;border:1px solid var(--line);background:#fffaf0}.button.primary{background:linear-gradient(135deg,#d7aa3d,#f0cf70);color:#231c13;border-color:#c6972f}
    footer{padding:24px 16px 110px;text-align:center;color:var(--muted);font-size:12px}@media(max-width:560px){h1{font-size:25px}.cover{padding:25px 18px}.document-section{padding:21px 18px}.actions{grid-template-columns:1fr}.site-header-inner{padding:10px 14px}}
  </style>
</head>
<body>
  <header class="site-header"><div class="site-header-inner"><a class="brand" href="${SITE_ORIGIN}/"><img src="/logo.png" alt=""><span>소소킹 판결소</span></a><a class="header-link" href="${SITE_ORIGIN}/board">공개 판결기록</a></div></header>
  <main>
    <article>
      <header class="cover">
        <div class="court-name">소소킹 판결소 · 공개 생활판결 기록</div>
        <h1>${htmlEscape(result.caseTitle)}</h1>
        <p class="summary">${htmlEscape(result.description)}</p>
        <div class="meta">
          ${result.docketNumber ? `<span class="chip">사건번호 ${htmlEscape(result.docketNumber)}</span>` : ''}
          <span class="chip">${htmlEscape(result.judgeIcon)} ${htmlEscape(result.judgeType)} 판사</span>
          <span class="chip">억울지수 ${result.grievanceIndex}/10</span>
        </div>
        ${result.caseDescription ? `<div class="case-description"><strong>접수 내용</strong>\n${htmlEscape(result.caseDescription)}</div>` : ''}
      </header>
      <div class="documents">
        ${sectionMarkup('사건접수', result.reception)}
        ${sectionMarkup('수사보고', result.investigation)}
        ${sectionMarkup('원고측 변론', result.plaintiffArg)}
        ${sectionMarkup('피고측 변론', result.defendantArg)}
        ${sectionMarkup('재판부 판결', result.verdict)}
      </div>
      <div class="notice">이 판결문은 AI가 실제 문서 형식을 흉내 내어 만든 오락 콘텐츠이며 법적 효력이 없습니다.</div>
      <div class="actions"><a class="button primary" href="${htmlEscape(appUrl)}">투표·댓글 참여하기</a><a class="button" href="${SITE_ORIGIN}/submit">새 사건 접수하기</a></div>
    </article>
  </main>
  <footer>© 소소킹 판결소 · 사소한 생활분쟁을 과하게 진지하게 심리합니다.</footer>
</body>
</html>`;
}

function renderNotFoundHtml() {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>공개 판결문을 찾을 수 없습니다 | 소소킹 판결소</title></head><body style="margin:0;background:#f6efe2;color:#2d241a;font-family:Arial,sans-serif;text-align:center;padding:80px 20px"><h1>공개 판결문을 찾을 수 없습니다</h1><p>비공개로 전환되었거나 삭제된 사건일 수 있습니다.</p><p><a href="/board">공개 판결기록으로 이동</a></p></body></html>`;
}

async function listPublicResultEntries() {
  let snapshot;
  try {
    snapshot = await db.collection('results')
      .where('isPublic', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(SITEMAP_RESULT_LIMIT)
      .get();
  } catch (error) {
    console.warn('ordered public sitemap query failed; retrying without ordering:', error?.code || error);
    snapshot = await db.collection('results')
      .where('isPublic', '==', true)
      .limit(SITEMAP_RESULT_LIMIT)
      .get();
  }

  return snapshot.docs
    .filter(document => RESULT_ID_PATTERN.test(document.id))
    .map(document => ({
      caseId: document.id,
      lastmod: isoDay(document.data()?.updatedAt || document.data()?.createdAt)
    }));
}

function renderSitemapXml(entries) {
  const staticUrls = [
    { loc: `${SITE_ORIGIN}/` },
    { loc: `${SITE_ORIGIN}/board` },
    { loc: `${SITE_ORIGIN}/submit` },
    { loc: `${SITE_ORIGIN}/guide` }
  ];
  const resultUrls = entries.map(entry => ({
    loc: publicResultUrl(entry.caseId),
    lastmod: entry.lastmod || ''
  }));
  const rows = [...staticUrls, ...resultUrls].map(entry => `  <url>\n    <loc>${xmlEscape(entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : ''}\n  </url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows}\n</urlset>\n`;
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
    const result = await loadPublicResult(caseId);
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
    console.error('public result page failed:', { caseId, code: error?.code || '', message: error?.message || '' });
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
    const entries = await listPublicResultEntries();
    response
      .set('Content-Type', 'application/xml; charset=utf-8')
      .set('Cache-Control', 'public, max-age=0, s-maxage=900, stale-while-revalidate=86400')
      .set('X-Robots-Tag', 'noindex')
      .set('Vary', 'Accept-Encoding')
      .status(200)
      .send(renderSitemapXml(entries));
  } catch (error) {
    console.error('public sitemap failed:', { code: error?.code || '', message: error?.message || '' });
    response.status(503).set('Retry-After', '300').send('Sitemap temporarily unavailable');
  }
});

Object.defineProperties(module.exports, {
  extractCaseId: { value: extractCaseId, enumerable: false },
  normalizePublicResult: { value: normalizePublicResult, enumerable: false },
  renderPublicResultHtml: { value: renderPublicResultHtml, enumerable: false },
  renderSitemapXml: { value: renderSitemapXml, enumerable: false },
  loadPublicResult: { value: loadPublicResult, enumerable: false },
  listPublicResultEntries: { value: listPublicResultEntries, enumerable: false },
  publicResultUrl: { value: publicResultUrl, enumerable: false }
});
