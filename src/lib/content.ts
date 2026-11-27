/**
 * Query helpers. Pages call these instead of getCollection() directly so the
 * draft / alumni rules live in exactly one place.
 */
import { getCollection, type CollectionEntry } from 'astro:content';
import { POLICY_AREAS, MEMBER_ROLES, QUARTERS } from '../config/taxonomy';

export type Publication = CollectionEntry<'publications'>;
export type Person = CollectionEntry<'people'>;

/** In `astro dev` drafts are visible (with a badge) so editors can preview them. */
export const SHOW_DRAFTS = import.meta.env.DEV;

/** Published publications, newest first. Drafts are excluded from production builds. */
export async function getPublications(): Promise<Publication[]> {
  const all = await getCollection('publications', ({ data }) => SHOW_DRAFTS || !data.draft);
  return all
    .filter(({ data }) => data.status === 'published')
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());
}

/**
 * Work in progress (status "in-progress"): no PDF or page yet. Ordered by quarter
 * (newest first, like publications), then most recently added. Drafts follow the same rule as above.
 */
export async function getWorkInProgress(): Promise<Publication[]> {
  const all = await getCollection('publications', ({ data }) => SHOW_DRAFTS || !data.draft);
  const quarterIndex = (id: string) => QUARTERS.findIndex((q) => q.id === id);
  return all
    .filter(({ data }) => data.status === 'in-progress')
    .sort(
      (a, b) =>
        quarterIndex(b.data.quarter) - quarterIndex(a.data.quarter) ||
        b.data.date.getTime() - a.data.date.getTime(),
    );
}

export async function getWorkInProgressBy(personId: string): Promise<Publication[]> {
  const items = await getWorkInProgress();
  return items.filter(({ data }) => data.authors.some((a) => a.id === personId));
}

/** URL a publication links to: its own page, or (for Data Tools) the tool's page. */
export function publicationHref(pub: Publication): string {
  return pub.data.url ?? `/research/${pub.id}/`;
}

/** Publications that get a generated page at /research/<id>/ (papers and memos, not page types). */
export function hasOwnPage(pub: Publication): boolean {
  return pub.data.url === undefined;
}

export async function getAllPeople(): Promise<Person[]> {
  return getCollection('people');
}

/** Current members only. Alumni never get a listing or a profile page. */
export async function getCurrentPeople(): Promise<Person[]> {
  const people = await getCollection('people', ({ data }) => data.status === 'current');
  return people.sort((a, b) => a.data.order - b.data.order || a.data.name.localeCompare(b.data.name));
}

/** Sort by last name (the last word of the name), then by full name. */
export function byLastName(a: Person, b: Person): number {
  const last = (p: Person) => p.data.name.trim().split(/\s+/).pop() ?? '';
  return last(a).localeCompare(last(b)) || a.data.name.localeCompare(b.data.name);
}

export function isCurrent(person: Person): boolean {
  return person.data.status === 'current';
}

export function profileHref(person: Person): string {
  return `/team/${person.id}/`;
}

export interface AuthorView {
  name: string;
  /** null for alumni (and unknown ids): render as plain text. */
  href: string | null;
}

/** Resolve a publication's author references. Alumni become plain-text names. */
export async function getAuthors(pub: Publication): Promise<AuthorView[]> {
  const people = await getAllPeople();
  return pub.data.authors.map(({ id }) => {
    const person = people.find((p) => p.id === id);
    if (!person) return { name: id, href: null };
    return { name: person.data.name, href: isCurrent(person) ? profileHref(person) : null };
  });
}

export async function getPublicationsBy(personId: string): Promise<Publication[]> {
  const pubs = await getPublications();
  return pubs.filter(({ data }) => data.authors.some((a) => a.id === personId));
}

export function areaById(id: string) {
  return POLICY_AREAS.find((a) => a.id === id);
}

/**
 * "Faculty Advisor" with one advisor, "Faculty Advisors" with more (or none yet),
 * so the wording stays right as advisors are added.
 */
export function facultyLabel(count: number): { heading: string; phrase: string } {
  return count === 1
    ? { heading: 'Faculty Advisor', phrase: 'a faculty advisor' }
    : { heading: 'Faculty Advisors', phrase: 'faculty advisors' };
}

export function roleLabel(id: string): string {
  return MEMBER_ROLES.find((r) => r.id === id)?.label ?? id;
}

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  // Dates are stored as plain YYYY-MM-DD (midnight UTC); format in UTC so they don't shift a day.
  timeZone: 'UTC',
});

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
