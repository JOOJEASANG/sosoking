'use strict';

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const db = getFirestore();
const SITE_URL = 'https://sosoking.co.kr';

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

// 참여도에 따라 우선순위 결정
function calcPriority(post) {
  const score = Number(post.reactions?.total || 0) + Number(post.commentCount || 0) + Math.floor(Number(post.viewCount || 0) / 10);
  if (score >= 50) return { priority: '0.9', changefreq: 'daily' };
  if (score >= 20) return { priority: '0.8', changefreq: 'daily' };
  if (score >= 5)  return { priority: '0.7', changefreq: 'weekly' };
  return              { priority: '0.6', changefreq: 'weekly' };
}

const sitemapXml = onRequest({ region: 'asia-northeast3' }, async (req, res) => {
  // 해시(#) URL은 검색엔진용 sitemap에 넣지 않고, 검색 가능한 정적 URL과 /p/{id}만 넣습니다.
  const staticUrls = [
    { loc: `${SITE_URL}/`, lastmod: today(), priority: '1.0', changefreq: 'daily' },
  ];

  let postUrls = [];
  try {
    let lastDoc = null;
    let hasMore  = true;
    const BATCH  = 500;
    let safety = 0;

    while (hasMore && safety < 20) {
      safety += 1;
      let q = db.collection('feeds').orderBy('createdAt', 'desc').limit(BATCH);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      snap.docs.forEach(doc => {
        const post = doc.data() || {};
        if (post.hidden === true) return;
        if (!post.title && !post.desc && !post.body) return;

        const updated = post.updatedAt?.toDate?.() || post.createdAt?.toDate?.() || new Date();
        const { priority, changefreq } = calcPriority(post);

        postUrls.push({
          loc: `${SITE_URL}/p/${doc.id}`,
          lastmod: updated.toISOString().slice(0, 10),
          priority,
          changefreq,
        });
      });

      lastDoc = snap.docs[snap.docs.length - 1];
      hasMore = snap.docs.length === BATCH;
    }
  } catch (error) {
    console.error('[sitemapXml] failed to load feeds', error);
  }

  postUrls.sort((a, b) => Number(b.priority) - Number(a.priority));
  const urls = [...staticUrls, ...postUrls];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(item => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    ${item.lastmod ? `<lastmod>${escapeXml(item.lastmod)}</lastmod>` : ''}
    <changefreq>${escapeXml(item.changefreq)}</changefreq>
    <priority>${escapeXml(item.priority)}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=1800');
  res.status(200).send(xml);
});

module.exports = { sitemapXml };
