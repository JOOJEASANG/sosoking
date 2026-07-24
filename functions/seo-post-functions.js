'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const REGION = 'asia-northeast3';
const SITE = 'https://sosoking.co.kr';

function cleanId(value, max = 180) {
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, max);
}

function escapeHtml(value, max = 1000) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .slice(0, max);
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeImage(value) {
  try {
    const url = new URL(String(value || '').trim());
    if (url.protocol === 'https:') return escapeHtml(url.toString(), 1200);
  } catch {}
  return `${SITE}/icon-512.png`;
}

function safeJson(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

const seoPost = onRequest({ region: REGION, timeoutSeconds: 20 }, async (req, res) => {
  const parts = req.path.split('/').filter(Boolean);
  const id = cleanId(parts.at(-1) || req.query.id);
  if (!id) return res.redirect(SITE);

  try {
    const snap = await db.doc(`feeds/${id}`).get();
    if (!snap.exists || snap.data()?.hidden === true) return res.redirect(`${SITE}/#/feed`);
    const post = snap.data() || {};
    const rawTitle = String(post.title || '소소킹 커뮤니티').slice(0, 100);
    const rawDesc = stripHtml(post.desc || '판결, 상담, 토론, 드립으로 참여하는 소소킹 커뮤니티').slice(0, 200);
    const title = escapeHtml(rawTitle, 100);
    const desc = escapeHtml(rawDesc, 200);
    const image = safeImage(Array.isArray(post.images) ? post.images[0] : '');
    const url = `${SITE}/p/${id}`;
    const destination = `${SITE}/#/detail/${id}`;
    const published = post.createdAt?.toDate?.()?.toISOString() || new Date().toISOString();
    const modified = post.updatedAt?.toDate?.()?.toISOString() || published;
    const author = String(post.authorName || '소소킹 회원').slice(0, 60);
    const jsonLd = safeJson({
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: rawTitle,
      description: rawDesc,
      image: [image],
      datePublished: published,
      dateModified: modified,
      author: { '@type': 'Person', name: author },
      publisher: {
        '@type': 'Organization', name: '소소킹', url: SITE,
        logo: { '@type': 'ImageObject', url: `${SITE}/icon-512.png` },
      },
      mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    });

    res.set('Cache-Control', 'public, max-age=600');
    return res.status(200).send(`<!doctype html><html lang="ko"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} | 소소킹</title><meta name="description" content="${desc}">
<meta property="og:type" content="article"><meta property="og:site_name" content="소소킹">
<meta property="og:title" content="${title} | 소소킹"><meta property="og:description" content="${desc}">
<meta property="og:image" content="${image}"><meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${title} | 소소킹">
<meta name="twitter:description" content="${desc}"><meta name="twitter:image" content="${image}">
<link rel="canonical" href="${url}"><script type="application/ld+json">${jsonLd}</script>
<meta http-equiv="refresh" content="0;url=${destination}"><script>location.replace(${JSON.stringify(destination)})</script>
</head><body><h1>${title}</h1><p>${desc}</p><a href="${destination}">내용 보기</a></body></html>`);
  } catch (error) {
    console.error('[seoPost]', error);
    return res.redirect(`${SITE}/#/detail/${id}`);
  }
});

module.exports = { seoPost };
