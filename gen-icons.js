const sharp = require('sharp');
const path = require('path');
const pub = path.join(__dirname, 'public');

async function gen(src, dest, size) {
  await sharp(src)
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(dest);
  console.log(`✓ ${dest} (${size}x${size})`);
}

(async () => {
  // Regular icons (any purpose) — transparent corners OK
  await gen(`${pub}/icon-any.svg`,      `${pub}/icon-192.png`,          192);
  await gen(`${pub}/icon-any.svg`,      `${pub}/icon-512.png`,          512);
  // Maskable icons — full bleed background
  await gen(`${pub}/icon-maskable.svg`, `${pub}/icon-192-maskable.png`, 192);
  await gen(`${pub}/icon-maskable.svg`, `${pub}/icon-512-maskable.png`, 512);
  console.log('Done!');
})().catch(e => { console.error(e); process.exit(1); });
