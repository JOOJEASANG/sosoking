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

// 참여도에 따라 우선순위 결정
function calcPriority(post) {
  const score = Number(post.reactions?.total || 0) + Number(post.commentCount || 0);
  if (score >= 30) return { priority: '0.9', changefreq: 'daily' };
  if (score >= 10) return { priority: '0.8', changefreq: 'daily' };
  if (score >= 3)  return { priority: '0.7', changefreq: 'weekly' };
  return              { priority: '0.6', changefreq: 'weekly' };
}

const sitemapXml = onRequest({ region: 'asia-northeast3' }, async (req, res) => {
  // 해시(#) URL은 검색엔진이 크롤링하지 않으므로 제외
  const staticUrls = [
    { loc: `${SITE_URL}/`,           priority: '1.0', changefreq: 'daily'  },
    { loc: `${SITE_URL}/republic`,   priority: '0.9', changefreq: 'daily'  },
    { loc: `${SITE_URL}/battle`,     priority: '0.9', changefreq: 'daily'  },
    { loc: `${SITE_URL}/parties`,    priority: '0.8', changefreq: 'daily'  },
    { loc: `${SITE_URL}/election`,   priority: '0.8', changefreq: 'daily'  },
    { loc: `${SITE_URL}/congress`,   priority: '0.7', changefreq: 'weekly' },
    { loc: `${SITE_URL}/constitutional-court`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${SITE_URL}/ranking`,    priority: '0.7', changefreq: 'daily'  },
    { loc: `${SITE_URL}/news`,       priority: '0.7', changefreq: 'daily'  },
    { loc: `${SITE_URL}/guide`,      priority: '0.6', changefreq: 'monthly' },
    { loc: `${SITE_URL}/terms`,      priority: '0.3', changefreq: 'yearly' },
    { loc: `${SITE_URL}/privacy`,    priority: '0.3', changefreq: 'yearly' },
    { loc: `${SITE_URL}/game/liar`,  priority: '0.5', changefreq: 'monthly' },
    { loc: `${SITE_URL}/game/mafia`, priority: '0.5', changefreq: 'monthly' },
  ];

  let postUrls = [];
  try {
    // 300건 한도 제거 → 전체 게시글 페이지네이션 로드
    let lastDoc = null;
    let hasMore  = true;
    const BATCH  = 500;

    while (hasMore) {
      let q = db.collection('feeds').orderBy('createdAt', 'desc').limit(BATCH);
      if (lastDoc) q = q.startAfter(lastDoc);

      const snap = await q.get();
      if (snap.empty) break;

      snap.docs.forEach(doc => {
        const post = doc.data();
        if (post.hidden === true) return;

        const updated = post.updatedAt?.toDate?.() || post.createdAt?.toDate?.() || new Date();
        const { priority, changefreq } = calcPriority(post);

        postUrls.push({
          loc: `${SITE_URL}/p/${doc.id}`,
          lastmod: updated.toISOString().slice(0, 10),
          priority,
          changefreq,
        });
        lastDoc = doc;
      });

      hasMore = snap.docs.length === BATCH;
    }
  } catch (error) {
    console.error('[sitemapXml] failed to load feeds', error);
  }

  // 인기 글 먼저 (priority 높은 순)
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
  res.set('Cache-Control', 'public, max-age=3600'); // 1시간 캐시
  res.status(200).send(xml);
});

module.exports = { sitemapXml };
