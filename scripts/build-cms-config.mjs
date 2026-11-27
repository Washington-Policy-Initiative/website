#!/usr/bin/env node
/**
 * Generate public/admin/config.yml (Decap CMS) from src/config/taxonomy.ts.
 *
 * Every dropdown in the CMS comes from the same lists the content schema enforces,
 * so editors can only pick values the build will accept. Don't edit config.yml by
 * hand: it's gitignored and regenerated on every `npm run dev` / `npm run build`.
 *
 * Output is JSON, which is valid YAML, so no YAML library is needed.
 * Node imports the .ts files directly (built-in type stripping).
 */
import { writeFile, mkdir } from 'node:fs/promises';
import {
  FAQ_CATEGORIES,
  MEMBER_ROLES,
  MEMBER_STATUSES,
  POLICY_AREAS,
  PUBLICATION_STATUSES,
  PUBLICATION_TYPES,
  QUARTERS,
} from '../src/config/taxonomy.ts';
import { GITHUB_BRANCH, GITHUB_REPO, SITE_URL } from '../src/config/site.ts';

const options = (list) => list.map((item) => ({ label: item.label, value: item.id }));

const config = {
  backend: {
    name: 'github',
    repo: GITHUB_REPO,
    branch: GITHUB_BRANCH,
    // Our own OAuth endpoint (functions/api/auth.js) on this site, not Netlify's.
    base_url: SITE_URL,
    auth_endpoint: 'api/auth',
    // Least privilege: access to public repos only, not private ones.
    auth_scope: 'public_repo',
    commit_messages: {
      create: 'Create {{collection}} "{{slug}}"',
      update: 'Update {{collection}} "{{slug}}"',
      delete: 'Delete {{collection}} "{{slug}}"',
      uploadMedia: 'Upload "{{path}}"',
      deleteMedia: 'Delete "{{path}}"',
    },
  },
  // Commits go straight to main for now. Before the first paper is published, switch to
  // 'editorial_workflow' (every change becomes a pull request) and add CODEOWNERS.
  publish_mode: 'simple',
  // Only used when the CMS is opened on localhost with `npx decap-server` running.
  local_backend: true,
  site_url: SITE_URL,
  display_url: SITE_URL,
  // Default upload folder (e.g. images inserted into Markdown). Files in public/ are
  // served as-is, so the CI metadata check covers this folder.
  media_folder: 'public/files/uploads',
  public_folder: '/files/uploads',
  slug: { encoding: 'ascii', clean_accents: true, sanitize_replacement: '-' },

  collections: [
    {
      name: 'publications',
      label: 'Publications',
      label_singular: 'Publication',
      folder: 'src/content/publications',
      create: true,
      slug: '{{slug}}',
      extension: 'md',
      format: 'frontmatter',
      summary: '{{title}} ({{status}}, {{quarter}})',
      sortable_fields: ['date', 'title'],
      view_filters: [
        { label: 'Drafts', field: 'draft', pattern: true },
        { label: 'In progress', field: 'status', pattern: 'in-progress' },
        { label: 'Published', field: 'status', pattern: 'published' },
      ],
      fields: [
        { name: 'title', label: 'Title', widget: 'string' },
        { name: 'type', label: 'Type', widget: 'select', options: options(PUBLICATION_TYPES) },
        {
          name: 'authors',
          label: 'Authors',
          hint: 'Choose from the People collection. Add the person there first if they are missing.',
          widget: 'relation',
          collection: 'people',
          value_field: '{{slug}}',
          search_fields: ['name'],
          display_fields: ['name'],
          multiple: true,
          min: 1,
        },
        {
          name: 'status',
          label: 'Status',
          widget: 'select',
          options: options(PUBLICATION_STATUSES),
          default: 'in-progress',
          hint: 'In progress: listed under "Work in progress" with no PDF. Published: needs a PDF and gets its own page.',
        },
        {
          name: 'date',
          label: 'Publication date',
          hint: 'For work in progress, the date it was added (used only for ordering).',
          widget: 'datetime',
          format: 'YYYY-MM-DD',
          date_format: 'YYYY-MM-DD',
          time_format: false,
          picker_utc: true,
        },
        {
          name: 'quarter',
          label: 'Academic quarter',
          widget: 'select',
          options: options(QUARTERS),
          hint: 'For work in progress, the quarter the work belongs to (e.g. Autumn 2026).',
        },
        {
          name: 'areas',
          label: 'Policy areas',
          widget: 'select',
          multiple: true,
          min: 1,
          options: options(POLICY_AREAS),
        },
        {
          name: 'abstract',
          label: 'Abstract',
          hint: 'Short summary written by the authors (plain text, up to 2,000 characters).',
          widget: 'text',
        },
        {
          name: 'pdf',
          label: 'PDF',
          hint: 'Required once Published (not for work in progress). Use a lowercase file name with dashes, e.g. rural-school-funding-2027.pdf. Clear the PDF\'s author/metadata before uploading.',
          widget: 'file',
          required: false,
          media_folder: '/public/files/publications',
          public_folder: '/files/publications',
          choose_url: false,
          media_library: { config: { multiple: false } },
        },
        {
          name: 'url',
          label: 'Page URL (Data Tools only)',
          widget: 'string',
          required: false,
          hint: 'For a Data Tool: the path of its page on this site, e.g. /research/washington-library-gap-map/. Leave empty for papers and memos.',
        },
        {
          name: 'facultyReviewed',
          label: 'Faculty reviewed',
          hint: 'For work in progress this shows as "Faculty reviewed · revisions underway".',
          widget: 'boolean',
          default: false,
          required: false,
        },
        {
          name: 'draft',
          label: 'Draft (hidden from the live site)',
          widget: 'boolean',
          default: true,
          required: false,
        },
      ],
    },
    {
      name: 'people',
      label: 'People',
      label_singular: 'Person',
      folder: 'src/content/people',
      create: true,
      slug: '{{name}}',
      identifier_field: 'name',
      extension: 'md',
      format: 'frontmatter',
      summary: '{{name}}: {{title}} ({{status}})',
      // Photos go through Astro's image pipeline (metadata stripped on output).
      media_folder: '/src/assets/people',
      public_folder: '../../assets/people',
      fields: [
        { name: 'name', label: 'Name', widget: 'string' },
        { name: 'role', label: 'Role', widget: 'select', options: options(MEMBER_ROLES) },
        { name: 'title', label: 'Position title', widget: 'string', hint: 'e.g. President, Research Fellow' },
        { name: 'pronouns', label: 'Pronouns', widget: 'string', required: false, hint: 'Optional, as the person gives them, e.g. she/her' },
        {
          name: 'area',
          label: 'Policy area',
          widget: 'select',
          options: options(POLICY_AREAS),
          required: false,
        },
        {
          name: 'photo',
          label: 'Photo',
          widget: 'image',
          required: false,
          hint: 'Optional. Only upload photos WPI has permission to use. Square crops work best.',
          choose_url: false,
        },
        {
          name: 'links',
          label: 'Profile links',
          widget: 'object',
          required: false,
          collapsed: true,
          hint: 'Optional. Shown on the profile page. Each must start with https://',
          fields: [
            { name: 'googleScholar', label: 'Google Scholar', widget: 'string', required: false },
            { name: 'facultyPage', label: 'UW faculty page', widget: 'string', required: false },
            { name: 'website', label: 'Personal website', widget: 'string', required: false },
          ],
        },
        {
          name: 'status',
          label: 'Status',
          widget: 'select',
          options: options(MEMBER_STATUSES),
          default: 'current',
          hint: 'Alumni are removed from the Team page and have no profile page.',
        },
        {
          name: 'order',
          label: 'Sort order',
          widget: 'number',
          value_type: 'int',
          default: 100,
          hint: 'Lower numbers appear first.',
        },
        { name: 'body', label: 'Bio', widget: 'markdown', required: false, hint: "In the person's own words. Mentioning a hometown here is fine; there is no separate hometown field." },
      ],
    },
    {
      name: 'areas',
      label: 'Policy Areas',
      label_singular: 'Policy Area',
      folder: 'src/content/areas',
      create: false,
      delete: false,
      extension: 'md',
      format: 'frontmatter',
      fields: [
        { name: 'title', label: 'Title', widget: 'string' },
        { name: 'summary', label: 'Short summary', widget: 'text', hint: 'One sentence, shown on cards.' },
        {
          name: 'projectLead',
          label: 'Project lead',
          hint: 'The Research Cohort member who leads this area team. Leave empty until project leads are announced; nothing shows until then.',
          widget: 'relation',
          collection: 'people',
          value_field: '{{slug}}',
          search_fields: ['name'],
          display_fields: ['name'],
          required: false,
        },
        { name: 'body', label: 'Description', widget: 'markdown' },
      ],
    },
    {
      name: 'faq',
      label: 'FAQ',
      label_singular: 'FAQ entry',
      folder: 'src/content/faq',
      create: true,
      slug: '{{question}}',
      identifier_field: 'question',
      extension: 'md',
      format: 'frontmatter',
      summary: '{{question}} ({{category}})',
      fields: [
        { name: 'question', label: 'Question', widget: 'string' },
        { name: 'category', label: 'Category', widget: 'select', options: options(FAQ_CATEGORIES) },
        { name: 'order', label: 'Sort order', widget: 'number', value_type: 'int', default: 100 },
        { name: 'body', label: 'Answer', widget: 'markdown' },
      ],
    },
    {
      name: 'pages',
      label: 'Pages',
      files: [
        {
          name: 'home',
          label: 'Home',
          file: 'src/content/pages/home.md',
          fields: [
            { name: 'title', label: 'Title', widget: 'string' },
            { name: 'description', label: 'Search description', widget: 'text' },
            { name: 'tagline', label: 'Tagline', widget: 'text' },
            { name: 'mission', label: 'Mission statement', widget: 'text' },
            {
              name: 'body',
              label: 'Intro text',
              widget: 'markdown',
              required: false,
              hint: 'Optional. Shown under the mission statement in the same centered style.',
            },
          ],
        },
        {
          name: 'about',
          label: 'About',
          file: 'src/content/pages/about.md',
          fields: [
            { name: 'title', label: 'Title', widget: 'string' },
            { name: 'description', label: 'Search description', widget: 'text' },
            { name: 'body', label: 'Body', widget: 'markdown' },
          ],
        },
        {
          name: 'join',
          label: 'Join',
          file: 'src/content/pages/join.md',
          fields: [
            { name: 'title', label: 'Title', widget: 'string' },
            { name: 'description', label: 'Search description', widget: 'text' },
            { name: 'body', label: 'Body', widget: 'markdown' },
          ],
        },
      ],
    },
    {
      name: 'settings',
      label: 'Site settings',
      files: [
        {
          name: 'settings',
          label: 'Site settings',
          file: 'src/data/settings.json',
          format: 'json',
          fields: [
            { name: 'contactEmail', label: 'Contact email', widget: 'string' },
            {
              name: 'social',
              label: 'Social links',
              widget: 'object',
              hint: 'Leave blank to hide. Must start with https://',
              fields: [
                { name: 'linkedin', label: 'LinkedIn URL', widget: 'string', required: false },
                { name: 'instagram', label: 'Instagram URL', widget: 'string', required: false },
              ],
            },
            {
              name: 'recruitment',
              label: 'Recruitment',
              widget: 'object',
              fields: [
                {
                  name: 'applicationsOpen',
                  label: 'Applications open',
                  widget: 'boolean',
                  hint: 'The Apply button only appears when this is on AND an application form link is set.',
                },
                { name: 'cohortLabel', label: 'Cohort name', widget: 'string', required: false, hint: 'e.g. 2027 Research Cohort' },
                { name: 'deadline', label: 'Deadline', widget: 'string', required: false, hint: 'e.g. January 20, 2027' },
                {
                  name: 'applicationFormUrl',
                  label: 'Application form link',
                  widget: 'string',
                  required: false,
                  hint: 'PLACEHOLDER: paste the new application form link (https://…) here when ready.',
                },
                {
                  name: 'interestFormUrl',
                  label: 'Interest form link',
                  widget: 'string',
                  required: false,
                  hint: 'PLACEHOLDER: paste the new interest form link (https://…) here when ready.',
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

await mkdir('public/admin', { recursive: true });
const header = '# GENERATED by scripts/build-cms-config.mjs from src/config/taxonomy.ts. Do not edit.\n';
await writeFile('public/admin/config.yml', header + JSON.stringify(config, null, 2) + '\n');
console.log('Wrote public/admin/config.yml');
