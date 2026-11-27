/**
 * Client-side filtering for /research.
 *
 * Each filterable list (Publications, Work in progress) is a `[data-filter-group]`
 * section with its own panel, items, and messages, and is filtered independently.
 *
 * - Shareable URLs: Publications uses ?type=&area=&quarter=; Work in progress uses the
 *   same keys with its group's prefix (?wip-type=&wip-area=&wip-quarter=), so the two
 *   lists never clash and existing links (e.g. /research/?area=economic) keep working.
 * - Updates the URL (history.replaceState) as filters change, without reloading, and
 *   keeps the other list's parameters intact.
 * - Unknown values in the URL are ignored. We only ever compare them against the
 *   <option> values rendered at build time, and never insert them into the page,
 *   so a crafted URL can't inject markup.
 */

type FilterKey = 'type' | 'area' | 'quarter';
const KEYS: FilterKey[] = ['type', 'area', 'quarter'];

function initGroup(group: HTMLElement): void {
  const panel = group.querySelector<HTMLElement>('[data-filters]');
  if (!panel) return;

  const prefix = group.dataset.paramPrefix ?? '';
  const noun = group.dataset.noun ?? 'item';
  const param = (key: FilterKey) => `${prefix}${key}`;

  const selects = new Map<FilterKey, HTMLSelectElement>();
  for (const key of KEYS) {
    const el = panel.querySelector<HTMLSelectElement>(`select[data-filter="${key}"]`);
    if (el) selects.set(key, el);
  }

  const items = Array.from(group.querySelectorAll<HTMLElement>('[data-pub]'));
  // Only the Publications list has a "Recent work" section above it to hide while filtering.
  const recentSection =
    group.dataset.hasRecent !== undefined ? document.querySelector<HTMLElement>('[data-recent-section]') : null;
  const status = group.querySelector<HTMLElement>('[data-filter-status]');
  const empty = group.querySelector<HTMLElement>('[data-filter-empty]');
  const hint = group.querySelector<HTMLElement>('[data-filter-hint]');
  const reset = panel.querySelector<HTMLButtonElement>('[data-filter-reset]');

  function isAllowed(select: HTMLSelectElement, value: string): boolean {
    return Array.from(select.options).some((o) => o.value === value);
  }

  function readUrl(): void {
    const params = new URLSearchParams(window.location.search);
    for (const [key, select] of selects) {
      const value = params.get(param(key)) ?? '';
      select.value = isAllowed(select, value) ? value : '';
    }
  }

  function writeUrl(): void {
    // Start from the current URL so the other list's filters are kept.
    const params = new URLSearchParams(window.location.search);
    for (const [key, select] of selects) {
      if (select.value) params.set(param(key), select.value);
      else params.delete(param(key));
    }
    const query = params.toString();
    const url = `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`;
    window.history.replaceState(null, '', url);
  }

  function apply(): void {
    const type = selects.get('type')?.value ?? '';
    const area = selects.get('area')?.value ?? '';
    const quarter = selects.get('quarter')?.value ?? '';
    const active = Boolean(type || area || quarter);

    let shown = 0;
    let visibleUnfiltered = 0;
    for (const item of items) {
      const isRecentCopy = item.hasAttribute('data-recent-copy');
      const matches =
        (!type || item.dataset.type === type) &&
        (!area || (item.dataset.areas ?? '').split(' ').includes(area)) &&
        (!quarter || item.dataset.quarter === quarter);
      // Unfiltered: items already shown in Recent work stay hidden here (each item appears once).
      // Filtered: Recent work hides and every match shows in this list.
      const visible = active ? matches : !isRecentCopy;
      item.hidden = !visible;
      if (matches) shown += 1;
      if (!isRecentCopy) visibleUnfiltered += 1;
    }

    if (recentSection) recentSection.hidden = active;
    if (empty) empty.hidden = !active || shown > 0;
    if (hint) hint.hidden = active || visibleUnfiltered > 0;
    if (status) {
      status.textContent = active ? `Showing ${shown} of ${items.length} ${noun}${items.length === 1 ? '' : 's'}` : '';
    }
    if (reset) reset.hidden = !active;
  }

  for (const select of selects.values()) {
    select.addEventListener('change', () => {
      writeUrl();
      apply();
    });
  }
  reset?.addEventListener('click', () => {
    for (const select of selects.values()) select.value = '';
    writeUrl();
    apply();
  });

  readUrl();
  apply();
  panel.hidden = false;
}

for (const group of document.querySelectorAll<HTMLElement>('[data-filter-group]')) initGroup(group);
