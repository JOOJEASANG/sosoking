'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const SITE_ORIGIN = 'https://sosoking.co.kr';
const ID_PATTERN = /^[A-Za-z0-9]{10,40}$/;
const SITEMAP_LIMIT = 5000;

function htmlEscape(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function cleanText(value, maxLength = 4000) {
  return String(value || '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function compactText(value, maxLength = 160) {
  const text = cleanText(value, Math.max(maxLength * 3, maxLength)).replace(/\s+/g, ' ').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

function jsonLdScript(data) {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
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

function timestampMillis(value) {
  const date = safeDate(value);
  return date ? date.getTime() : 0;
}

function adviceUrl(id) {
  return `${SITE_ORIGIN}/advice/${encodeURIComponent(id)}`;
}

function translateUrl(id) {
  return `${SITE_ORIGIN}/translate/${encodeURIComponent(id)}`;
}

function extractId(request, prefix) {
  const raw = String(request?.originalUrl || request?.url || request?.path || '');
  let pathname = '';
  try {
    pathname = new URL(raw, SITE_ORIGIN).pathname;
  } catch {
    pathname = String(request?.path || '');
  }
  const match = pathname.match(new RegExp(`/${prefix}/([^/?#]+)/?$`));
  if (!match) return '';
  let decoded = '';
  try {
    decoded = decodeURIComponent(match[1]);
  } catch {
    return '';
  }
  return ID_PATTERN.test(decoded) ? decoded : '';
}

const PAGE_STYLE = `:root{color-scheme:light;--ink:#2d241a;--muted:#6e6255;--gold:#9a6a13;--line:#dfd1b6;--paper:#fffdf8;--cream:#f6efe2}
*{box-sizing:border-box}body{margin:0;background:linear-gradient(180deg,#fbf7ef,#f1e7d5);color:var(--ink);font-family:Arial,'Noto Sans KR',sans-serif;line-height:1.75}
a{color:inherit}.site-header{border-bottom:1px solid var(--line);background:rgba(255,253,248,.94);position:sticky;top:0;z-index:2}.site-header-inner{max-width:720px;margin:auto;padding:12px 18px;display:flex;align-items:center;justify-content:space-between;gap:14px}.brand{display:flex;align-items:center;gap:9px;text-decoration:none;font-weight:900;color:#745315}.brand img{width:36px;height:36px;object-fit:contain}.header-link{font-size:13px;text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:7px 12px;background:#fffaf0}
main{max-width:720px;margin:0 auto;padding:26px 16px 48px}.cover,.doc{background:var(--paper);border:1px solid var(--line);border-radius:22px;box-shadow:0 12px 28px rgba(91,66,29,.08)}.cover{padding:28px 24px;text-align:center}.kicker{font-size:11px;letter-spacing:.12em;font-weight:900;color:var(--gold)}h1{font-family:'Noto Sans KR',Arial,sans-serif;font-size:27px;line-height:1.4;margin:12px 0 8px;word-break:keep-all}.summary{color:var(--muted);font-size:14px;margin:0 auto;max-width:600px}.meta{display:flex;justify-content:center;gap:8px;flex-wrap:wrap;margin-top:16px}.chip{border:1px solid var(--line);background:var(--cream);border-radius:999px;padding:7px 11px;font-size:12px;color:#654b24;font-weight:800}
.doc{margin-top:16px;padding:24px}.doc h2{font-family:'Noto Sans KR',Arial,sans-serif;margin:22px 0 8px;padding-bottom:9px;border-bottom:1px solid var(--line);font-size:16px;color:#4a3518}.doc h2:first-child{margin-top:0}.doc p{margin:0 0 12px;font-size:15px;color:#352f29;white-space:pre-wrap;word-break:keep-all}.doc .tagline{margin-top:14px;font-style:italic;color:var(--gold);font-weight:700}
.notice{margin:18px 0;padding:14px 16px;border:1px solid #e0c9a3;border-radius:14px;background:#fff8e9;color:#6e5938;font-size:12px}.actions{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:18px}.button{display:flex;align-items:center;justify-content:center;min-height:48px;border-radius:14px;text-decoration:none;font-weight:900;border:1px solid var(--line);background:#fffaf0}.button.primary{background:linear-gradient(135deg,#d7aa3d,#f0cf70);color:#231c13;border-color:#c6972f}
footer{padding:24px 16px 90px;text-align:center;color:var(--muted);font-size:12px}@media(max-width:560px){h1{font-size:23px}.cover{padding:24px 18px}.doc{padding:20px 18px}.actions{grid-template-columns:1fr}}`;

function pageShell({ title, description, canonical, robots, jsonLd, bodyHtml, keywords = '' }) {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${htmlEscape(title)}</title>
  <meta name="description" content="${htmlEscape(description)}">
  ${keywords ? `<meta name="keywords" content="${htmlEscape(keywords)}">` : ''}
  <meta name="robots" content="${robots}">
  <link rel="canonical" href="${htmlEscape(canonical)}">
  <link rel="icon" href="/icons/favicon-48.png" type="image/png">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="소소킹">
  <meta property="og:title" content="${htmlEscape(title)}">
  <meta property="og:description" content="${htmlEscape(description)}">
  <meta property="og:url" content="${htmlEscape(canonical)}">
  <meta property="og:image" content="${SITE_ORIGIN}/og-image.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${htmlEscape(title)}">
  <meta name="twitter:description" content="${htmlEscape(description)}">
  <meta name="twitter:image" content="${SITE_ORIGIN}/og-image.png">
  <script type="application/ld+json">${jsonLdScript(jsonLd)}</script>
  <style>${PAGE_STYLE}</style>
</head>
<body>
  <header class="site-header"><div class="site-header-inner"><a class="brand" href="${SITE_ORIGIN}/"><img src="/logo.png" alt=""><span>소소킹</span></a><a class="header-link" href="${SITE_ORIGIN}/#/services">서비스 전체</a></div></header>
  <main>${bodyHtml}</main>
  <footer>© 소소킹 · 사소한 일상을 과하게 진지하게 굴리는 AI 놀이터.</footer>
</body>
</html>`;
}

function renderNotFoundHtml(kind) {
  const label = kind === 'translate' ? '번역' : '처방';
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${label}을 찾을 수 없습니다 | 소소킹</title></head><body style="margin:0;background:#f6efe2;color:#2d241a;font-family:Arial,sans-serif;text-align:center;padding:80px 20px"><h1>${label}을 찾을 수 없습니다</h1><p>비공개로 전환되었거나 삭제된 기록일 수 있습니다.</p><p><a href="/#/services">서비스로 이동</a></p></body></html>`;
}

function normalizeAdvice(id, raw = {}) {
  const diagnosis = cleanText(raw.diagnosis, 80) || '정체불명 병맛 증세';
  const worry = cleanText(raw.worry, 600);
  const prescription = cleanText(raw.prescription, 700);
  return {
    id,
    diagnosis,
    worry,
    prescription,
    dosage: cleanText(raw.dosage, 200),
    caution: cleanText(raw.caution, 200),
    counselorName: cleanText(raw.counselorName, 60) || '미친 상담사',
    likeCount: Math.max(0, Math.floor(Number(raw.likeCount) || 0)),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt || raw.createdAt
  };
}

function renderAdviceHtml(advice) {
  const canonical = adviceUrl(advice.id);
  const title = `${advice.diagnosis} | 미친 고민상담소 · 소소킹`;
  const description = compactText(
    `${advice.worry ? `고민 "${compactText(advice.worry, 50)}" → ` : ''}${advice.counselorName} 진단: ${advice.diagnosis}. ${advice.prescription}`,
    160
  );
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: advice.diagnosis,
    headline: advice.diagnosis,
    description,
    url: canonical,
    mainEntityOfPage: canonical,
    inLanguage: 'ko-KR',
    genre: '유머',
    isPartOf: { '@type': 'WebSite', name: '소소킹', url: SITE_ORIGIN },
    ...(isoDate(advice.createdAt) ? { datePublished: isoDate(advice.createdAt) } : {}),
    ...(isoDate(advice.updatedAt) ? { dateModified: isoDate(advice.updatedAt) } : {})
  };
  const bodyHtml = `<article>
      <header class="cover">
        <div class="kicker">미친 고민상담소 · 오락용 AI 처방전</div>
        <h1>${htmlEscape(advice.diagnosis)}</h1>
        <p class="summary">${htmlEscape(description)}</p>
        <div class="meta">
          <span class="chip">🩺 ${htmlEscape(advice.counselorName)}</span>
          ${advice.likeCount ? `<span class="chip">❤️ ${advice.likeCount}</span>` : ''}
        </div>
      </header>
      <section class="doc">
        ${advice.worry ? `<h2>고민</h2><p>${htmlEscape(advice.worry)}</p>` : ''}
        <h2>진단명</h2><p>${htmlEscape(advice.diagnosis)}</p>
        ${advice.prescription ? `<h2>처방</h2><p>${htmlEscape(advice.prescription)}</p>` : ''}
        ${advice.dosage ? `<h2>복용법</h2><p>${htmlEscape(advice.dosage)}</p>` : ''}
        ${advice.caution ? `<h2>주의사항</h2><p>${htmlEscape(advice.caution)}</p>` : ''}
      </section>
      <div class="notice">이 처방전은 AI가 장난스럽게 생성한 오락 콘텐츠이며, 실제 의학·심리 상담이 아닙니다.</div>
      <div class="actions"><a class="button primary" href="${SITE_ORIGIN}/#/clinic">나도 상담받기</a><a class="button" href="${SITE_ORIGIN}/#/clinic-list">인기 처방전 더 보기</a></div>
    </article>`;
  return pageShell({ title, description, canonical, robots: 'index,follow,max-snippet:-1,max-image-preview:large', jsonLd, bodyHtml, keywords: '고민상담, 병맛 상담, 소소킹' });
}

function normalizeTranslation(id, raw = {}) {
  return {
    id,
    modeLabel: cleanText(raw.modeLabel, 60) || '병맛 번역',
    modeEmoji: cleanText(raw.modeEmoji, 12) || '💥',
    originalText: cleanText(raw.originalText, 800),
    translated: cleanText(raw.translated, 1200),
    styleNote: cleanText(raw.style_note, 400),
    tagline: cleanText(raw.tagline, 200),
    likeCount: Math.max(0, Math.floor(Number(raw.likeCount) || 0)),
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt || raw.createdAt
  };
}

function renderTranslationHtml(item) {
  const canonical = translateUrl(item.id);
  const headline = compactText(item.translated, 60) || `${item.modeLabel} 번역`;
  const title = `${item.originalText ? `"${compactText(item.originalText, 24)}" ` : ''}${item.modeLabel} 번역 | 미친 번역소 · 소소킹`;
  const description = compactText(
    `${item.originalText ? `"${compactText(item.originalText, 50)}" → ` : ''}${item.modeLabel}: ${item.translated}`,
    160
  );
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: headline,
    headline,
    description,
    url: canonical,
    mainEntityOfPage: canonical,
    inLanguage: 'ko-KR',
    genre: '유머',
    isPartOf: { '@type': 'WebSite', name: '소소킹', url: SITE_ORIGIN },
    ...(isoDate(item.createdAt) ? { datePublished: isoDate(item.createdAt) } : {}),
    ...(isoDate(item.updatedAt) ? { dateModified: isoDate(item.updatedAt) } : {})
  };
  const bodyHtml = `<article>
      <header class="cover">
        <div class="kicker">미친 번역소 · ${htmlEscape(item.modeEmoji)} ${htmlEscape(item.modeLabel)}</div>
        <h1>${htmlEscape(headline)}</h1>
        <p class="summary">${htmlEscape(description)}</p>
        <div class="meta">
          <span class="chip">${htmlEscape(item.modeEmoji)} ${htmlEscape(item.modeLabel)}</span>
          ${item.likeCount ? `<span class="chip">❤️ ${item.likeCount}</span>` : ''}
        </div>
      </header>
      <section class="doc">
        ${item.originalText ? `<h2>원문</h2><p>${htmlEscape(item.originalText)}</p>` : ''}
        <h2>${htmlEscape(item.modeLabel)} 번역</h2><p>${htmlEscape(item.translated)}</p>
        ${item.styleNote ? `<h2>번역 노트</h2><p>${htmlEscape(item.styleNote)}</p>` : ''}
        ${item.tagline ? `<p class="tagline">${htmlEscape(item.tagline)}</p>` : ''}
      </section>
      <div class="notice">이 번역은 AI가 장난스럽게 생성한 오락 콘텐츠이며, 실제 번역 서비스가 아닙니다.</div>
      <div class="actions"><a class="button primary" href="${SITE_ORIGIN}/#/translate">나도 번역하기</a><a class="button" href="${SITE_ORIGIN}/#/translate-list">인기 번역 더 보기</a></div>
    </article>`;
  return pageShell({ title, description, canonical, robots: 'index,follow,max-snippet:-1,max-image-preview:large', jsonLd, bodyHtml, keywords: `${item.modeLabel}, 병맛 번역, 소소킹` });
}

async function loadPublicDoc(collection, id) {
  const snapshot = await db.doc(`${collection}/${id}`).get();
  if (!snapshot.exists) return null;
  const raw = snapshot.data() || {};
  if (raw.isPublic !== true) return null;
  return raw;
}

async function listPublicEntries(collection, urlFor) {
  let snapshot;
  try {
    snapshot = await db.collection(collection)
      .where('isPublic', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(SITEMAP_LIMIT)
      .get();
  } catch (error) {
    console.warn(`ordered ${collection} sitemap query failed; retrying without ordering:`, error?.code || error);
    snapshot = await db.collection(collection).where('isPublic', '==', true).limit(SITEMAP_LIMIT).get();
  }
  return snapshot.docs
    .filter(document => ID_PATTERN.test(document.id))
    .map(document => ({
      loc: urlFor(document.id),
      lastmod: isoDay(document.data()?.updatedAt || document.data()?.createdAt),
      createdAtMillis: timestampMillis(document.data()?.updatedAt || document.data()?.createdAt)
    }))
    .sort((a, b) => b.createdAtMillis - a.createdAtMillis)
    .map(({ loc, lastmod }) => ({ loc, lastmod }));
}

// 사이트맵에 상담소·번역소 공개 결과 URL을 추가로 넣는다.
async function listPublicServiceSitemapUrls() {
  const [advice, translation] = await Promise.all([
    listPublicEntries('advice_results', adviceUrl).catch(() => []),
    listPublicEntries('translation_results', translateUrl).catch(() => [])
  ]);
  return [...advice, ...translation];
}

function allowReadMethod(request, response) {
  if (request.method === 'GET' || request.method === 'HEAD') return true;
  response.set('Allow', 'GET, HEAD').status(405).send('Method Not Allowed');
  return false;
}

function makeResultPage({ prefix, collection, normalize, render, kind }) {
  return async (request, response) => {
    if (!allowReadMethod(request, response)) return;
    const id = extractId(request, prefix);
    if (!id) {
      response.set('X-Robots-Tag', 'noindex, nofollow').status(404).send(renderNotFoundHtml(kind));
      return;
    }
    try {
      const raw = await loadPublicDoc(collection, id);
      if (!raw) {
        response
          .set('Content-Type', 'text/html; charset=utf-8')
          .set('Cache-Control', 'public, max-age=0, s-maxage=60')
          .set('X-Robots-Tag', 'noindex, nofollow')
          .status(404)
          .send(renderNotFoundHtml(kind));
        return;
      }
      const canonical = prefix === 'translate' ? translateUrl(id) : adviceUrl(id);
      response
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400')
        .set('X-Robots-Tag', 'index, follow, max-snippet:-1, max-image-preview:large')
        .set('Link', `<${canonical}>; rel="canonical"`)
        .set('Vary', 'Accept-Encoding')
        .status(200)
        .send(render(normalize(id, raw)));
    } catch (error) {
      console.error(`${prefix} public page failed:`, { id, code: error?.code || '', message: error?.message || '' });
      response
        .set('Content-Type', 'text/html; charset=utf-8')
        .set('Cache-Control', 'no-store')
        .set('X-Robots-Tag', 'noindex, nofollow')
        .status(500)
        .send(renderNotFoundHtml(kind));
    }
  };
}

exports.publicAdvicePage = onRequest(
  { region: REGION, timeoutSeconds: 30, memory: '256MiB', maxInstances: 20 },
  makeResultPage({ prefix: 'advice', collection: 'advice_results', normalize: normalizeAdvice, render: renderAdviceHtml, kind: 'advice' })
);

exports.publicTranslatePage = onRequest(
  { region: REGION, timeoutSeconds: 30, memory: '256MiB', maxInstances: 20 },
  makeResultPage({ prefix: 'translate', collection: 'translation_results', normalize: normalizeTranslation, render: renderTranslationHtml, kind: 'translate' })
);

Object.defineProperties(module.exports, {
  extractId: { value: extractId, enumerable: false },
  normalizeAdvice: { value: normalizeAdvice, enumerable: false },
  normalizeTranslation: { value: normalizeTranslation, enumerable: false },
  renderAdviceHtml: { value: renderAdviceHtml, enumerable: false },
  renderTranslationHtml: { value: renderTranslationHtml, enumerable: false },
  listPublicServiceSitemapUrls: { value: listPublicServiceSitemapUrls, enumerable: false },
  adviceUrl: { value: adviceUrl, enumerable: false },
  translateUrl: { value: translateUrl, enumerable: false }
});
