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

function calcPriority(post) {
  const score = Number(post.reactions?.total || 0) + Number(post.commentCount || 0);
  if (score >= 30) return { priority: '0.9', changefreq: 'daily' };
  if (score >= 10) return { priority: '0.8', changefreq: 'daily' };
  if (score >= 3)  return { priority: '0.7', changefreq: 'weekly' };
  return              { priority: '0.6', changefreq: 'weekly' };
}

const sitemapXml = onRequest({ region: 'asia-northeast3' }, async (req, res) => {
  const staticUrls = [
    { loc: `${SITE_URL}/`,           priority: '1.0', changefreq: 'daily'  },
    { loc: `${SITE_URL}/battle`,     priority: '0.9', changefreq: 'daily'  },
    { loc: `${SITE_URL}/history`,    priority: '0.9', changefreq: 'weekly' },
    { loc: `${SITE_URL}/republic`,   priority: '0.8', changefreq: 'daily'  },
    { loc: `${SITE_URL}/election`,   priority: '0.8', changefreq: 'daily'  },
    { loc: `${SITE_URL}/ranking`,    priority: '0.5', changefreq: 'daily'  },
    { loc: `${SITE_URL}/guide`,      priority: '0.5', changefreq: 'monthly' },
    { loc: `${SITE_URL}/terms`,      priority: '0.3', changefreq: 'yearly' },
    { loc: `${SITE_URL}/privacy`,    priority: '0.3', changefreq: 'yearly' },
  ];

  let postUrls = [];
  try {
    let lastDoc = null;
    let hasMore = true;
    const BATCH = 500;
    while (hasMore) {
      let q = db.collection('feeds').orderBy('createdAt', 'desc').limit(BATCH);
      if (lastDoc) q = q.startAfter(lastDoc);
      const snap = await q.get();
      if (snap.empty) break;
      snap.docs.forEach(doc => {
        const post = doc.data();
        if (post.hidden === true) return;
        if (!post.isHistoryIssue) return;
        const updated = post.updatedAt?.toDate?.() || post.createdAt?.toDate?.() || new Date();
        const { priority, changefreq } = calcPriority(post);
        postUrls.push({ loc: `${SITE_URL}/p/${doc.id}`, lastmod: updated.toISOString().slice(0, 10), priority, changefreq });
        lastDoc = doc;
      });
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
  res.send(xml);
});

module.exports = { sitemapXml };
