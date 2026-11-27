# Washington Policy Initiative website

The website of the **Washington Policy Initiative (WPI)**, a nonpartisan, student-led policy think tank at the University of Washington: **<https://wapolicyinitiative.org>**

The site presents WPI's research across four policy areas (Economic, Education, Environmental, and Civic), its team, and how to get involved. It also hosts the Washington Library Gap Map, an interactive data tool.

## Tech stack

- [Astro](https://astro.build/) (static output), with content stored as Markdown in `src/content/`
- [Cloudflare Pages](https://pages.cloudflare.com/) for hosting, with a strict Content Security Policy in `public/_headers`
- [Decap CMS](https://decapcms.org/) at `/admin/` for editing content, with GitHub login through a small Cloudflare Pages Function in `functions/api/`
- [D3](https://d3js.org/) modules for the Gap Map
- Self-hosted fonts: Newsreader and Public Sans (SIL Open Font License)

No analytics, trackers, or third-party scripts.

## Running it locally

You need [Node.js](https://nodejs.org/) (the version in `.nvmrc`).

```sh
npm ci            # install the exact dependencies in package-lock.json
npm run dev       # start a local server at http://localhost:4321
npm run check     # type and content checks, plus an image-metadata check
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Editing content

Site content (publications, people, policy areas, FAQ, and page text) is edited through the CMS at `/admin/` by WPI's President and Vice President. Each change is saved as a commit to this repository, and the site rebuilds automatically.

## Security

Please don't open public issues for security problems. See [SECURITY.md](SECURITY.md) for how to report one privately.
