import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const version = '20260729-brand-unified-1';

function file(name) {
  return path.join(root, name);
}

function read(name) {
  return fs.readFileSync(file(name), 'utf8');
}

function write(name, content) {
  fs.writeFileSync(file(name), content);
}

function replace(name, from, to, expected = 1) {
  const source = read(name);
  const count = source.split(from).length - 1;
  if (count !== expected) {
    throw new Error(`${name}: expected ${expected} occurrence(s) of ${JSON.stringify(from)}, found ${count}`);
  }
  write(name, source.split(from).join(to));
}

const prepareIcons = `import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourcePath = path.join(root, 'assets', 'brand', 'unified-logo.webp.b64');
const publicDir = path.join(root, 'public');
const iconDir = path.join(publicDir, 'icons');
const source = Buffer.from(fs.readFileSync(sourcePath, 'utf8').trim(), 'base64');

fs.mkdirSync(iconDir, { recursive: true });

async function transparentIcon(size, output) {
  await sharp(source)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9, palette: true, quality: 95 })
    .toFile(output);
}

await transparentIcon(512, path.join(publicDir, 'logo.png'));
await transparentIcon(512, path.join(iconDir, 'sosoking-512.png'));
await transparentIcon(192, path.join(iconDir, 'sosoking-192.png'));
await transparentIcon(48, path.join(iconDir, 'favicon-48.png'));
await transparentIcon(32, path.join(iconDir, 'favicon-32.png'));

const maskableLogo = await sharp(source)
  .resize(360, 360, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: '#0b0f16' }
})
  .composite([{ input: maskableLogo, gravity: 'centre' }])
  .png({ compressionLevel: 9, palette: true, quality: 95 })
  .toFile(path.join(iconDir, 'sosoking-maskable-512.png'));

const ogLogo = await sharp(source)
  .resize(470, 470, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer();
const ogText = Buffer.from(\`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="25%" cy="50%" r="48%">
      <stop offset="0" stop-color="#c9a84c" stop-opacity=".2"/>
      <stop offset="1" stop-color="#0b0f16" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="#0b0f16"/>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="555" y="275" fill="#e8c97a" font-size="72" font-weight="800" font-family="Noto Serif KR, Noto Serif CJK KR, serif">소소킹 판결소</text>
  <text x="558" y="345" fill="#f5f0e8" font-size="34" font-weight="600" font-family="Noto Sans KR, Noto Sans CJK KR, sans-serif">사소한 억울함도 과하게 진지하게</text>
  <text x="558" y="405" fill="#f5f0e8" font-size="34" font-weight="600" font-family="Noto Sans KR, Noto Sans CJK KR, sans-serif">판결하는 AI 생활법정</text>
  <text x="558" y="475" fill="#aaa79f" font-size="24" font-family="Noto Sans KR, Noto Sans CJK KR, sans-serif">오락 서비스 · 법적 효력 없음</text>
</svg>\`);
await sharp(ogText)
  .composite([{ input: ogLogo, left: 55, top: 80 }])
  .png({ compressionLevel: 9, quality: 95 })
  .toFile(path.join(publicDir, 'og-image.png'));

for (const relative of [
  'public/logo.png',
  'public/icons/sosoking-192.png',
  'public/icons/sosoking-512.png',
  'public/icons/sosoking-maskable-512.png',
  'public/icons/favicon-32.png',
  'public/icons/favicon-48.png',
  'public/og-image.png'
]) {
  const stat = fs.statSync(path.join(root, relative));
  console.log(\`Prepared \${relative} (\${stat.size} bytes)\`);
}
`;
write('tools/prepare-brand-icons.mjs', prepareIcons);

replace('public/js/pages/home.js', '/logo.svg?v=20260729-logo-feed-1', `/logo.png?v=${version}`);
replace('public/js/pages/home-court.js', "const BRAND_LOGO = '/logo.svg?v=20260729-logo-feed-1';", `const BRAND_LOGO = '/logo.png?v=${version}';`);
replace('public/js/pages/home-court.js', "const BRAND_LOGO_FALLBACK = '/icons/sosoking-192.png?v=20260729-logo-feed-1';", `const BRAND_LOGO_FALLBACK = '/icons/sosoking-192.png?v=${version}';`);

