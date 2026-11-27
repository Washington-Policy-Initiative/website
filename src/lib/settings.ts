/**
 * Site-wide settings (src/data/settings.json, editable in the CMS under "Site settings").
 * Validated here so a bad value fails the build instead of rendering a broken link.
 *
 * Empty strings mean "not set yet": the related link or button is hidden.
 *   - social.linkedin / social.instagram: PLACEHOLDER, new links to come.
 *   - recruitment.applicationFormUrl / interestFormUrl: PLACEHOLDER, new forms to come.
 */
import { z } from 'astro/zod';
import raw from '../data/settings.json';

/** Only https:// links are accepted: no http://, mailto:, or javascript: URLs. */
const httpsUrlOrEmpty = z.union([z.literal(''), z.url({ protocol: /^https$/ })]);

const settingsSchema = z.object({
  contactEmail: z.email(),
  social: z.object({
    linkedin: httpsUrlOrEmpty,
    instagram: httpsUrlOrEmpty,
  }),
  recruitment: z.object({
    applicationsOpen: z.boolean(),
    /** e.g. "2027 Research Cohort". Optional. */
    cohortLabel: z.string(),
    /** Free text, e.g. "January 20, 2027". Optional. */
    deadline: z.string(),
    applicationFormUrl: httpsUrlOrEmpty,
    interestFormUrl: httpsUrlOrEmpty,
  }),
});

export const settings = settingsSchema.parse(raw);

export const socialLinks = [
  { id: 'linkedin', label: 'LinkedIn', href: settings.social.linkedin },
  { id: 'instagram', label: 'Instagram', href: settings.social.instagram },
].filter((link) => link.href !== '') as { id: 'linkedin' | 'instagram'; label: string; href: string }[];
