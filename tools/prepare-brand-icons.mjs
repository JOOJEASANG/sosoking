import fs from 'node:fs';
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
const ogText = Buffer.from(`<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
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
</svg>`);
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
  console.log(`Prepared ${relative} (${stat.size} bytes)`);
}
