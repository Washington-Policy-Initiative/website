#!/usr/bin/env node
/**
 * CI guard: fail if any committed image under src/ or public/ still carries metadata
 * (EXIF, which can include GPS coordinates; XMP; IPTC). The repo is public, so the
 * original files are visible even when the site only serves re-encoded copies.
 *
 * PDFs are checked too, but only as warnings: PDF metadata (Author, Creator, Producer,
 * XMP) is often harmless, yet it can leak names, usernames, or file paths. Clear it
 * on export (e.g. File → Properties) before uploading.
 *
 * Fix flagged images with: node scripts/strip-image-metadata.mjs <file>
 */
import sharp from 'sharp';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOTS = ['src', 'public'];
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.tif', '.tiff', '.gif']);
const SKIP_DIRS = new Set(['node_modules', 'decap']);

async function* walk(dir) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) yield* walk(full);
    } else {
      yield full;
    }
  }
}

const failures = [];
const warnings = [];

for (const root of ROOTS) {
  for await (const file of walk(root)) {
    const ext = path.extname(file).toLowerCase();
    if (IMAGE_EXT.has(ext)) {
      const meta = await sharp(file).metadata();
      const found = [];
      if (meta.exif) found.push('EXIF');
      if (meta.xmp) found.push('XMP');
      if (meta.iptc) found.push('IPTC');
      if (found.length > 0) failures.push(`${file}: ${found.join(', ')}`);
    } else if (ext === '.pdf') {
      const text = (await readFile(file)).toString('latin1');
      const found = [];
      for (const key of ['Author', 'Creator', 'Producer', 'Title', 'Subject', 'Keywords']) {
        // Matches a non-empty info-dictionary value like /Author (Jane Doe)
        if (new RegExp(`/${key}\\s*\\((?!\\))`).test(text)) found.push(key);
      }
      if (text.includes('<x:xmpmeta')) found.push('XMP');
      if (found.length > 0) warnings.push(`${file}: ${found.join(', ')}`);
    }
  }
}

for (const w of warnings) console.warn(`warning: PDF metadata present: ${w}`);

if (failures.length > 0) {
  console.error('Images with metadata found (strip with scripts/strip-image-metadata.mjs):');
  for (const f of failures) console.error(`  ${f}`);
  process.exit(1);
}
console.log('Image metadata check passed.');
