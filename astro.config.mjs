// @ts-check
import { defineConfig } from 'astro/config';
import pruneUnreferencedPdfs from './integrations/prune-unreferenced-pdfs.mjs';
import sitemap from './integrations/sitemap.mjs';
import { SITE_URL } from './src/config/site.ts';

export default defineConfig({
  site: SITE_URL,
  output: 'static',
  trailingSlash: 'ignore',

  build: {
    format: 'directory',
    // Always emit CSS as external files, never <style> tags, so the CSP can use
    // style-src 'self' without 'unsafe-inline'.
    inlineStylesheets: 'never',
  },

  vite: {
    build: {
      // Never turn small assets into data: URIs; keeps img-src/font-src at 'self'.
      assetsInlineLimit: 0,
    },
  },

  // The dev toolbar injects its own scripts in `astro dev`; we don't need it.
  devToolbar: { enabled: false },

  // sitemap runs after the PDF prune, on the final dist/.
  integrations: [pruneUnreferencedPdfs(), sitemap()],
});
