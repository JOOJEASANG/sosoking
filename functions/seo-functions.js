'use strict';

const { onRequest } = require('firebase-functions/v2/https');

const REGION = 'asia-northeast3';
const SITE_ORIGIN = 'https://sosoking.co.kr';

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeUrl(path = '/') {
  const cleanPath = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`;
  return `${SITE_ORIGIN}${cleanPath}`;
}

function timestamp(date) {
  const d = date?.toDate?.() || (date ? new Date(date) : new Date());
  return Number.isFinite(d.getTime()) ? d.toISOString() : new Date().toISOString();
}

function postTitle(post = {}) {
  const title = stripHtml(post.title || '');
  const desc = stripHtml(post.desc || '');
  const dripTopic = stripHtml(post.modules?.drip?.prompt || '');
  if (post.modules?.drip?.enabled) {
    return ['오늘의 드립 주제', '오늘의 한줄', '드립방 AI 글'].includes(title) ? (dripTopic || desc || '드립 주제') : (title || dripTopic || desc || '드립 주제');
  }
  if (post.modules?.vote?.enabled) return title || stripHtml(post.modules.vote.question || '') || desc || '토론 주제';
  if (post.modules?.quiz?.enabled) return title || '퀴즈 문제';
  return title || desc || '소소킹 게시글';
}

function postDescription(post = {}) {
  const parts = [
    post.modules?.drip?.prompt,
    post.modules?.vote?.question,
    post.modules?.quiz?.question,
    post.desc,
    Array.isArray(post.tags) ? post.tags.map(t => `#${t}`).join(' ') : '',
  ].map(stripHtml).filter(Boolean);
  return (parts[0] || '유튜브, 웃긴그림, 퀴즈, 토론, 한줄드립을 짧게 모아보는 소소킹입니다.').slice(0, 155);
}

function pageHtml({ title, description, url, image, body, type = 'website', noindex = false }) {
  const safeTitle = `${title} | 소소킹`;
  const ogImage = image || safeUrl('/og-image.png');
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(safeTitle)}</title>
  <meta name="description" content="${esc(description)}">
  ${noindex ? '<meta name="robots" content="noindex,follow">' : '<meta name="robots" content="index,follow">'}
  <link rel="canonical" href="${esc(url)}">
  <meta property="og:type" content="${esc(type)}">
  <meta property="og:url" content="${esc(url)}">
  <meta property="og:title" content="${esc(safeTitle)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:image" content="${esc(ogImage)}">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:site_name" content="소소킹">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${esc(safeTitle)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(ogImage)}">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': type === 'article' ? 'DiscussionForumPosting' : 'WebPage',
    headline: safeTitle,
    description,
    url,
    image: ogImage,
    inLanguage: 'ko-KR',
    publisher: { '@type': 'Organization', name: '소소킹', url: SITE_ORIGIN },
  })}</script>
  <style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,'Noto Sans KR',sans-serif;margin:0;background:#faf8f5;color:#222}.wrap{max-width:720px;margin:0 auto;padding:32px 18px}.card{background:#fff;border:1px solid #eee;border-radius:22px;padding:24px;box-shadow:0 12px 32px rgba(20,14,40,.07)}.badge{display:inline-flex;padding:6px 10px;border-radius:999px;background:#fff0eb;color:#ff6b4a;font-weight:900;font-size:13px}h1{font-size:28px;line-height:1.25;margin:18px 0 12px}p{line-height:1.75;color:#555}.btn{display:inline-flex;margin-top:18px;padding:12px 16px;border-radius:999px;background:#ff6b4a;color:#fff;text-decoration:none;font-weight:900}</style>
</head>
<body><main class="wrap"><article class="card">${body}</article></main></body>
</html>`;
}

function register({ exports, db }) {
  exports.seoPost = onRequest({ region: REGION, timeoutSeconds: 20, memory: '256MiB' }, async (req, res) => {
    const id = decodeURIComponent(String(req.path || '').split('/').filter(Boolean).pop() || '');
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    if (!/^[A-Za-z0-9_-]{8,160}$/.test(id)) {
      res.status(404).send(pageHtml({
        title: '글을 찾을 수 없어요',
        description: '요청한 소소킹 게시글을 찾을 수 없습니다.',
        url: safeUrl(req.path || '/p'),
        noindex: true,
        body: '<span class="badge">소소킹</span><h1>글을 찾을 수 없어요</h1><p>삭제되었거나 잘못된 링크입니다.</p><a class="btn" href="/">소소킹 홈으로</a>',
      }));
      return;
    }

    const snap = await db.doc(`feeds/${id}`).get();
    if (!snap.exists || snap.data()?.hidden === true) {
      res.status(404).send(pageHtml({
        title: '글을 찾을 수 없어요',
        description: '요청한 소소킹 게시글을 찾을 수 없습니다.',
        url: safeUrl(`/p/${id}`),
        noindex: true,
        body: '<span class="badge">소소킹</span><h1>글을 찾을 수 없어요</h1><p>삭제되었거나 공개되지 않은 글입니다.</p><a class="btn" href="/">소소킹 홈으로</a>',
      }));
      return;
    }

    const post = { id: snap.id, ...snap.data() };
    const title = postTitle(post);
    const description = postDescription(post);
    const image = Array.isArray(post.images) && post.images[0] ? post.images[0] : safeUrl('/og-image.png');
    const tags = Array.isArray(post.tags) ? post.tags.slice(0, 6).map(t => `#${esc(t)}`).join(' ') : '';
    const body = `<span class="badge">${esc(post.typeLabel || '소소킹')}</span><h1>${esc(title)}</h1><p>${esc(description)}</p>${tags ? `<p>${tags}</p>` : ''}<a class="btn" href="/#/detail/${esc(id)}">앱에서 보기</a>`;
    res.status(200).send(pageHtml({ title, description, url: safeUrl(`/p/${id}`), image, body, type: 'article' }));
  });

  exports.sitemapXml = onRequest({ region: REGION, timeoutSeconds: 20, memory: '256MiB' }, async (req, res) => {
    res.set('Content-Type', 'application/xml; charset=utf-8');
    res.set('Cache-Control', 'public, max-age=1800, s-maxage=3600');
    const staticUrls = [
      '/',
      '/#/feed',
      '/#/feed?type=collect',
      '/#/feed?type=vote',
      '/#/feed?type=quiz',
      '/#/feed?type=drip',
    ];
    let postUrls = [];
    try {
      const snap = await db.collection('feeds').orderBy('createdAt', 'desc').limit(500).get();
      postUrls = snap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(post => post.hidden !== true)
        .map(post => ({ loc: safeUrl(`/p/${post.id}`), lastmod: timestamp(post.updatedAt || post.createdAt) }));
    } catch (error) {
      console.error('[sitemapXml] failed', error);
    }

    const urls = [
      ...staticUrls.map(path => ({ loc: safeUrl(path), lastmod: new Date().toISOString() })),
      ...postUrls,
    ];
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map(item => `  <url><loc>${esc(item.loc)}</loc><lastmod>${item.lastmod}</lastmod></url>`).join('\n')}\n</urlset>`;
    res.status(200).send(xml);
  });
}

module.exports = { register };
