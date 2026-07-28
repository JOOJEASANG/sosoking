import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

const root = process.cwd();
const dataPath = path.join(root, 'data', 'creative-cases-v1.b64');
const publicDir = path.join(root, 'public');
const casesDir = path.join(publicDir, 'cases');
const siteUrl = 'https://sosoking.co.kr';

const compressed = Buffer.from(fs.readFileSync(dataPath, 'utf8').trim(), 'base64');
const source = JSON.parse(gunzipSync(compressed).toString('utf8'));
const cases = Array.isArray(source.cases) ? source.cases : [];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeXml(value) {
  return escapeHtml(value);
}

function paragraphs(text) {
  return String(text || '')
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)
    .map(block => {
      const lines = block.split('\n').map(line => line.trim()).filter(Boolean);
      if (lines.length > 1 && lines[0].length <= 18) {
        return `<section class="doc-section"><h3>${escapeHtml(lines[0])}</h3>${lines.slice(1).map(line => `<p>${escapeHtml(line)}</p>`).join('')}</section>`;
      }
      return `<p>${escapeHtml(block)}</p>`;
    })
    .join('');
}

function pageCss() {
  return `
    :root{color-scheme:light;--ink:#2b251f;--muted:#70675d;--gold:#9b6b1b;--line:#d9cfbf;--paper:#fffdf7;--navy:#151b2c}
    *{box-sizing:border-box}body{margin:0;background:#f3eee5;color:var(--ink);font-family:"Noto Sans KR",system-ui,sans-serif;line-height:1.75}
    a{color:inherit}.site-head{background:var(--navy);color:#fff;padding:16px 20px;border-bottom:3px solid #c99a3d}
    .site-head a{text-decoration:none;font-weight:900}.site-head span{color:#e6be67}
    .wrap{width:min(860px,calc(100% - 28px));margin:28px auto 72px}.paper{background:var(--paper);border:1px solid var(--line);border-radius:22px;padding:clamp(22px,5vw,48px);box-shadow:0 18px 50px rgba(52,41,24,.12)}
    .eyebrow{font-size:11px;letter-spacing:.14em;font-weight:900;color:var(--gold)}h1{font-family:"Noto Serif KR",serif;font-size:clamp(28px,6vw,44px);line-height:1.35;margin:10px 0 14px;color:#251a0d}
    .summary{font-size:16px;color:#4f473f}.meta{display:flex;gap:8px;flex-wrap:wrap;margin:20px 0 28px}.chip{border:1px solid #dac8a8;background:#f8f0e2;border-radius:999px;padding:6px 10px;font-size:12px;color:#604a29}
    .doc{border-top:1px solid var(--line);padding-top:28px;margin-top:28px}.doc h2{font-family:"Noto Serif KR",serif;font-size:24px;margin:0 0 18px;color:#3b2913}.doc-section{margin:22px 0}.doc-section h3{font-size:15px;color:#77531c;margin:0 0 8px;padding-left:11px;border-left:4px solid #b7832e}.doc p{margin:0 0 14px;text-align:justify}
    .order{background:#f7efe0;border-left:4px solid #a97927;padding:16px 18px;border-radius:8px}.cta{display:flex;gap:10px;flex-wrap:wrap;margin-top:30px}.btn{display:inline-flex;text-decoration:none;border-radius:12px;padding:12px 16px;font-weight:800}.primary{background:#172039;color:#f6d681}.ghost{border:1px solid #bda77f;background:#fff}
    .related{margin-top:30px}.related ul{padding-left:20px}.notice{font-size:12px;color:var(--muted);margin-top:24px}.site-foot{text-align:center;color:#786e62;font-size:12px;padding:26px}
    @media(max-width:560px){.wrap{width:min(100% - 18px,860px);margin-top:16px}.paper{border-radius:16px;padding:22px 18px}.doc p{text-align:left}.btn{width:100%;justify-content:center}}
  `;
}

