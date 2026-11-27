/**
 * Astro integration: after a production build, write dist/sitemap.xml listing every built
 * page, and add a matching "Sitemap:" line to dist/robots.txt. Both use the `site` setting
 * (SITE_URL in src/config/site.ts), so the domain lives in one place.
 *
 * Built from the final HTML (not a hand-kept list), so new pages are included automatically.
 * Left out: the 404 page, the CMS (/admin/), and any page marked noindex.
 * No dependency needed (instead of @astrojs/sitemap).
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

const escapeXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export default function sitemap() {
  let site;
  return {
    name: 'wpi-sitemap',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site;
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (!site) {
          logger.warn('No `site` set; skipping sitemap.xml.');
          return;
        }
        const root = fileURLToPath(dir);
        const urls = [];
        for await (const file of htmlFiles(root)) {
          const rel = path.relative(root, file).split(path.sep).join('/');
          if (rel === '404.html' || rel.startsWith('admin/')) continue;
          const html = await readFile(file, 'utf8');
          if (/<meta[^>]+name="robots"[^>]+noindex/i.test(html)) continue;
          // build.format 'directory': about/index.html -> /about/
          const pathname = '/' + rel.replace(/index\.html$/, '');
          urls.push(new URL(pathname, site).href);
        }
        urls.sort();
        const xml =
          '<?xml version="1.0" encoding="UTF-8"?>\n' +
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
          urls.map((u) => `  <url><loc>${escapeXml(u)}</loc></url>`).join('\n') +
          '\n</urlset>\n';
        await writeFile(path.join(root, 'sitemap.xml'), xml);

        const robotsPath = path.join(root, 'robots.txt');
        const robots = await readFile(robotsPath, 'utf8').catch(() => 'User-agent: *\nAllow: /\n');
        await writeFile(robotsPath, `${robots.trimEnd()}\nSitemap: ${new URL('/sitemap.xml', site).href}\n`);
        logger.info(`sitemap.xml: ${urls.length} pages`);
      },
    },
  };
}
