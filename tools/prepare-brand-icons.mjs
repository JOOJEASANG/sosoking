import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const root = process.cwd();
const sourcePath = path.join(root, 'assets', 'brand', 'play-logo.svg');
const maskableSourcePath = path.join(root, 'assets', 'brand', 'play-logo-maskable.svg');
const ogSourcePath = path.join(root, 'assets', 'brand', 'play-og.svg');
const publicDir = path.join(root, 'public');
const iconDir = path.join(publicDir, 'icons');
const source = fs.readFileSync(sourcePath);
const maskableSource = fs.readFileSync(maskableSourcePath);
const ogSource = fs.readFileSync(ogSourcePath);

fs.mkdirSync(iconDir, { recursive: true });

async function squareIcon(size, output) {
  await sharp(source)
    .resize(size, size, { fit: 'contain' })
    .png({ compressionLevel: 9, quality: 95 })
    .toFile(output);
}

await squareIcon(512, path.join(publicDir, 'logo.png'));
await squareIcon(512, path.join(iconDir, 'sosoking-512.png'));
await squareIcon(192, path.join(iconDir, 'sosoking-192.png'));
await squareIcon(48, path.join(iconDir, 'favicon-48.png'));
await squareIcon(32, path.join(iconDir, 'favicon-32.png'));
await sharp(maskableSource)
  .resize(512, 512, { fit: 'cover' })
  .png({ compressionLevel: 9, quality: 95 })
  .toFile(path.join(iconDir, 'sosoking-maskable-512.png'));

fs.copyFileSync(sourcePath, path.join(publicDir, 'app-icon.svg'));

await sharp(ogSource)
  .resize(1200, 630, { fit: 'fill' })
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