function fullPage(item, related) {
  const canonical = `${siteUrl}/cases/${item.slug}/`;
  const interactive = `${siteUrl}/#/result/${encodeURIComponent(item.id)}`;
  const description = `${item.caseTitle}. ${item.caseDescription}`.slice(0, 155);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: item.caseTitle,
    description: item.caseDescription,
    datePublished: item.publishedDate,
    dateModified: source.generatedAt,
    inLanguage: 'ko-KR',
    isAccessibleForFree: true,
    author: { '@type': 'Organization', name: '소소킹 판결소', url: siteUrl },
    publisher: { '@type': 'Organization', name: '소소킹 판결소', url: siteUrl },
    mainEntityOfPage: canonical,
    articleSection: item.category,
    keywords: item.keywords.join(', '),
    about: { '@type': 'Thing', name: '생활분쟁 AI 판결 콘텐츠' }
  };
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '소소킹 판결소', item: `${siteUrl}/` },
      { '@type': 'ListItem', position: 2, name: '창작 사건 모음', item: `${siteUrl}/cases/` },
      { '@type': 'ListItem', position: 3, name: item.caseTitle, item: canonical }
    ]
  };

  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>${escapeHtml(item.caseTitle)} | 소소킹 판결소</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="소소킹 판결소">
  <meta property="og:locale" content="ko_KR">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(item.caseTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:image" content="${siteUrl}/og-image.svg">
  <meta property="article:published_time" content="${item.publishedDate}T09:00:00+09:00">
  <meta property="article:section" content="${escapeHtml(item.category)}">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(item.caseTitle)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <link rel="alternate" type="application/rss+xml" title="소소킹 창작 사건" href="${siteUrl}/rss.xml">
  <link rel="icon" href="/app-icon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&family=Noto+Serif+KR:wght@700;900&display=swap" rel="stylesheet">
  <style>${pageCss()}</style>
  <script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll('<', '\\u003c')}</script>
  <script type="application/ld+json">${JSON.stringify(breadcrumb).replaceAll('<', '\\u003c')}</script>
</head>
<body>
  <header class="site-head"><a href="/"><span>소소킹</span> 판결소</a></header>
  <main class="wrap">
    <article class="paper">
      <div class="eyebrow">SOSOKING CREATIVE CASE · ${escapeHtml(item.category)}</div>
      <h1>${escapeHtml(item.caseTitle)}</h1>
      <p class="summary">${escapeHtml(item.caseDescription)}</p>
      <div class="meta">
        <span class="chip">${escapeHtml(item.judgeIcon)} ${escapeHtml(item.judgeType)}</span>
        <span class="chip">억울지수 ${item.grievanceIndex}/10</span>
        <span class="chip">${escapeHtml(item.publishedDate)}</span>
        <span class="chip">창작 생활사건</span>
      </div>
      <section class="doc"><h2>사건접수</h2>${paragraphs(item.reception)}</section>
      <section class="doc"><h2>수사보고</h2>${paragraphs(item.investigation)}</section>
      <section class="doc"><h2>원고측 변론</h2>${paragraphs(item.plaintiffArg)}</section>
      <section class="doc"><h2>피고측 변론</h2>${paragraphs(item.defendantArg)}</section>
      <section class="doc"><h2>재판부 판결</h2><div class="order">${paragraphs(item.verdict)}</div></section>
      <div class="cta">
        <a class="btn primary" href="${interactive}">투표·댓글 가능한 판결문 보기</a>
        <a class="btn ghost" href="/cases/">다른 창작 사건 보기</a>
      </div>
      <p class="notice">이 페이지는 소소킹 판결소가 창작한 AI 기반 오락 콘텐츠이며 실제 법률 자문이나 법원 판결이 아닙니다.</p>
      <aside class="related"><h2>같은 분야의 다른 사건</h2><ul>${related.map(other => `<li><a href="/cases/${other.slug}/">${escapeHtml(other.caseTitle)}</a></li>`).join('')}</ul></aside>
    </article>
  </main>
  <footer class="site-foot">© 소소킹 판결소 · 사소한 억울함을 문서형 판결로</footer>
