# Washington Policy Initiative website

Static site for the **Washington Policy Initiative (WPI)**, a nonpartisan, student-led policy think tank at the University of Washington: <https://wapolicyinitiative.org>.

- **Stack:** Astro 7 (static output) → Cloudflare Pages. Content is edited through Decap CMS at `/admin/` (GitHub login via a small OAuth function in `functions/api/`).
- **Repo:** public, `Washington-Policy-Initiative/website` (`GITHUB_REPO` in `src/config/site.ts`). Site address: `SITE_URL` in the same file.
- Private, untracked notes for maintainers may live in `CLAUDE.local.md` (gitignored). Never commit it.

## Ground rules

1. **Never put secrets in files.** The only secrets (GitHub OAuth client ID/secret) go in Cloudflare Pages environment variables. `.env.example` lists names only.
2. **`reference/` is gitignored and never published.** It holds source material (an old site export, form responses, original photos). Use it for facts only. Never copy its structure or design, and never commit anything from it.
3. Name: always **"Washington Policy Initiative"**. Never "Washington Policy Institute" or "WPI @ UW". Contact email: `washingtonpolicyinitiative@gmail.com`.
4. **Do not invent people** or facts about them.
5. Verify changes with `npm run check` and `npm run build` before calling them done.
6. Wording: "Research" (the page; the nav menu item is "Our Work"); "Executive Board" (never "Exec Board"); "Faculty Advisor" singular while there's one advisor (use `facultyLabel()`).

## Organization (as the site presents it)

- Four policy areas: **Economic, Education, Environmental, Civic**.
- Members: an **Executive Board**, a **Research Cohort** in four policy area teams, each **led by a project lead** (a cohort member with extra responsibility; *not* an Executive Board member), and a **Faculty Advisor**. People are entries in `src/content/people/`.

## Sitemap

