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
  if (score >= 3) return { priority: '0.7', changefreq: 'weekly' };
  return { priority: '0.6', changefreq: 'weekly' };
}

const sitemapXml = onRequest({ region: 'asia-northeast3', timeoutSeconds: 60 }, async (req, res) => {
  const staticUrls = [
    { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE_URL}/#/feed`, priority: '0.9', changefreq: 'daily' },
    { loc: `${SITE_URL}/#/guide`, priority: '0.5', changefreq: 'monthly' },
  ];
  const postUrls = [];

  try {
    let lastDoc = null;
    while (true) {
      let query = db.collection('feeds').orderBy('createdAt', 'desc').limit(500);
      if (lastDoc) query = query.startAfter(lastDoc);
      const snap = await query.get();
      if (snap.empty) break;

      for (const docSnap of snap.docs) {
        const post = docSnap.data() || {};
        if (post.hidden === true) continue;
        const updated = post.updatedAt?.toDate?.() || post.createdAt?.toDate?.() || new Date();
        const rank = calcPriority(post);
        postUrls.push({
          loc: `${SITE_URL}/p/${docSnap.id}`,
          lastmod: updated.toISOString().slice(0, 10),
          ...rank,
        });
      }

      lastDoc = snap.docs[snap.docs.length - 1];
      if (snap.size < 500) break;
    }
  } catch (error) {
    console.error('[sitemapXml]', error);
  }

  postUrls.sort((a, b) => Number(b.priority) - Number(a.priority));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...postUrls].map(item => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    ${item.lastmod ? `<lastmod>${escapeXml(item.lastmod)}</lastmod>` : ''}
    <changefreq>${escapeXml(item.changefreq)}</changefreq>
    <priority>${escapeXml(item.priority)}</priority>
  </url>`).join('\n')}
</urlset>`;
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.status(200).send(xml);
});

module.exports = { sitemapXml };
