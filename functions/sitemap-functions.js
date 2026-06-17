'use strict';

const { onRequest } = require('firebase-functions/v2/https');
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
  const urls = [
    { loc: `${SITE_URL}/`, priority: '1.0', changefreq: 'daily' },
    { loc: `${SITE_URL}/today`, priority: '0.9', changefreq: 'daily' },
    { loc: `${SITE_URL}/materials`, priority: '0.9', changefreq: 'daily' },
    { loc: `${SITE_URL}/debates`, priority: '0.8', changefreq: 'daily' },
    { loc: `${SITE_URL}/guide`, priority: '0.5', changefreq: 'monthly' },
    { loc: `${SITE_URL}/terms`, priority: '0.3', changefreq: 'yearly' },
    { loc: `${SITE_URL}/privacy`, priority: '0.3', changefreq: 'yearly' },
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(item => `  <url>
    <loc>${escapeXml(item.loc)}</loc>
    <changefreq>${escapeXml(item.changefreq)}</changefreq>
    <priority>${escapeXml(item.priority)}</priority>
  </url>`).join('\n')}
</urlset>`;
  res.set('Content-Type', 'application/xml; charset=utf-8');
  res.send(xml);
});

module.exports = { sitemapXml };
