/**
 * Site identity and deployment settings. None of these are secrets.
 * Plain data only: this file is also imported by Node scripts.
 */

export const SITE_NAME = 'Washington Policy Initiative';
export const SITE_SHORT_NAME = 'WPI';

/**
 * The site's public address (custom domain). Used for canonical links, share previews,
 * the sitemap and robots.txt, and by the CMS to find the OAuth login endpoint.
 */
export const SITE_URL = 'https://wapolicyinitiative.org';

/** GitHub repository as "owner/name", used by the CMS. */
export const GITHUB_REPO = 'Washington-Policy-Initiative/website';
export const GITHUB_BRANCH = 'main';

/**
 * Which W logo the header shows next to the name:
 *   'plain' = the plum W on the page background
 *   'tile'  = the plum W on a pink square (same as the browser-tab icon)
 */
export const HEADER_LOGO: 'plain' | 'tile' = 'tile';

/** How many publications the "Recent work" section on /research shows. */
export const RECENT_WORK_COUNT = 5;
/** How many the Home page shows. */
export const HOME_RECENT_COUNT = 3;

/**
 * Team page: while the Research Cohort has no members yet, show this many
 * "To be announced" placeholder cards (rows of three, not grouped by area).
 * Once real cohort members exist, the section groups them by policy area instead.
 * Set to 0 to show "Announced soon" text instead.
 */
export const COHORT_PLACEHOLDER_COUNT = 12;
