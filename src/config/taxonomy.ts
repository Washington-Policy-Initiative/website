/**
 * SINGLE SOURCE OF TRUTH for every fixed tag list on the site.
 *
 * - The content schemas (src/content.config.ts) build their enums from these lists,
 *   so a value that isn't listed here fails the build.
 * - The CMS dropdowns (public/admin/config.yml) are generated from these lists by
 *   scripts/build-cms-config.mjs, so the CMS can't offer a value the schema rejects.
 * - Pages and filters loop over these lists, so adding an entry needs no page changes.
 *
 * This file is also imported directly by Node (type stripping), so keep it to
 * plain data + erasable TypeScript: no imports, no `enum`, no namespaces.
 */

export interface TaxonomyItem {
  readonly id: string;
  readonly label: string;
}

/**
 * Publication types. To add one (Dashboard, GIS Map, Blog Post…), append here.
 * Types listed in PAGE_LINK_TYPES link to a page on this site (their `url`) instead of
 * a PDF, and get no generated publication page of their own.
 */
export const PUBLICATION_TYPES = [
  { id: 'research-paper', label: 'Research Paper', plural: 'Research Papers' },
  { id: 'policy-memo', label: 'Policy Memo', plural: 'Policy Memos' },
  { id: 'data-tool', label: 'Data Tool', plural: 'Data Tools' },
] as const;

/** Publication types that are pages on this site (a `url`), not PDFs. */
export const PAGE_LINK_TYPES: readonly string[] = ['data-tool'];

export const POLICY_AREAS = [
  { id: 'economic', label: 'Economic', name: 'Economic Policy' },
  { id: 'education', label: 'Education', name: 'Education Policy' },
  { id: 'environmental', label: 'Environmental', name: 'Environmental Policy' },
  { id: 'civic', label: 'Civic', name: 'Civic Policy' },
] as const;

/**
 * UW academic quarters, oldest first. IDs are `YYYY-season` so they sort and read well in URLs.
 * Extend each year by appending the next academic year's four quarters.
 */
export const QUARTERS = [
  { id: '2026-autumn', label: 'Autumn 2026' },
  { id: '2027-winter', label: 'Winter 2027' },
  { id: '2027-spring', label: 'Spring 2027' },
  { id: '2027-summer', label: 'Summer 2027' },
  { id: '2027-autumn', label: 'Autumn 2027' },
  { id: '2028-winter', label: 'Winter 2028' },
  { id: '2028-spring', label: 'Spring 2028' },
  { id: '2028-summer', label: 'Summer 2028' },
] as const;

/**
 * Publication lifecycle.
 *  - in-progress: shown under "Work in progress" (no PDF yet, no page of its own).
 *  - published: a finished paper with a PDF and its own page.
 * To publish a finished paper, switch its status to published and upload the PDF.
 */
export const PUBLICATION_STATUSES = [
  { id: 'in-progress', label: 'In progress' },
  { id: 'published', label: 'Published' },
] as const;

export const MEMBER_ROLES = [
  { id: 'exec', label: 'Executive Board' },
  { id: 'cohort', label: 'Research Cohort' },
  { id: 'faculty', label: 'Faculty Advisor' },
] as const;

/** Alumni get no Team listing and no profile page; their names render as plain text. */
export const MEMBER_STATUSES = [
  { id: 'current', label: 'Current member' },
  { id: 'alumni', label: 'Alumni' },
] as const;

export const FAQ_CATEGORIES = [
  { id: 'about', label: 'About WPI' },
  { id: 'recruitment', label: 'Joining WPI' },
] as const;

// ---------------------------------------------------------------------------
// Helpers

type Ids<T extends readonly TaxonomyItem[]> = T[number]['id'];

/** The id list as a non-empty tuple, which is what `z.enum()` expects. */
export function ids<T extends readonly TaxonomyItem[]>(list: T): [Ids<T>, ...Ids<T>[]] {
  return list.map((item) => item.id) as [Ids<T>, ...Ids<T>[]];
}

/** Look up a display label; falls back to the raw id so a missing label is visible, not blank. */
export function labelFor(list: readonly TaxonomyItem[], id: string): string {
  return list.find((item) => item.id === id)?.label ?? id;
}

export type PublicationTypeId = Ids<typeof PUBLICATION_TYPES>;
export type PolicyAreaId = Ids<typeof POLICY_AREAS>;
export type QuarterId = Ids<typeof QUARTERS>;
export type MemberRoleId = Ids<typeof MEMBER_ROLES>;
