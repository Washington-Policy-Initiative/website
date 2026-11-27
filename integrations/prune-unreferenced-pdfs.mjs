/**
 * Astro integration: after a production build, delete any publication PDF in dist/
 * that no built page links to.
 *
 * Why: everything in public/ is copied into the build unconditionally. A draft
 * publication gets no page, but its PDF would still be downloadable at a guessable
 * URL. Scanning the built HTML for links means "referenced by a published page" is
 * the only way a PDF ships.
 */
import { readdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PDF_DIR = path.join('files', 'publications');
const LINK = /\/files\/publications\/([a-z0-9][a-z0-9._-]*\.pdf)/gi;

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(full);
    else if (entry.name.endsWith('.html')) yield full;
  }
}

export default function pruneUnreferencedPdfs() {
  return {
    name: 'prune-unreferenced-pdfs',
    hooks: {
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        const pdfDir = path.join(root, PDF_DIR);

        let pdfs;
        try {
          pdfs = (await readdir(pdfDir)).filter((f) => f.toLowerCase().endsWith('.pdf'));
        } catch {
          return; // no PDFs at all
        }

        const referenced = new Set();
        for await (const file of htmlFiles(root)) {
          const html = await readFile(file, 'utf8');
          for (const match of html.matchAll(LINK)) referenced.add(match[1]);
        }

        for (const pdf of pdfs) {
          if (!referenced.has(pdf)) {
            await rm(path.join(pdfDir, pdf));
            logger.info(`Removed unpublished PDF from build: ${PDF_DIR}/${pdf}`);
          }
        }
      },
    },
  };
}