replace('public/css/brand-logo.css', "content: url('/logo.svg?v=20260729-logo-feed-1');", `content: url('/logo.png?v=${version}');`);
replace('public/css/brand-logo.css', "background: transparent url('/icons/sosoking-192.png?v=20260728-ui-audit-2') center/contain no-repeat;", `background: transparent url('/icons/sosoking-192.png?v=${version}') center/contain no-repeat;`);
write('public/css/brand-logo.css', read('public/css/brand-logo.css') + `

.auth-brand-logo {
  display: block;
  width: 112px;
  height: 112px;
  object-fit: contain;
  margin: 0 auto 10px;
  filter: drop-shadow(0 10px 18px rgba(0,0,0,.34));
}

.nav-brand-icon {
  display: block;
  width: 25px;
  height: 25px;
  object-fit: contain;
  margin: -3px auto -2px;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,.35));
}

.footer-brand-logo {
  display: block;
  width: 58px;
  height: 58px;
  object-fit: contain;
  margin: 0 auto 12px;
  filter: drop-shadow(0 6px 12px rgba(0,0,0,.3));
}
`);

replace(
  'public/js/pages/auth2.js',
  '<div style="font-size:46px;margin-bottom:8px;">⚖️</div>',
  `<img class="auth-brand-logo" src="/logo.png?v=${version}" alt="소소킹 저울 로고" width="112" height="112">`
);
replace(
  'public/js/components/nav.js',
  '<span class="nav-icon">⚖️</span>',
  `<span class="nav-icon"><img class="nav-brand-icon" src="/icons/sosoking-192.png?v=${version}" alt="" width="25" height="25"></span>`
);
replace(
  'public/js/components/footer.js',
  '  footer.innerHTML = `\n    <div class="footer-links">',
  `  footer.innerHTML = \`\n    <img class="footer-brand-logo" src="/icons/sosoking-192.png?v=${version}" alt="소소킹 저울 로고" width="58" height="58">\n    <div class="footer-links">`
);

replace('public/js/app.js', "./pages/home-court.js?v=20260729-script-csp-1", `./pages/home-court.js?v=${version}`);
replace('public/js/app.js', "./pages/auth2.js?v=20260729-auth-session-1", `./pages/auth2.js?v=${version}`);
replace('public/js/app.js', "./components/footer.js?v=20260728-logo-cleanup-1", `./components/footer.js?v=${version}`);
replace('public/js/app.js', "./components/nav.js?v=20260729-route-sync-1", `./components/nav.js?v=${version}`);

replace('public/index.html', 'https://sosoking.co.kr/og-image.svg?v=20260728-audit-1', `https://sosoking.co.kr/og-image.png?v=${version}`, 2);
replace('public/index.html', '<link rel="icon" href="/icons/sosoking-192.png?v=20260728-pwa-install-1" type="image/png" sizes="192x192">', `<link rel="icon" href="/icons/favicon-32.png?v=${version}" type="image/png" sizes="32x32">\n  <link rel="icon" href="/icons/favicon-48.png?v=${version}" type="image/png" sizes="48x48">`);
replace('public/index.html', '<link rel="shortcut icon" href="/icons/sosoking-192.png?v=20260728-pwa-install-1" type="image/png">', `<link rel="shortcut icon" href="/icons/favicon-48.png?v=${version}" type="image/png">`);
replace('public/index.html', '<link rel="apple-touch-icon" href="/icons/sosoking-192.png?v=20260728-pwa-install-1" sizes="192x192">', `<link rel="apple-touch-icon" href="/icons/sosoking-192.png?v=${version}" sizes="192x192">`);
replace('public/index.html', '/site.webmanifest?v=20260728-pwa-install-1', `/site.webmanifest?v=${version}`);
replace('public/index.html', '/css/brand-logo.css?v=20260729-logo-feed-1', `/css/brand-logo.css?v=${version}`);
replace('public/index.html', '/js/app.js?v=20260729-own-case-delete-1', `/js/app.js?v=${version}`);

