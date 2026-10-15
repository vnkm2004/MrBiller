// Generates PNG icons from the SVG icon using sharp
// Run with: node scripts/generate-icons.mjs
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const iconsDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

const svgPath = join(iconsDir, 'icon.svg');
const svgBuffer = readFileSync(svgPath);

// Generate different sizes
const sizes = [192, 512, 180]; // 180 for apple-touch-icon

for (const size of sizes) {
  const outputName = size === 180 ? 'apple-touch-icon.png' : `icon-${size}.png`;
  const outputPath = join(iconsDir, outputName);
  
  await sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(outputPath);
  
  console.log(`Generated: ${outputName} (${size}x${size})`);
}

// Generate favicon
await sharp(svgBuffer)
  .resize(32, 32)
  .png()
  .toFile(join(iconsDir, 'favicon-32.png'));
console.log('Generated: favicon-32.png');

console.log('All icons generated successfully!');