| URL | Page |
|---|---|
| `/` | Home: full-screen Mt. Rainier photo with title, tagline, and buttons (photo credit in the corner), mission, policy areas, Recent work / Work in progress |
| `/research/` | Recent work → Work in progress → Publications. Filters in the URL: `?type=&area=&quarter=` (Publications) and `?wip-type=&wip-area=&wip-quarter=` (Work in progress) |
| `/research/washington-library-gap-map/` | **Washington Library Gap Map** (Data Tool): overview, key figures, D3 district map (keyboard: one tab stop, arrows move alphabetically, Enter opens), district search (clicking, tapping, or pressing Enter on a district selects it exactly like search: report, `?district=` URL, scroll into view). **Never move district `<path>`s in the DOM** (e.g. `appendChild` to raise one): it re-fires `mouseenter` in a loop and the browser drops clicks. Hover / keyboard-active / selected outlines are copies drawn on a `.gm-outlines` layer with `pointer-events: none`. District report (`?district=<id>`, shareable, Back works; its Librarian FTE chart has a hover/tap tooltip with the year's district / group average / statewide values, beside the guide line on wide screens and above the chart on narrow ones), locale-group chart with year slider, sortable table of all districts, About the data. Also serves `data.json` + `districts.json` (built from `src/data/gapmap/` by `src/lib/gapmap.ts`). |
| `/research/[slug]/` | Published paper: type/quarter line, area tags, authors, date, abstract, **View PDF** (new tab) + **Download PDF**. Never embed PDFs. |
| `/areas/[area]/` | One policy area: description, research team (project lead first once set), that area's publications and work in progress |
| `/team/` | Faculty Advisor → Executive Board → Research Cohort |
| `/team/[slug]/` | Profile (current members only): photo, title, pronouns, area, links. Students: bio, then publications / work in progress. Faculty: an "About" section instead of publications |
| `/about/`, `/faq/`, `/join/`, `/contact/` | About; FAQ (from the CMS, grouped, `<details>`); Join (Apply button only when applications are open **and** a form URL is set); Contact (email + social links, no form) |
| `/404` | Not found |
| `/admin/` | Decap CMS (noindex, not linked). In `astro dev` open `/admin/index.html`; plain `/admin/` 404s on the dev server only. |
| `/sitemap.xml` | Generated after each build by `integrations/sitemap.mjs` from the built pages (skips 404, `/admin/`, noindex pages); it also adds the `Sitemap:` line to `robots.txt`. Both use `SITE_URL`. |

**Header nav:** Home · Research ▾ ("Our Work", "Washington Library Gap Map") · Policy Areas ▾ (one link per area, from `POLICY_AREAS`) · Team · About · Join. There is no `/areas/` overview page. Dropdowns are disclosure menus (`Header.astro` + `src/scripts/nav-menu.ts`): open on hover, click/tap, and keyboard focus; Escape closes and returns focus; CSS fallback without JS. Add items via `children` in Header's `nav` list. **Footer:** wordmark, tagline, Contact, FAQ, email, socials, and a bottom row with the W tile and ©.

## Project structure

```
astro.config.mjs            static output, inlineStylesheets 'never', assetsInlineLimit 0, integrations
tsconfig.json               extends astro strict; excludes functions/, reference/, public/
package.json / package-lock.json / .npmrc / .nvmrc
.env.example                secret NAMES only
README.md, SECURITY.md      public overview; private vulnerability reporting
functions/api/auth.js       OAuth step 1 (Cloudflare Pages Function)
functions/api/callback.js   OAuth step 2: token exchange + postMessage to own origin
integrations/
  prune-unreferenced-pdfs.mjs   deletes unlinked PDFs from dist/ after build
  sitemap.mjs                   writes dist/sitemap.xml + robots.txt Sitemap line
scripts/
  build-cms-config.mjs      generates public/admin/config.yml from taxonomy (gitignored output)
  copy-decap.mjs            copies Decap bundle from node_modules to public/admin/decap/ (gitignored)
  check-image-metadata.mjs  fails on EXIF/XMP/IPTC in src/ and public/ images; warns on PDF metadata
  strip-image-metadata.mjs  strips metadata from an image (sharp)
  build-brand-images.mjs    renders og-image.png and apple-touch-icon.png from the W tile
public/
  _headers                  security headers (CSP etc.)
  robots.txt, favicon.svg (W tile), og-image.png, apple-touch-icon.png
  loader-gate.js            loading-screen gate (see Loading screen)
  admin/index.html          Decap shell (no inline script)
  files/publications/       uploaded PDFs
.github/
  workflows/ci.yml          npm ci, audit (prod), check, build, no-inline-code check
  dependabot.yml            npm + actions, 14-day cooldown
  rulesets/main.json        import into GitHub: block force push + deletion
src/
  config/taxonomy.ts        ALL fixed tag lists (types, areas, quarters, roles, statuses, FAQ categories)
  config/site.ts            SITE_NAME, SITE_URL, GITHUB_REPO, HEADER_LOGO, counts
  content.config.ts         Zod schemas for all collections
  content/{publications,people,areas,faq,pages}/*.md
  data/settings.json        email, socials, recruitment (validated by src/lib/settings.ts)
  data/gapmap/              Gap Map source data (CSV, GeoJSON)
  lib/content.ts            query helpers (drafts, work in progress, alumni, authors, facultyLabel, byLastName, dates)
  lib/gapmap.ts             Gap Map data processing at build time
  lib/settings.ts           settings schema (https-only URLs)
  lib/avatar.ts             photo sizes (md / ml / lg)
  styles/tokens.css         ALL colors, fonts, sizes, spacing
  styles/global.css         base styles + utilities (.prose, .grid-2, .grid-4, .section-heading…)
  layouts/BaseLayout.astro
  components/               Header, Footer, Wordmark, PageHeader, ComingSoon, PublicationCard (lead/card/row),
                            PubMeta, AreaTags, AuthorList, Avatar, PhotoPlaceholder, PersonCard,
                            PlaceholderPersonCard, PeopleGrid, FilterPanel, SocialIcon, SiteLoader, gapmap/*
  scripts/                  research-filters.ts, nav-menu.ts, gapmap.ts, site-loader.ts
  pages/                    routes from the sitemap
  assets/site/mt-rainier.jpg (+ ATTRIBUTION.md), assets/people/, assets/brand/
```

## Single source of truth

| What | Where |
|---|---|
| Fixed tag lists | `src/config/taxonomy.ts` |
| Content schemas (enforced at build) | `src/content.config.ts` (imports enums from taxonomy) |
| CMS config | **Generated** to `public/admin/config.yml` by `scripts/build-cms-config.mjs`. Don't edit the YAML; it's gitignored and rebuilt by `npm run dev`/`build` |
| Site settings | `src/data/settings.json` |
| Design tokens | `src/styles/tokens.css`. Components use only `var(--…)` |
| Site address, repo, counts | `src/config/site.ts` |

**To add a publication type** (Dashboard, GIS Map, Blog Post): add one entry to `PUBLICATION_TYPES`. Filters, labels, the CMS dropdown, and the schema all follow. **Page types** (currently `data-tool`) are listed in `PAGE_LINK_TYPES`: they link to a site path in `url` instead of a PDF, need no PDF, get no generated `/research/<id>/` page, and show their abstract (one-line subtitle) in lists.

**To add quarters:** append to `QUARTERS`. UW uses "Autumn", not "Fall". IDs are `YYYY-season` so they sort.

## Content model (schemas in `src/content.config.ts`)

- **publications**: `title`, `type` (enum), `authors` (`reference('people')`, 1+, never free text), `date`, `quarter` (enum), `areas` (enum array, 1+, unique), `abstract` (≤2000 chars), `pdf` (optional for work in progress, required once published; must match `/files/publications/<lowercase-name>.pdf`, so no external or `javascript:` URLs), `facultyReviewed` (default false), `draft` (default false; CMS default true), `status` (`in-progress` | `published`; CMS default `in-progress`).
  - **Drafts** appear in `astro dev` with a "Draft (dev only)" badge, **never in production builds**. The `prune-unreferenced-pdfs` integration deletes their PDFs from `dist/`, because anything in `public/` otherwise always ships.
  - **Work in progress** (`status: in-progress`): a paper still being revised. No PDF, no page of its own, title not linked. `quarter` is shown in place of a date; `date` is the date added (ordering only). Its label line shows only the type, and the "Faculty reviewed" badge reads "Faculty reviewed · revisions underway". Listed by `getWorkInProgress()` on /research (`#work-in-progress`, with its own filters via `FilterPanel.astro`), on Home (3 newest), on member profiles, and on area pages.
- **people**: `name`, `role` (exec/cohort/faculty), `title`, optional `pronouns` (shown under the title on profiles), `area` (optional), `photo` (optional `image()`; placeholder otherwise; alt text is the person's name), `links` (optional `googleScholar` / `facultyPage` / `website`, https only), `status` (current/alumni), `order`; bio is the Markdown body. **No hometown or class-year fields**: a hometown appears only if the person mentions it in their own bio.
- **areas**: fixed four (`create: false` in CMS); `title`, `summary`, optional `projectLead` (reference to a person; nothing shows until set), body.
- **faq**: `question`, `category` (`about` / `recruitment`), `order`; answer is the body.
- **pages**: `home`, `about`, `join`: `title`, `description`, optional `tagline` (Home only), `mission`; body.
- **settings** (`src/data/settings.json`): `contactEmail`; `social.linkedin` / `instagram` (empty = hidden); `recruitment.applicationsOpen`, `cohortLabel`, `deadline`, `applicationFormUrl`, `interestFormUrl`. URLs must be `https://`.

## How-to

- **Move a paper from Work in Progress to published:** in the CMS (or the file), set Status to Published, upload the PDF (lowercase file name with dashes; clear the PDF's author metadata first), and set the real publication date. The schema refuses a published paper without a PDF. It keeps its file name, so it stays the same entry; it then gets its own `/research/<id>/` page, its title becomes a link, and it moves from Work in progress into Recent work / Publications.
- **Publish a draft:** untick Draft. Drafts never reach production.
- **Set a policy area's project lead:** in the CMS, Policy Areas → the area → Project lead (choose the cohort member). The area page then shows them under "Project lead", above "Team members".
- **Add a member photo:** put it in `src/assets/people/<slug>.jpg` with all metadata stripped (`node scripts/strip-image-metadata.mjs <file>`), square and centred on the face, at most 1200px. Set `photo: ../../assets/people/<slug>.jpg`.
- **Change the site address:** edit `SITE_URL` in `src/config/site.ts`. Canonical links, share previews, the sitemap, robots.txt, and the CMS login all follow.

## Design: "editorial" (policy-journal) direction

- **Typography and whitespace do the work; color is sparing.** No gradients, filled cards, or colored section bands (the Home photo opening is the exception). Shadows only where listed: `--hero-button-shadow` on Home's two buttons and `--card-shadow` under the lavender hover boxes. **Few divider lines**: entries are separated by space, not rules.
- **Hover boxes:** every paper entry (`PublicationCard`, all variants) and each Home policy-area card gets a light lavender box (`--color-card-hover`) with `--card-shadow` on hover/keyboard focus; the title link stretches over the whole entry (author links stay separately clickable). Inside a paper's hover box, hovering the title or an author underlines it in muted plum (`--color-link-underline-on-card`), the only plum underline on the site.
- **Palette** (from the logo's pink `#E2D5E7` and plum `#33253C`; hex values live only in `tokens.css` and the logo files): page `#FCFAFD`; text and headings plum; secondary text `#604F68`; tags `#F4E9F7` bg with `#604F68` text, except policy-area tags, which each have their own soft colour (`--color-area-<id>-bg/-text`, text 6.2–7.1:1); hairlines `#B9A4C2`; buttons plum with `#FCFAFD` text, hover `#574760`. Pink is **only** for small touches: link underlines (thin at rest, slightly thicker on hover), the current-page mark in the nav (`--underline-current`), the hover highlight on running-text links, and text selection. Never use the full pink as a page or section background.
- **Focus indicators:** `:focus-visible` gets a 2px plum ring with a 3px offset (13.8:1 on the page; 12.1:1 on the lavender box), keyboard only. `:focus:not(:focus-visible) { outline: none }` in `global.css` removes the browser's own (blue) ring after mouse clicks and taps (Chrome paints one on the clicked Gap Map SVG). Text fields and selects still show the plum ring on click (browsers treat them as keyboard-bound). Paper entries and Home area cards draw the ring around the whole card. Never remove focus rings otherwise.
- **Contrast:** pink (1.36:1) and `#B9A4C2` (2.2:1) are decorative only. Focus outlines, the current-page nav mark, and form-control borders use plum or `#604F68`. All text pairs pass WCAG AA (lowest: `#604F68` on `#F4E9F7`, 6.3:1).
- **Site scale:** `:root { font-size: 95% }` in `tokens.css` sets the overall size (16px browser default → 15.2px root); every size is rem, so this one value scales type, spacing, containers, and components together. It's a percentage, so visitors' larger default text and browser zoom still work. Body text (`--text-base`, 1.125rem) is 17.1px; keep it ≥16px. The header must stay on one row from 768px: at 768–1023px `Header.astro` uses tighter gaps and side padding (51px spare at 768px); recheck if the scale, nav, or wordmark changes. Never use CSS `zoom`/`transform` for sizing, and avoid px for text (Gap Map chart text is rem; chart dimensions in `gapmap.ts` are multiplied by `remScale()`). Media-query breakpoints (in rem) are not affected by the root size. Interactive targets must stay ≥24×24px or meet WCAG 2.5.8's spacing/inline exceptions.
- **Fonts** (OFL 1.1, self-hosted via npm `@fontsource-variable/*`, imported at the top of `tokens.css`, so CSP `font-src 'self'` holds): **Newsreader** for headings and body text at 18px; **Public Sans** for nav, metadata, labels, buttons, dates. Section headings are small uppercase sans labels (`.section-heading`, `.label-heading`). Page titles have no rule and no standfirst beneath them (`PageHeader` takes only a title).
- **Header:** serif wordmark left, sans nav right, 1px plum rule beneath. **Sticky** (`position: sticky`; on Home `position: fixed` over the photo). `html { scroll-padding-top: var(--header-offset) }` keeps in-page link targets out from under it; update `--header-offset` if the header's height changes.
- **Buttons sparingly:** `.button` is the one primary action; `.button--secondary` renders as a plain underlined link. Home's "Join WPI" is a lavender box instead.
- **Alignment:** page headers, section headings, short statements, buttons, and people grids are **centered**. Paragraphs of body text stay left-aligned inside a centered column (`.prose`). The Research lists stay left-aligned (they're scannable lists). Grids use fixed column counts or centered rows, so no lone item sits on the left.
- **Home opening:** the photo fills the first screen (`.hero--cover`, `min-height: 100svh`) with the header fixed over its top edge. The title sits above the summit (positioned from the measured summit `--mtn-top` and the photo's drawn height `--photo-h`); tagline and buttons sit at the bottom of the first screen on a fog (`.hero__below::after`: page colour + `--fog-blur`, eased mask, rising `--fog-rise`). The photo is positioned so the mountain's centre (`--mtn-x`, `--mtn-y`) stays behind the text, and fades into the page below the fold (`--hero-page-fade`). If the photo changes, re-measure those fractions and `--photo-ratio`, and recheck text contrast (measured worst case: title 8.5:1, tagline 9.1:1, "Join WPI" 13.3:1, credit 13.8:1; hide text shadows when measuring). The photo is decorative there (`alt=""`); its CC BY-SA 2.0 credit is required.
- **Home:** section labels are 15px (`--text-sm`) instead of 12px; the mission statement and intro are centered at `--text-mission`. Policy areas: four cards (2×2 on tablet, stacked on phone), left-aligned text, spaced `--space-4`, no lines at rest, row wider than the page (`--area-cards-width`). Recent work cards show only title, authors, date, abstract, and area tags (`showMeta={false}`). Two short (content-width) hairlines only: between Policy areas and Recent work, and between Recent work and Work in progress.
- **Research:** Recent work = a large "lead" entry plus compact entries; Work in progress and Publications = journal-style rows (date column, type line, serif title, authors, tags) separated by space, with filters beside each heading (stacked on phones). Each item appears once: list copies of Recent items stay hidden until a filter is active; then Recent work hides. Filter panels are hidden without JS.
- **Policy area pages:** the description under the title is centered.
- **Team page:** Faculty Advisor → Executive Board (large photos, rows of three) → Research Cohort (`ml` photos, rows of four, **name only** on cards; titles appear on profiles). The cohort is listed alphabetically by last name (`byLastName`), as one group until any member has a policy area, then grouped by area. With no cohort members at all, `COHORT_PLACEHOLDER_COUNT` "To be announced" cards show.
- **Contact page:** a sentence before the email address, and a sentence before the "Follow us" label and social links.
- **Loading screen** (`SiteLoader.astro` in `BaseLayout`, `public/loader-gate.js`, `src/scripts/site-loader.ts`): **first page of a browser session only**. The gate script adds `html.show-loader` before first paint if `sessionStorage` has no `wpi-loaded` flag. Pure CSS then plays the W tile animation (turn · pause · shrink · grow · turn back) over `--loader-hold`, then fades (`--loader-fade`), so it never depends on JS to go away. One message swap partway through (the messages are in `site-loader.ts`). `aria-hidden`; skipped for `prefers-reduced-motion`, without JS, or when storage is blocked.

## Images

- Photos go in `src/assets/…` and render with Astro's `<Image>`. Astro re-encodes them without metadata, and the original files aren't served.
- Committed images must also be metadata-free (public repo): `node scripts/strip-image-metadata.mjs <file>`. `npm run check` fails on EXIF/XMP/IPTC in `src/` or `public/` images; warns on PDF metadata.
- **Logo:** only the W mark. `src/assets/brand/logo-w.svg` (plum W) and `logo-w-tile.svg` (W on a `#E2D5E7` square) are traced vector paths. `public/favicon.svg` = the tile. `public/og-image.png` (1200²) and `public/apple-touch-icon.png` (180²) are rendered from the tile by `node scripts/build-brand-images.mjs`; rerun it if the logo changes. Header logo alt text: "Washington Policy Initiative home" (the visible text is `aria-hidden` so it isn't read twice).
- **Member photos:** `src/assets/people/<slug>.jpg`, square, metadata stripped, alt text = the person's name. Officer photos are used under a written license for website use.
- **Mt. Rainier** (`src/assets/site/mt-rainier.jpg`, metadata stripped): Home only; credit "Photo: Sage Ross, CC BY-SA 2.0" linking to the Commons source and the license, noting "Resized and cropped." See `src/assets/site/ATTRIBUTION.md`.

## Security conventions

- **Headers** (`public/_headers`, Cloudflare only; `astro dev`/`preview` ignore them):
  - Public site CSP: `default-src 'none'`; `script-src`/`style-src`/`img-src`/`font-src`/`connect-src`/`manifest-src` `'self'`; `base-uri 'none'`; `form-action 'none'`; `frame-ancestors 'none'`; `upgrade-insecure-requests`. **No `'unsafe-inline'`, no `'unsafe-eval'`.** Delivered as an HTTP header (not `<meta>`), so it also covers PDFs and supports `frame-ancestors`. Astro's built-in `security.csp` is deliberately not used.
  - Also: HSTS (1 year, no preload yet), `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, restrictive `Permissions-Policy`, COOP/CORP `same-origin`, immutable caching for `/_astro/*`.
  - `/admin/*`: separate looser CSP for Decap (`style-src 'unsafe-inline'` for its CSS-in-JS, `img-src data: blob: avatars.githubusercontent.com`, `connect-src api.github.com`, `frame-src 'self' blob:`), COOP relaxed for the login popup, `noindex`, `no-store`. Scripts are still `'self'` only.
- **Rules that keep the CSP working:** no inline `<script>` or `<style>`, no `style="…"` attributes, no `is:inline` (one exception: `<script is:inline src="/loader-gate.js">` in `BaseLayout`'s `<head>`, an *external* file that must block rendering; `is:inline` only stops Astro bundling it), no third-party scripts/styles/fonts, no `data:` assets. Scripts set styles only through the CSSOM (`el.style.x = …`) and text only through `textContent`. CI fails if built HTML contains inline script/style.
- **OAuth** (`functions/api/`): random 256-bit `state` in an HttpOnly/Secure/SameSite=Lax cookie scoped to `/api/callback`, compared in constant time (CSRF); scope `public_repo`; client secret only in Cloudflare env; token posted **only to the site's own origin** after the opener proves its origin; callback page has a nonce-based CSP; errors never echo GitHub's response.
- **Dependencies:** exact versions (`.npmrc save-exact`, `engine-strict`), committed lockfile, `npm ci` in CI. Prefer releases ≥14 days old (cooldown) unless a security advisory requires newer. Dependabot uses a 14-day cooldown (security updates bypass it). Actions pinned to full commit SHAs; CI `permissions: contents: read`, `persist-credentials: false`. Decap is self-hosted from `node_modules`, not a CDN. D3 modules are installed at exact versions and bundled only into the Gap Map script; some of their indirect dependencies are pinned via `overrides` in package.json (revisit when Dependabot proposes updates).
  - Known and accepted: `npm audit` reports issues only in Decap CMS's editor dependency tree (dev dependency; runs only in a logged-in editor's browser). `npm audit --omit=dev` is clean, and CI enforces that.
- **Secrets:** GitHub secret scanning + push protection on the repo. Security issues are reported privately (see `SECURITY.md`).
- **Privacy:** no analytics, cookies (except the short-lived OAuth state cookie), forms, or third-party requests on the public site. The loading screen uses one `sessionStorage` flag (`wpi-loaded`), cleared when the tab closes and never sent anywhere. External links use `rel="noopener noreferrer"`.

## Commands

```sh
npm ci            # install exactly what's in the lockfile
npm run dev       # dev server at http://localhost:4321 (drafts visible)
npm run build     # production build to dist/ (drafts excluded)
npm run preview   # serve dist/ locally (no _headers)
npm run check     # astro check (types + content) + image metadata check
```

Node version: `.nvmrc`.