replace('public/admin/index.html', '/icons/sosoking-192.png?v=20260728-ui-audit-2', `/icons/favicon-48.png?v=${version}`);
replace('public/admin/index.html', '/css/brand-logo.css?v=20260728-ui-audit-2', `/css/brand-logo.css?v=${version}`);

const manifest = JSON.parse(read('public/site.webmanifest'));
manifest.icons = [
  { src: '/icons/sosoking-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
  { src: '/icons/sosoking-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  { src: '/icons/sosoking-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
];
write('public/site.webmanifest', `${JSON.stringify(manifest, null, 2)}\n`);

replace('public/sw.js', "const CACHE_NAME = 'sosoking-app-v20260729-own-case-delete-1';", `const CACHE_NAME = 'sosoking-app-v${version}';`);
replace('public/sw.js', '/site.webmanifest?v=20260728-pwa-install-1', `/site.webmanifest?v=${version}`);
replace('public/sw.js', '/css/brand-logo.css?v=20260729-logo-feed-1', `/css/brand-logo.css?v=${version}`);
replace('public/sw.js', '/js/app.js?v=20260729-own-case-delete-1', `/js/app.js?v=${version}`);
replace('public/sw.js', '/logo.svg?v=20260729-logo-feed-1', `/logo.png?v=${version}`);
replace('public/sw.js', "  '/icons/sosoking-512.png'", "  '/icons/sosoking-512.png',\n  '/icons/sosoking-maskable-512.png',\n  '/icons/favicon-32.png',\n  '/icons/favicon-48.png',\n  '/og-image.png'");

replace('tools/check-script-csp.mjs', './pages/home-court.js?v=20260729-script-csp-1', `./pages/home-court.js?v=${version}`);
replace('tools/check-ui-audit.mjs', "checkPng('public/icons/sosoking-512.png', 512, 512);", "checkPng('public/icons/sosoking-512.png', 512, 512);\ncheckPng('public/icons/sosoking-maskable-512.png', 512, 512);\ncheckPng('public/icons/favicon-48.png', 48, 48);\ncheckPng('public/icons/favicon-32.png', 32, 32);\ncheckPng('public/logo.png', 512, 512);\ncheckPng('public/og-image.png', 1200, 630);");
replace('tools/check-ui-audit.mjs', "/logo.svg?v=20260729-logo-feed-1", `/logo.png?v=${version}`);
replace('tools/check-ui-audit.mjs', 'home-court.js: current SVG logo path is missing', 'home-court.js: unified PNG logo path is missing');
replace('tools/check-ui-audit.mjs', '/site.webmanifest?v=20260728-pwa-install-1', `/site.webmanifest?v=${version}`);
replace('tools/check-ui-audit.mjs', "if (!icons.some(icon => icon.sizes === '512x512' && String(icon.purpose).includes('maskable'))) {", "if (!icons.some(icon => icon.src === '/icons/sosoking-maskable-512.png' && icon.sizes === '512x512' && String(icon.purpose).includes('maskable'))) {");
replace('tools/check-ui-audit.mjs', "const app = read('public/js/app.js');", `if (!auth.includes('class="auth-brand-logo"') || !auth.includes('/logo.png?v=${version}')) {\n  errors.push('auth2.js: unified account logo is missing');\n}\n\nconst nav = read('public/js/components/nav.js');\nif (!nav.includes('class="nav-brand-icon"') || !nav.includes('/icons/sosoking-192.png?v=${version}')) {\n  errors.push('nav.js: unified navigation logo is missing');\n}\n\nconst footer = read('public/js/components/footer.js');\nif (!footer.includes('class="footer-brand-logo"')) {\n  errors.push('footer.js: unified footer logo is missing');\n}\n\nconst app = read('public/js/app.js');`);
replace('tools/check-ui-audit.mjs', 'UI audit validation passed: logo PNGs, authentication, theme contrast, and Chrome-badge-free PWA install flow.', 'UI audit validation passed: unified brand logo assets, authentication, theme contrast, and PWA install flow.');

console.log('Unified logo patches applied.');
