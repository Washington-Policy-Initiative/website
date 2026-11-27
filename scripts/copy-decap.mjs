#!/usr/bin/env node
/**
 * Copy Decap CMS's prebuilt bundle from node_modules into public/admin/decap/.
 *
 * Why self-host instead of loading Decap from a CDN (unpkg/jsDelivr)?
 *  - The exact version is pinned in package-lock.json (with an integrity hash) and
 *    gets Dependabot updates.
 *  - The admin page's CSP can stay `script-src 'self'`, with no third-party script origin.
 *  - A compromised or unavailable CDN can't change or break the CMS.
 *
 * The output folder is gitignored; it's regenerated on every dev/build.
 */
import { cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const src = path.join('node_modules', 'decap-cms', 'dist');
const dest = path.join('public', 'admin', 'decap');

await rm(dest, { recursive: true, force: true });
await mkdir(dest, { recursive: true });

let count = 0;
for (const name of await readdir(src)) {
  // decap-cms.js loads its numbered chunks (e.g. 103.decap-cms.js) relative to itself.
  // Skip source maps and the alternate "cms.js" build.
  if (name.endsWith('decap-cms.js')) {
    await cp(path.join(src, name), path.join(dest, name));
    count += 1;
  }
}
console.log(`Copied ${count} Decap CMS files to ${dest}`);
