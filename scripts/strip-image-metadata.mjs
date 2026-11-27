#!/usr/bin/env node
/**
 * Strip all metadata (EXIF incl. GPS, XMP, IPTC, ICC) from images before committing them.
 *
 *   node scripts/strip-image-metadata.mjs <input> [output]
 *
 * With one argument the file is rewritten in place. The image is re-encoded by sharp,
 * which writes no metadata unless asked to. `.rotate()` first applies the EXIF
 * orientation to the pixels, so photos don't end up sideways once the orientation
 * tag is gone. Pixels are converted to sRGB before the ICC profile is dropped.
 */
import sharp from 'sharp';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const [input, output = input] = process.argv.slice(2);
if (!input) {
  console.error('Usage: node scripts/strip-image-metadata.mjs <input> [output]');
  process.exit(1);
}

const ext = path.extname(output).toLowerCase();
const source = await readFile(input);
let pipeline = sharp(source).rotate().toColorspace('srgb');

if (ext === '.jpg' || ext === '.jpeg') pipeline = pipeline.jpeg({ quality: 88, mozjpeg: true });
else if (ext === '.png') pipeline = pipeline.png({ compressionLevel: 9 });
else if (ext === '.webp') pipeline = pipeline.webp({ quality: 88 });
else if (ext === '.avif') pipeline = pipeline.avif({ quality: 60 });
else {
  console.error(`Unsupported output type: ${ext}`);
  process.exit(1);
}

const result = await pipeline.toBuffer();
await writeFile(output, result);

const meta = await sharp(result).metadata();
const leftovers = ['exif', 'xmp', 'iptc', 'icc'].filter((k) => meta[k]);
if (leftovers.length > 0) {
  console.error(`Metadata still present (${leftovers.join(', ')}) in ${output}`);
  process.exit(1);
}
console.log(`Stripped metadata: ${output} (${meta.width}×${meta.height})`);
