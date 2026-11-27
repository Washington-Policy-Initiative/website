#!/usr/bin/env node
/**
 * Render the raster copies of the W logo tile (src/assets/brand/logo-w-tile.svg):
 *   public/og-image.png          1200×1200, the image shown when a page is shared (social sites need a raster)
 *   public/apple-touch-icon.png  180×180, the icon iOS uses for home-screen bookmarks
 *
 * Run by hand after the logo changes:  node scripts/build-brand-images.mjs
 * The outputs are committed. sharp writes no metadata unless asked, and
 * `npm run check` verifies that.
 */
import sharp from 'sharp';

const SOURCE = 'src/assets/brand/logo-w-tile.svg';
const outputs = [
  { file: 'public/og-image.png', size: 1200 },
  { file: 'public/apple-touch-icon.png', size: 180 },
];

for (const { file, size } of outputs) {
  await sharp(SOURCE, { density: 300 }).resize(size, size).png({ compressionLevel: 9 }).toFile(file);
  console.log(`Wrote ${file} (${size}×${size})`);
}
