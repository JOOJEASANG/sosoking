import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const sourceDir = path.join(root, 'assets', 'brand');
const outputDir = path.join(root, 'public', 'icons');

const files = [
  {
    output: 'sosoking-192.png',
    parts: ['sosoking-192.b64'],
    width: 192,
    height: 192
  },
  {
    output: 'sosoking-512.png',
    parts: ['sosoking-512.b64.001', 'sosoking-512.b64.002', 'sosoking-512.b64.003'],
    width: 512,
    height: 512
  }
];

function readPngSize(buffer) {
  const signature = '89504e470d0a1a0a';
  if (buffer.subarray(0, 8).toString('hex') !== signature) {
    throw new Error('Invalid PNG signature');
  }
  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  };
}

fs.mkdirSync(outputDir, { recursive: true });

for (const icon of files) {
  const encoded = icon.parts
    .map(file => fs.readFileSync(path.join(sourceDir, file), 'utf8').trim())
    .join('');
  const buffer = Buffer.from(encoded, 'base64');
  const size = readPngSize(buffer);
  if (size.width !== icon.width || size.height !== icon.height) {
    throw new Error(`${icon.output} has unexpected size ${size.width}x${size.height}`);
  }
  fs.writeFileSync(path.join(outputDir, icon.output), buffer);
  console.log(`Prepared ${icon.output} (${buffer.length} bytes)`);
}
