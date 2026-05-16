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

const sitemapXml = onRequest({ region: 'asia-northeast3' }, async (req, res) => {
  const staticUrls = [
    { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE_URL}/#/feed`, priority: '0.8', changefreq: 'daily' },
    { loc: `${SITE_URL}/#/mission`, priority: '0.7', changefreq: 'daily' },
    { loc: `${SITE_URL}/#/hall`, priority: '0.7', changefreq: 'weekly' },
    { loc: `${SITE_URL}/#/guide`, priority: '0.5', changefreq: 'monthly' },
  ];

  let postUrls = [];
  try {
    const snap = await db.collection('feeds').orderBy('createdAt', 'desc').limit(300).get();
    postUrls = snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(post => post.hidden !== true)
      .map(post => {
        const updated = post.updatedAt?.toDate?.() || post.createdAt?.toDate?.() || new Date();
        return {
          loc: `${SITE_URL}/p/${post.id}`,
          lastmod: updated.toISOString().slice(0, 10),
          priority: '0.6',
          changefreq: 'weekly',
        };
      });
  } catch (error) {
    console.error('[sitemapXml] failed to load feeds', error);
  }

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
