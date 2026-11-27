/**
 * Content schemas. Every Markdown file in src/content/ is validated against these
 * at build time; an invalid value (unknown tag, missing field, bad PDF path) fails
 * the build instead of shipping a broken page.
 */
import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import {
  FAQ_CATEGORIES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  POLICY_AREAS,
  PAGE_LINK_TYPES,
  PUBLICATION_STATUSES,
  PUBLICATION_TYPES,
  QUARTERS,
  ids,
} from './config/taxonomy';

/**
 * PDFs must be files we host under /files/publications/. Restricting the shape
 * (instead of allowing any URL) means a CMS entry can't point readers to an
 * external site or a `javascript:` URL.
 */
const pdfPath = z
  .string()
  .regex(
    /^\/files\/publications\/[a-z0-9][a-z0-9._-]*\.pdf$/,
    'PDF must be uploaded to /files/publications/ with a lowercase file name ending in .pdf',
  );

/**
 * For page-type publications (e.g. Data Tool): a path on this site, like
 * "/research/washington-library-gap-map/". Internal only, so a CMS entry can't send
 * readers to an external site or a javascript: URL.
 */
const sitePath = z
  .string()
  .regex(/^\/[a-z0-9-]+(\/[a-z0-9-]+)*\/$/, 'Must be a path on this site, like /research/my-tool/');

const publications = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/publications' }),
  schema: z
    .object({
    title: z.string().min(1),
    type: z.enum(ids(PUBLICATION_TYPES)),
    authors: z.array(reference('people')).min(1, 'At least one author is required'),
    /** Publication date. For work in progress: the date it was added (used for ordering, not shown). */
    date: z.coerce.date(),
    /** Quarter published; for work in progress, the quarter the work belongs to. */
    quarter: z.enum(ids(QUARTERS)),
    areas: z
      .array(z.enum(ids(POLICY_AREAS)))
      .min(1, 'Choose at least one policy area')
      .refine((list) => new Set(list).size === list.length, 'Policy areas must not repeat'),
    abstract: z.string().min(1).max(2000),
    /** Required once published (except for page types like Data Tool); work in progress has no PDF yet. */
    pdf: pdfPath.optional(),
    /** Page types (Data Tool): the page on this site the listing links to. */
    url: sitePath.optional(),
    facultyReviewed: z.boolean().default(false),
    /** Drafts show in `astro dev` only, never in production builds. */
    draft: z.boolean().default(false),
    /** in-progress (Work in progress section) or published. See PUBLICATION_STATUSES. */
    status: z.enum(ids(PUBLICATION_STATUSES)).default('published'),
  })
    .refine((data) => data.status !== 'published' || PAGE_LINK_TYPES.includes(data.type) || data.pdf !== undefined, {
      message: 'A published publication needs a PDF. Upload one, or set the status to In progress.',
      path: ['pdf'],
    })
    .refine((data) => !PAGE_LINK_TYPES.includes(data.type) || data.status !== 'published' || data.url !== undefined, {
      message: 'A published Data Tool needs the URL of its page on this site.',
      path: ['url'],
    })
    .refine((data) => PAGE_LINK_TYPES.includes(data.type) || data.url === undefined, {
      message: 'Only page types (like Data Tool) use a page URL; papers and memos use a PDF.',
      path: ['url'],
    }),
});

/**
 * Profile links (Google Scholar, faculty page, personal website). https:// only, so a
 * CMS entry can't add an http:// or javascript: link. An empty value (what the CMS saves
 * when a field is cleared) counts as "not set".
 */
const profileLink = z.union([z.literal(''), z.url({ protocol: /^https$/, message: 'Must be an https:// link' })]).optional();

const people = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/people' }),
  schema: ({ image }) =>
    z.object({
      name: z.string().min(1),
      role: z.enum(ids(MEMBER_ROLES)),
      /** Position title, e.g. "President" or "Research Fellow". */
      title: z.string().min(1),
      area: z.enum(ids(POLICY_AREAS)).optional(),
      /** Optional, as the person gives them, e.g. "she/her". Shown under the title on the profile. */
      pronouns: z.string().trim().max(40).optional(),
      /** Optional; a placeholder is shown when missing. Goes through Astro's image pipeline. */
      photo: image().optional(),
      /** Optional profile links, shown on the person's profile page. */
      links: z
        .object({
          googleScholar: profileLink,
          facultyPage: profileLink,
          website: profileLink,
        })
        .optional(),
      status: z.enum(ids(MEMBER_STATUSES)).default('current'),
      /** Lower numbers sort first within a group. */
      order: z.number().int().default(100),
    }),
  // Intentionally no hometown or class-year fields (a hometown, if any, stays in the bio's own words).
});

const areas = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/areas' }),
  schema: z.object({
    title: z.string().min(1),
    summary: z.string().min(1),
    /**
     * The area team's project lead: a Research Cohort member who takes on extra
     * responsibility for the team. Optional; nothing is shown until it's set.
     */
    projectLead: reference('people').optional(),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faq' }),
  schema: z.object({
    question: z.string().min(1),
    category: z.enum(ids(FAQ_CATEGORIES)),
    order: z.number().int().default(100),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string().min(1),
    /** Used for the meta description (search results and link previews). */
    description: z.string().min(1).max(200),
    tagline: z.string().optional(),
    mission: z.string().optional(),
  }),
});

export const collections = { publications, people, areas, faq, pages };