</body>
</html>`;
}

function archivePage() {
  const grouped = new Map();
  for (const item of cases) {
    if (!grouped.has(item.category)) grouped.set(item.category, []);
    grouped.get(item.category).push(item);
  }
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: '소소킹 창작 생활사건 모음',
    description: `${cases.length}개의 창작 생활분쟁과 AI 문서형 판결문 모음`,
    url: `${siteUrl}/cases/`,
    inLanguage: 'ko-KR',
    isPartOf: { '@type': 'WebSite', name: '소소킹 판결소', url: siteUrl }
  };
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <title>창작 생활사건 ${cases.length}선 | 소소킹 판결소</title>
  <meta name="description" content="가족, 친구, 회사, 음식, 집안일, 반려동물 등 사소하지만 억울한 창작 생활사건 ${cases.length}건과 AI 문서형 판결문을 모았습니다.">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${siteUrl}/cases/">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${siteUrl}/cases/">
  <meta property="og:title" content="창작 생활사건 ${cases.length}선 | 소소킹 판결소">
  <meta property="og:description" content="사소한 일상을 실제 문서처럼 진지하고 재치 있게 판결한 창작 사건 모음">
  <meta property="og:image" content="${siteUrl}/og-image.svg">
  <link rel="alternate" type="application/rss+xml" title="소소킹 창작 사건" href="${siteUrl}/rss.xml">
  <link rel="icon" href="/app-icon.svg" type="image/svg+xml">
  <style>${pageCss()}.group{margin:30px 0}.group h2{font-family:"Noto Serif KR",serif;color:#4a3217}.case-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.case-card{display:block;text-decoration:none;border:1px solid var(--line);border-radius:14px;padding:15px;background:#fff}.case-card b{display:block;color:#362513;margin-bottom:5px}.case-card span{font-size:12px;color:var(--muted)}@media(max-width:620px){.case-list{grid-template-columns:1fr}}</style>
  <script type="application/ld+json">${JSON.stringify(jsonLd).replaceAll('<', '\\u003c')}</script>
</head>
<body>
  <header class="site-head"><a href="/"><span>소소킹</span> 판결소</a></header>
  <main class="wrap">
    <section class="paper">
      <div class="eyebrow">CREATIVE CASE ARCHIVE</div>
      <h1>창작 생활사건 ${cases.length}선</h1>
      <p class="summary">가족·친구·회사·음식·배달·집안일·반려동물 등 일상에서 한 번쯤 겪을 법한 사소한 억울함을 독립적인 문서형 판결로 구성했습니다.</p>
      ${[...grouped.entries()].map(([category, items]) => `<section class="group"><h2>${escapeHtml(category)} <small>${items.length}건</small></h2><div class="case-list">${items.map(item => `<a class="case-card" href="/cases/${item.slug}/"><b>${escapeHtml(item.caseTitle)}</b><span>${escapeHtml(item.judgeIcon)} ${escapeHtml(item.judgeType)} · 억울지수 ${item.grievanceIndex}/10</span></a>`).join('')}</div></section>`).join('')}
      <div class="cta"><a class="btn primary" href="/#/submit">내 사건 접수하기</a><a class="btn ghost" href="/">홈으로</a></div>
      <p class="notice">모든 사건은 사이트 전용 창작 콘텐츠이며 실제 인물이나 사건과 관계없습니다.</p>
    </section>
  </main>
  <footer class="site-foot">© 소소킹 판결소</footer>
</body>
</html>`;
}

fs.rmSync(casesDir, { recursive: true, force: true });
fs.mkdirSync(casesDir, { recursive: true });

for (const item of cases) {
  const related = cases
    .filter(other => other.category === item.category && other.id !== item.id)
    .slice(0, 4);
  const target = path.join(casesDir, item.slug);
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'index.html'), fullPage(item, related));
}
fs.writeFileSync(path.join(casesDir, 'index.html'), archivePage());

const sitemapEntries = [
  { loc: `${siteUrl}/`, lastmod: source.generatedAt, priority: '1.0' },
  { loc: `${siteUrl}/cases/`, lastmod: source.generatedAt, priority: '0.9' },
  { loc: `${siteUrl}/guide`, lastmod: source.generatedAt, priority: '0.5' },
  ...cases.map(item => ({ loc: `${siteUrl}/cases/${item.slug}/`, lastmod: item.publishedDate, priority: '0.7' }))
];
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemapEntries.map(entry => `  <url><loc>${escapeXml(entry.loc)}</loc><lastmod>${entry.lastmod}</lastmod><changefreq>monthly</changefreq><priority>${entry.priority}</priority></url>`).join('\n')}\n</urlset>\n`;
fs.writeFileSync(path.join(publicDir, 'sitemap.xml'), sitemap);

const rssItems = [...cases].reverse().slice(0, 50).map(item => `  <item>
    <title>${escapeXml(item.caseTitle)}</title>
    <link>${siteUrl}/cases/${item.slug}/</link>
    <guid isPermaLink="true">${siteUrl}/cases/${item.slug}/</guid>
    <pubDate>${new Date(`${item.publishedDate}T00:00:00+09:00`).toUTCString()}</pubDate>
    <description>${escapeXml(item.caseDescription)}</description>
    <category>${escapeXml(item.category)}</category>
  </item>`).join('\n');
const rss = `<?xml version="1.0" encoding="UTF-8"?>\n<rss version="2.0"><channel>
  <title>소소킹 창작 생활사건</title>
  <link>${siteUrl}/cases/</link>
  <description>사소한 생활분쟁을 문서형 판결로 만든 창작 사건 모음</description>
  <language>ko-kr</language>
  <lastBuildDate>${new Date(`${source.generatedAt}T09:00:00+09:00`).toUTCString()}</lastBuildDate>
${rssItems}
</channel></rss>\n`;
fs.writeFileSync(path.join(publicDir, 'rss.xml'), rss);

const robots = `User-agent: *\nAllow: /\nDisallow: /admin/\nDisallow: /auth\nDisallow: /my-cases\nDisallow: /submit\nDisallow: /trial/\nSitemap: ${siteUrl}/sitemap.xml\n`;
fs.writeFileSync(path.join(publicDir, 'robots.txt'), robots);

console.log(`Generated ${cases.length} SEO case pages, sitemap.xml, rss.xml and robots.txt.`);
