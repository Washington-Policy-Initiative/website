/**
 * Washington Library Gap Map: interactive parts (this page only).
 *
 * One piece of state, the selected district, is shared by the map, the search box,
 * and the table. Choosing a district in any of them updates the URL (?district=<id>),
 * highlights it on the map and in the table, and fills in the district report. The
 * Back button and shared links restore the selection.
 *
 * Security: all data comes from same-origin JSON built at build time; every value is
 * inserted with textContent or SVG attributes, never as HTML. No inline styles: SVG
 * colors come from CSS classes (tokens.css), and positions use CSSOM properties.
 */
import { select } from 'd3-selection';
import { geoIdentity, geoPath, type GeoPermissibleObjects } from 'd3-geo';
import { scaleBand, scaleLinear, scalePoint } from 'd3-scale';
import { line } from 'd3-shape';
import { axisBottom, axisLeft } from 'd3-axis';
import { max } from 'd3-array';

// ---------------------------------------------------------------------------
// Data shapes (see clientData() in src/lib/gapmap.ts)

interface DistrictData {
  id: string;
  name: string;
  county: string | null;
  shape: boolean;
  fte: (number | null)[];
  spl: (number | null)[];
  lps: (number | null)[];
  /** Index into tiers, or -1 for none, per year. */
  tier: number[];
  g4: number | null;
  g8: number | null;
}
interface Payload {
  years: string[];
  tiers: string[];
  stateReading: { grade4: number | null; grade8: number | null };
  districts: DistrictData[];
}
interface Shapes {
  type: 'FeatureCollection';
  features: { type: 'Feature'; properties: { id: string }; geometry: GeoPermissibleObjects }[];
}

type Category = 'full' | 'part' | 'none';
const CATEGORY_TEXT: Record<Category, string> = {
  full: 'at least one full-time librarian',
  part: 'part-time librarian',
  none: 'no librarian',
};

// ---------------------------------------------------------------------------
// Small helpers

const $ = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const yearLabel = (y: string) => y.replace('-', '–');
const fmt = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined
    ? '—'
    : v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signedPct = (v: number | null) =>
  v === null ? '—' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(Math.round(v))}%`;
const categoryOf = (fte: number | null): Category =>
  fte !== null && fte >= 1 ? 'full' : fte !== null && fte > 0 ? 'part' : 'none';
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function setText(el: Element | null, text: string): void {
  if (el) el.textContent = text;
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const root = $('[data-gapmap]');
  if (!root) return;
  const base = window.location.pathname.endsWith('/') ? window.location.pathname : `${window.location.pathname}/`;

  let data: Payload;
  let shapes: Shapes;
  try {
    const [d, s] = await Promise.all([
      fetch(`${base}data.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch(`${base}districts.json`).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    ]);
    data = d as Payload;
    shapes = s as Shapes;
  } catch {
    setText(
      $('[data-gm-map-fallback]'),
      'The map data could not be loaded. Reload the page to try again; every district is also listed in the table below.',
    );
    return;
  }

  const LATEST = data.years.length - 1;
  const byId = new Map(data.districts.map((d) => [d.id, d]));
  const tierName = (d: DistrictData, i: number) => (d.tier[i] >= 0 ? data.tiers[d.tier[i]] : null);
  const fteAt = (d: DistrictData, i: number) => d.fte[i] ?? 0;
  const changeSinceFirst = (d: DistrictData): number | null => {
    const f = d.fte[0];
    const l = d.fte[LATEST];
    return f === null || f === 0 || l === null ? null : ((l - f) / f) * 100;
  };

  let selectedId: string | null = null;

  // =========================================================================
  // Map
  // =========================================================================
  const mapEl = $('[data-gm-map]')!;
  const tooltip = $('[data-gm-tooltip]')!;
  const live = $('[data-gm-map-live]');
  $('[data-gm-map-fallback]')?.remove();

  // Size the map to Washington's own proportions (coordinates were pre-corrected for
  // latitude at build time, so a flat projection is accurate enough for one state).
  const geoAll = shapes as unknown as GeoPermissibleObjects;
  const [[bx0, by0], [bx1, by1]] = geoPath(geoIdentity().reflectY(true)).bounds(geoAll);
  const WIDTH = 1000;
  const HEIGHT = Math.ceil((WIDTH * (by1 - by0)) / (bx1 - bx0));
  const projection = geoIdentity().reflectY(true).fitSize([WIDTH, HEIGHT], geoAll);
  const pathGen = geoPath(projection);

  const svg = select(mapEl)
    .insert('svg', ':first-child')
    .attr('class', 'gm-map__svg')
    .attr('viewBox', `0 0 ${WIDTH} ${HEIGHT}`)
    .attr('tabindex', '0')
    .attr('role', 'group')
    .attr('aria-label', 'Map of Washington school districts by librarian staffing, 2024–25')
    .attr('aria-describedby', 'gm-map-hint');

  const paths = svg
    .append('g')
    .selectAll('path')
    .data(shapes.features)
    .join('path')
    .attr('d', (f) => pathGen(f.geometry) ?? '')
    .attr('class', (f) => `gm-district gm-cat-${categoryOf(byId.get(f.properties.id)?.fte[LATEST] ?? null)}`)
    .attr('data-id', (f) => f.properties.id);

  const pathById = new Map<string, SVGPathElement>();
  paths.each(function (f) {
    pathById.set(f.properties.id, this as SVGPathElement);
  });

  function describe(d: DistrictData): string {
    const cat = CATEGORY_TEXT[categoryOf(d.fte[LATEST])];
    return `${d.name}${d.county ? `, ${d.county} County` : ''}: ${cat} in 2024–25 (${fmt(d.fte[LATEST], 2)} FTE).`;
  }

  function showTooltip(d: DistrictData, x: number, y: number): void {
    tooltip.replaceChildren();
    const title = document.createElement('strong');
    title.textContent = d.name;
    tooltip.append(title);
    const lines = [
      `${CATEGORY_TEXT[categoryOf(d.fte[LATEST])][0].toUpperCase()}${CATEGORY_TEXT[categoryOf(d.fte[LATEST])].slice(1)}`,
      `Librarian FTE, 2024–25: ${fmt(d.fte[LATEST], 2)}`,
      d.county ? `${d.county} County · ${tierName(d, LATEST) ?? 'No locale group'}` : '',
    ].filter(Boolean);
    for (const l of lines) {
      const span = document.createElement('span');
      span.textContent = l;
      tooltip.append(span, document.createElement('br'));
    }
    tooltip.hidden = false;
    const box = mapEl.getBoundingClientRect();
    const tw = tooltip.offsetWidth;
    const th = tooltip.offsetHeight;
    let left = x - box.left + 14;
    let top = y - box.top + 14;
    if (left + tw > box.width) left = x - box.left - tw - 14;
    if (top + th > box.height) top = y - box.top - th - 14;
    tooltip.style.left = `${Math.max(0, left)}px`;
    tooltip.style.top = `${Math.max(0, top)}px`;
  }

  paths
    .on('mouseenter', function (event: MouseEvent, f) {
      const d = byId.get(f.properties.id);
      if (!d) return;
      (this as SVGPathElement).parentNode?.appendChild(this as SVGPathElement); // draw outline on top
      showTooltip(d, event.clientX, event.clientY);
    })
    .on('mousemove', (event: MouseEvent, f) => {
      const d = byId.get(f.properties.id);
      if (d) showTooltip(d, event.clientX, event.clientY);
    })
    .on('mouseleave', () => {
      tooltip.hidden = true;
      raiseSelected();
    })
    .on('click', (_event: MouseEvent, f) => choose(f.properties.id, { push: true, focusReport: false }));

  function raiseSelected(): void {
    const p = selectedId ? pathById.get(selectedId) : null;
    if (p) p.parentNode?.appendChild(p);
  }

  // Keyboard: the map is one tab stop; arrow keys move through districts alphabetically.
  const mapped = data.districts.filter((d) => d.shape && pathById.has(d.id));
  let activeIndex = -1;
  const svgNode = svg.node()!;

  function setActive(i: number): void {
    if (activeIndex >= 0) pathById.get(mapped[activeIndex].id)?.classList.remove('is-active');
    activeIndex = (i + mapped.length) % mapped.length;
    const d = mapped[activeIndex];
    const p = pathById.get(d.id);
    if (p) {
      p.classList.add('is-active');
      p.parentNode?.appendChild(p);
    }
    setText(live, `${describe(d)} Press Enter to open its report.`);
  }

  svgNode.addEventListener('focus', () => {
    const start = selectedId ? mapped.findIndex((d) => d.id === selectedId) : 0;
    setActive(start >= 0 ? start : 0);
  });
  svgNode.addEventListener('blur', () => {
    if (activeIndex >= 0) pathById.get(mapped[activeIndex].id)?.classList.remove('is-active');
  });
  svgNode.addEventListener('keydown', (e) => {
    if (['ArrowDown', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      setActive(activeIndex + 1);
    } else if (['ArrowUp', 'ArrowLeft'].includes(e.key)) {
      e.preventDefault();
      setActive(activeIndex - 1);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActive(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActive(mapped.length - 1);
    } else if ((e.key === 'Enter' || e.key === ' ') && activeIndex >= 0) {
      e.preventDefault();
      choose(mapped[activeIndex].id, { push: true, focusReport: true });
    }
  });

  // =========================================================================
  // Search (combobox with a listbox of matches)
  // =========================================================================
  const input = $<HTMLInputElement>('#gm-search-input')!;
  const listbox = $<HTMLUListElement>('#gm-search-results')!;
  let options: DistrictData[] = [];
  let optionIndex = -1;
  input.disabled = false;

  function closeList(): void {
    listbox.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    optionIndex = -1;
  }
  function highlight(i: number): void {
    optionIndex = i;
    listbox.querySelectorAll('[role="option"]').forEach((el, j) => el.setAttribute('aria-selected', String(j === i)));
    const el = listbox.querySelector<HTMLElement>(`#gm-option-${i}`);
    if (el) {
      input.setAttribute('aria-activedescendant', el.id);
      el.scrollIntoView({ block: 'nearest' });
    }
  }
  function renderOptions(): void {
    const q = input.value.trim().toLowerCase();
    listbox.replaceChildren();
    if (!q) return closeList();
    options = data.districts.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 10);
    if (!options.length) {
      const li = document.createElement('li');
      li.className = 'gm-search__empty';
      li.textContent = 'No district matches that name.';
      listbox.append(li);
    }
    options.forEach((d, i) => {
      const li = document.createElement('li');
      li.id = `gm-option-${i}`;
      li.className = 'gm-search__option';
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.textContent = d.name;
      const small = document.createElement('small');
      small.textContent = [d.county ? `${d.county} County` : null, tierName(d, LATEST)].filter(Boolean).join(' · ');
      li.append(small);
      li.addEventListener('pointerdown', (e) => e.preventDefault()); // keep focus in the input
      li.addEventListener('click', () => pickOption(i));
      listbox.append(li);
    });
    listbox.hidden = false;
    input.setAttribute('aria-expanded', 'true');
    optionIndex = -1;
  }
  function pickOption(i: number): void {
    const d = options[i];
    if (!d) return;
    input.value = d.name;
    closeList();
    choose(d.id, { push: true, focusReport: true });
  }
  input.addEventListener('input', renderOptions);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' && options.length) {
      e.preventDefault();
      if (listbox.hidden) renderOptions();
      highlight(Math.min(optionIndex + 1, options.length - 1));
    } else if (e.key === 'ArrowUp' && options.length) {
      e.preventDefault();
      highlight(Math.max(optionIndex - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pickOption(optionIndex >= 0 ? optionIndex : 0);
    } else if (e.key === 'Escape') {
      closeList();
    }
  });
  input.addEventListener('blur', () => window.setTimeout(closeList, 100));

  // =========================================================================
  // District report
  // =========================================================================
  const report = $('[data-gm-report]')!;
  const r = (key: string) => report.querySelector<HTMLElement>(`[data-gm-r="${key}"]`);

  /** Average FTE per district for a locale group (by that year's group) or the state. */
  function avgFte(i: number, tierIndex: number | null): number | null {
    const pool = data.districts.filter((d) => (tierIndex === null ? true : d.tier[i] === tierIndex));
    return mean(pool.map((d) => fteAt(d, i)));
  }

  function renderReport(d: DistrictData): void {
    $('[data-gm-report-empty]')!.hidden = true;
    $('[data-gm-report-body]')!.hidden = false;

    const tier = tierName(d, LATEST);
    const tierIdx = d.tier[LATEST] >= 0 ? d.tier[LATEST] : null;
    setText(r('name'), d.name);
    setText(
      r('meta'),
      [d.county ? `${d.county} County` : null, tier ?? 'No locale group (no NCES locale code)', d.shape ? null : 'Not shown on the map']
        .filter(Boolean)
        .join(' · '),
    );

    // Figures
    const fte = d.fte[LATEST];
    setText(r('fte'), fmt(fte, 2));
    setText(r('spl'), fte ? fmt(d.spl[LATEST], 0) : 'No librarian');
    setText(r('lps'), fte ? fmt(d.lps[LATEST], 2) : '—');
    const change = changeSinceFirst(d);
    const changeEl = r('change')!;
    changeEl.replaceChildren(document.createTextNode(change === null ? '—' : signedPct(change)));
    if (change === null) {
      const small = document.createElement('small');
      small.textContent = (d.fte[0] ?? 0) === 0 && (fte ?? 0) === 0 ? 'No librarian in either year' : 'No librarian in 2015–16';
      changeEl.append(small);
    }

    // History chart + table
    const groupLabel = tier ? `${tier} group average` : null;
    const series = {
      district: d.fte.map((v) => v ?? 0),
      group: tierIdx === null ? null : data.years.map((_, i) => avgFte(i, tierIdx)),
      state: data.years.map((_, i) => avgFte(i, null)),
    };
    setText(
      r('historySummary'),
      `Librarian FTE in ${d.name} went from ${fmt(series.district[0], 2)} in 2015–16 to ${fmt(series.district[LATEST], 2)} in 2024–25.` +
        (tier ? ` The other lines show the ${tier} group’s average and the statewide average, per district.` : ' The other line shows the statewide average per district.'),
    );
    drawHistory(r('historyChart')!, series, groupLabel);
    setText(r('historyDistrictHead'), d.name);
    const groupHead = r('historyGroupHead')!;
    groupHead.hidden = !groupLabel;
    setText(groupHead, groupLabel ?? '');
    const tbody = r('historyRows')!;
    tbody.replaceChildren(
      ...data.years.map((y, i) => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = yearLabel(y);
        tr.append(th);
        const cells = [fmt(series.district[i], 2), ...(series.group ? [fmt(series.group[i], 2)] : []), fmt(series.state[i], 2)];
        for (const c of cells) {
          const td = document.createElement('td');
          td.className = 'is-numeric';
          td.textContent = c;
          tr.append(td);
        }
        return tr;
      }),
    );

    // Reading results (2024–25), group averages weighted equally per district
    const groupPool = tierIdx === null ? [] : data.districts.filter((x) => x.tier[LATEST] === tierIdx);
    const g4Vals = groupPool.map((x) => x.g4).filter((v): v is number => v !== null);
    const g8Vals = groupPool.map((x) => x.g8).filter((v): v is number => v !== null);
    const pctOr = (v: number | null) => (v === null ? 'Not available' : `${fmt(v, 1)}%`);
    setText(r('readingDistrictHead'), d.name);
    setText(r('readingGroupHead'), tier ? `${tier} group average` : 'Group average');
    setText(r('g4'), pctOr(d.g4));
    setText(r('g8'), pctOr(d.g8));
    setText(r('g4Group'), tier ? pctOr(mean(g4Vals)) : '—');
    setText(r('g8Group'), tier ? pctOr(mean(g8Vals)) : '—');
    setText(r('g4State'), pctOr(data.stateReading.grade4));
    setText(r('g8State'), pctOr(data.stateReading.grade8));
    setText(
      r('groupNote'),
      tier
        ? `${tier} group average: Grade 4, average of ${g4Vals.length} districts, each weighted equally; Grade 8, average of ${g8Vals.length} districts, each weighted equally. Washington: OSPI’s statewide figure.`
        : 'Washington: OSPI’s statewide figure.',
    );
    r('unavailableNote')!.hidden = d.g4 !== null && d.g8 !== null;
  }

  /** Hides the history chart's tooltip (replaced each time the chart is drawn). */
  let historyHide: () => void = () => {};
  // Touch: tapping anywhere outside the chart closes its tooltip.
  document.addEventListener('pointerdown', (event) => {
    if (!(event.target as Element | null)?.closest('.gm-chart__frame')) historyHide();
  });

  function drawHistory(
    container: HTMLElement,
    series: { district: number[]; group: (number | null)[] | null; state: (number | null)[] },
    groupLabel: string | null,
  ): void {
    historyHide();
    container.replaceChildren();
    // Drawn at the container's real width so text stays a readable size on phones.
    const W = Math.max(300, Math.round(container.clientWidth || 720));
    const narrow = W < 560;
    const H = narrow ? 260 : 300;
    const m = { top: 30, right: narrow ? 104 : 150, bottom: 34, left: 40 };
    const x = scalePoint<string>().domain(data.years).range([m.left, W - m.right]);
    const all = [...series.district, ...(series.group ?? []), ...series.state].filter((v): v is number => v !== null);
    const y = scaleLinear()
      .domain([0, Math.max(1, max(all) ?? 1)])
      .nice()
      .range([H - m.bottom, m.top]);
    const s = select(container).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
    s.append('g')
      .attr('class', 'gm-grid')
      .attr('transform', `translate(${m.left},0)`)
      .call(axisLeft(y).ticks(5).tickSize(-(W - m.left - m.right)).tickFormat(() => ''));
    s.append('g')
      .attr('class', 'gm-axis')
      .attr('transform', `translate(${m.left},0)`)
      .call(axisLeft(y).ticks(5));
    s.append('text').attr('x', 0).attr('y', 12).text('Librarian FTE');
    s.append('g')
      .attr('class', 'gm-axis')
      .attr('transform', `translate(0,${H - m.bottom})`)
      .call(
        axisBottom(x)
          .tickValues(data.years.filter((_, i) => (narrow ? i === 0 || i === data.years.length - 1 : i % 3 === 0 || i === data.years.length - 1)))
          .tickFormat((v) => yearLabel(v)),
      );

    const mk = line<number | null>()
      .defined((v) => v !== null)
      .x((_, i) => x(data.years[i]) ?? 0)
      .y((v) => y(v ?? 0));
    const labels: { cls: string; text: string; v: number | null }[] = [];
    if (series.group) {
      s.append('path').attr('class', 'gm-line gm-line--group').attr('d', mk(series.group));
      labels.push({
        cls: 'gm-line-label--group',
        text: narrow ? 'Group average' : (groupLabel ?? 'Group average'),
        v: series.group[LATEST],
      });
    }
    s.append('path').attr('class', 'gm-line gm-line--state').attr('d', mk(series.state));
    labels.push({ cls: 'gm-line-label--state', text: narrow ? 'State average' : 'Statewide average', v: series.state[LATEST] });
    s.append('path').attr('class', 'gm-line gm-line--district').attr('d', mk(series.district));
    s.append('g')
      .selectAll('circle')
      .data(series.district)
      .join('circle')
      .attr('class', 'gm-dot')
      .attr('r', 3.5)
      .attr('cx', (_, i) => x(data.years[i]) ?? 0)
      .attr('cy', (v) => y(v));
    labels.push({ cls: 'gm-line-label--district', text: 'This district', v: series.district[LATEST] });

    // Direct labels at the line ends, nudged apart so they don't overlap.
    const placed = labels
      .filter((l) => l.v !== null)
      .map((l) => ({ ...l, yPos: y(l.v ?? 0) }))
      .sort((a, b) => a.yPos - b.yPos);
    for (let i = 1; i < placed.length; i++) {
      if (placed[i].yPos - placed[i - 1].yPos < 15) placed[i].yPos = placed[i - 1].yPos + 15;
    }
    s.append('g')
      .selectAll('text')
      .data(placed)
      .join('text')
      .attr('class', (l) => `gm-line-label ${l.cls}`)
      .attr('x', W - m.right + 10)
      .attr('y', (l) => l.yPos)
      .attr('dy', '0.35em')
      .text((l) => l.text);

    // ---- Hover / tap a year: a guide line, a marker on each line, and a tooltip with all three values.
    const rows: { cls: string; label: string; values: (number | null)[] }[] = [
      { cls: 'district', label: 'This district', values: series.district },
      ...(series.group ? [{ cls: 'group', label: groupLabel ?? 'Group average', values: series.group }] : []),
      { cls: 'state', label: 'Statewide average', values: series.state },
    ];
    const focus = s.append('g').attr('class', 'gm-focus').style('display', 'none');
    const guide = focus.append('line').attr('class', 'gm-focus__guide').attr('y1', m.top).attr('y2', H - m.bottom);
    const markers = focus
      .selectAll('circle')
      .data(rows)
      .join('circle')
      .attr('class', (row) => `gm-focus__dot gm-focus__dot--${row.cls}`)
      .attr('r', 4.5);
    const tip = container.parentElement?.querySelector<HTMLElement>('[data-gm-r="historyTip"]') ?? null;
    const svgEl = s.node()!;

    const show = (i: number): void => {
      const cx = x(data.years[i]) ?? 0;
      focus.style('display', null);
      guide.attr('x1', cx).attr('x2', cx);
      markers
        .attr('cx', cx)
        .attr('cy', (row) => y(row.values[i] ?? 0))
        .style('display', (row) => (row.values[i] === null ? 'none' : null));
      if (!tip) return;
      // Built from text nodes only (no HTML strings).
      const title = document.createElement('strong');
      title.textContent = `${yearLabel(data.years[i])} · Librarian FTE`;
      const list = document.createElement('dl');
      for (const row of rows) {
        const item = document.createElement('div');
        const dt = document.createElement('dt');
        const key = document.createElement('span');
        key.className = `gm-tip-key gm-tip-key--${row.cls}`;
        dt.append(key, document.createTextNode(row.label));
        const dd = document.createElement('dd');
        dd.textContent = fmt(row.values[i], 2);
        item.append(dt, dd);
        list.append(item);
      }
      tip.replaceChildren(title, list);
      tip.hidden = false;
      const scale = svgEl.getBoundingClientRect().width / W;
      const px = cx * scale;
      const tw = tip.offsetWidth;
      if (narrow) {
        // Small screens: above the chart (so it never covers the lines), centred on the year
        // but kept inside the chart's width.
        tip.style.left = `${Math.min(Math.max(0, px - tw / 2), Math.max(0, container.clientWidth - tw))}px`;
        tip.style.top = `${-tip.offsetHeight - 8}px`;
      } else {
        // Wider screens: beside the guide line, flipped to the left near the right edge.
        const left = px + 14 + tw > container.clientWidth ? px - 14 - tw : px + 14;
        tip.style.left = `${Math.max(0, left)}px`;
        tip.style.top = `${m.top * scale}px`;
      }
    };
    const hide = (): void => {
      focus.style('display', 'none');
      if (tip) tip.hidden = true;
    };
    const nearestYear = (event: PointerEvent): number => {
      const rect = svgEl.getBoundingClientRect();
      const px = ((event.clientX - rect.left) / rect.width) * W;
      let best = 0;
      data.years.forEach((yr, i) => {
        if (Math.abs((x(yr) ?? 0) - px) < Math.abs((x(data.years[best]) ?? 0) - px)) best = i;
      });
      return best;
    };
    // A transparent layer over the plot area catches the pointer; touch can still scroll the page vertically.
    s.append('rect')
      .attr('class', 'gm-focus__catch')
      .attr('x', m.left)
      .attr('y', m.top)
      .attr('width', W - m.left - m.right)
      .attr('height', H - m.top - m.bottom)
      .on('pointermove pointerdown', (event: PointerEvent) => show(nearestYear(event)))
      .on('pointerleave', (event: PointerEvent) => {
        // A finger lifts as soon as it taps, so on touch the tooltip stays until the next tap elsewhere.
        if (event.pointerType === 'mouse') hide();
      });
    historyHide = hide;
  }

  // =========================================================================
  // Locale chart with year slider
  // =========================================================================
  const slider = $<HTMLInputElement>('[data-gm-year-slider]')!;
  const output = $('[data-gm-year-output]');
  const localeChart = $('[data-gm-locale-chart]')!;
  slider.disabled = false;

  function localeStats(i: number) {
    return data.tiers.map((t, ti) => {
      const pool = data.districts.filter((d) => d.tier[i] === ti);
      const zero = pool.filter((d) => fteAt(d, i) === 0).length;
      return { tier: t, n: pool.length, zero, pct: pool.length ? (zero / pool.length) * 100 : null };
    });
  }

  function drawLocale(i: number): void {
    const stats = localeStats(i);
    const label = yearLabel(data.years[i]);
    slider.setAttribute('aria-valuetext', label);
    setText(output, label);

    const withData = stats.filter((s) => s.pct !== null);
    const hi = withData.reduce((a, b) => ((b.pct ?? 0) > (a.pct ?? 0) ? b : a));
    const lo = withData.reduce((a, b) => ((b.pct ?? 0) < (a.pct ?? 0) ? b : a));
    setText(
      $('[data-gm-locale-summary]'),
      `In ${label}, the share of districts with no librarian ranged from ${Math.round(lo.pct ?? 0)}% (${lo.tier}, ${lo.n} ${lo.n === 1 ? 'district' : 'districts'}) to ${Math.round(hi.pct ?? 0)}% (${hi.tier}, ${hi.n} districts).`,
    );
    setText($('[data-gm-locale-table-caption]'), `Districts with no librarian, by locale group, ${label}`);
    $('[data-gm-locale-rows]')!.replaceChildren(
      ...stats.map((s) => {
        const tr = document.createElement('tr');
        const th = document.createElement('th');
        th.scope = 'row';
        th.textContent = s.tier;
        tr.append(th);
        for (const c of [String(s.n), String(s.zero), s.pct === null ? '—' : `${Math.round(s.pct)}%`]) {
          const td = document.createElement('td');
          td.textContent = c;
          tr.append(td);
        }
        return tr;
      }),
    );

    localeChart.replaceChildren();
    const W = Math.max(300, Math.round(localeChart.clientWidth || 720));
    const narrow = W < 560;
    const H = narrow ? 300 : 320;
    const m = { top: 28, right: 4, bottom: narrow ? 62 : 48, left: 40 };
    const x = scaleBand<string>().domain(data.tiers).range([m.left, W - m.right]).padding(0.28);
    const y = scaleLinear().domain([0, 100]).range([H - m.bottom, m.top]);
    const s = select(localeChart).append('svg').attr('viewBox', `0 0 ${W} ${H}`);
    s.append('g')
      .attr('class', 'gm-grid')
      .attr('transform', `translate(${m.left},0)`)
      .call(axisLeft(y).tickValues([0, 25, 50, 75, 100]).tickSize(-(W - m.left - m.right)).tickFormat(() => ''));
    s.append('g')
      .attr('class', 'gm-axis')
      .attr('transform', `translate(${m.left},0)`)
      .call(axisLeft(y).tickValues([0, 25, 50, 75, 100]).tickFormat((v) => `${v}%`));
    s.append('g')
      .attr('class', 'gm-axis')
      .attr('transform', `translate(0,${H - m.bottom})`)
      .call(axisBottom(x).tickSize(0))
      .call((g) => {
        g.selectAll('text').attr('dy', '1.2em');
        // Narrow screens: smaller names, two-word names split onto two lines.
        if (narrow) {
          g.selectAll<SVGTextElement, string>('text').classed('gm-tick-narrow', true).each(function (name) {
            const words = name.split(' ');
            if (words.length < 2) return;
            const t = select(this).text(null);
            words.forEach((w, i) => t.append('tspan').attr('x', 0).attr('dy', i === 0 ? '1.2em' : '1.1em').text(w));
          });
        }
      });
    s.append('g')
      .selectAll('rect')
      .data(stats)
      .join('rect')
      .attr('class', 'gm-bar')
      .attr('x', (d) => x(d.tier) ?? 0)
      .attr('width', x.bandwidth())
      .attr('y', (d) => y(d.pct ?? 0))
      .attr('height', (d) => y(0) - y(d.pct ?? 0));
    s.append('g')
      .selectAll('text')
      .data(stats)
      .join('text')
      .attr('class', 'gm-bar-value')
      .attr('text-anchor', 'middle')
      .attr('x', (d) => (x(d.tier) ?? 0) + x.bandwidth() / 2)
      .attr('y', (d) => y(d.pct ?? 0) - 8)
      .text((d) => (d.pct === null ? '—' : `${Math.round(d.pct)}%`));
    s.append('g')
      .selectAll('text')
      .data(stats)
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('x', (d) => (x(d.tier) ?? 0) + x.bandwidth() / 2)
      .attr('y', H - m.bottom + (narrow ? 50 : 34))
      .text((d) => (narrow ? `n = ${d.n}` : `${d.n} ${d.n === 1 ? 'district' : 'districts'}`));
  }

  slider.addEventListener('input', () => drawLocale(Number(slider.value)));
  drawLocale(Number(slider.value));

  // Redraw both charts when their width changes (rotating a phone, resizing a window).
  let lastWidth = localeChart.clientWidth;
  let resizeTimer: number | undefined;
  new ResizeObserver(() => {
    if (Math.abs(localeChart.clientWidth - lastWidth) < 8) return;
    lastWidth = localeChart.clientWidth;
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      drawLocale(Number(slider.value));
      const d = selectedId ? byId.get(selectedId) : null;
      if (d) renderReport(d);
    }, 150);
  }).observe(localeChart);

  // =========================================================================
  // Table: sorting and year
  // =========================================================================
  const table = $('[data-gm-table]')!;
  const tbodyEl = $('[data-gm-table-body]', table)!;
  const yearSelect = $<HTMLSelectElement>('[data-gm-table-year]', table)!;
  const sortButtons = Array.from(table.querySelectorAll<HTMLButtonElement>('[data-gm-sort]'));
  let sortKey = 'name';
  let sortDir: 1 | -1 = 1;
  let tableYear = LATEST;

  type Key = 'name' | 'county' | 'tier' | 'fte' | 'spl' | 'lps' | 'change';
  const value = (d: DistrictData, key: Key): string | number | null => {
    const i = tableYear;
    switch (key) {
      case 'name':
        return d.name;
      case 'county':
        return d.county;
      case 'tier':
        return d.tier[i] >= 0 ? d.tier[i] : null; // sorts rural → urban, not alphabetically
      case 'fte':
        return d.fte[i];
      case 'spl':
        return d.spl[i];
      case 'lps':
        return d.lps[i];
      case 'change':
        return changeSinceFirst(d);
    }
  };

  function renderTable(): void {
    const key = sortKey as Key;
    const rows = [...data.districts].sort((a, b) => {
      const va = value(a, key);
      const vb = value(b, key);
      if (va === null && vb === null) return a.name.localeCompare(b.name);
      if (va === null) return 1; // blanks last, either direction
      if (vb === null) return -1;
      const c = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return c === 0 ? a.name.localeCompare(b.name) : c * sortDir;
    });
    tbodyEl.replaceChildren(
      ...rows.map((d) => {
        const tr = document.createElement('tr');
        tr.dataset.gmRow = d.id;
        if (d.id === selectedId) tr.classList.add('is-selected');
        const th = document.createElement('th');
        th.scope = 'row';
        const a = document.createElement('a');
        a.href = `?district=${encodeURIComponent(d.id)}#district-report`;
        a.dataset.gmPick = d.id;
        a.textContent = d.name;
        if (d.id === selectedId) a.setAttribute('aria-current', 'true');
        th.append(a);
        tr.append(th);
        const i = tableYear;
        const cells: [string, boolean][] = [
          [d.county ?? '—', false],
          [tierName(d, i) ?? '—', false],
          [fmt(d.fte[i], 2), true],
          [fmt(d.spl[i], 0), true],
          [fmt(d.lps[i], 2), true],
          [signedPct(changeSinceFirst(d)), true],
        ];
        for (const [text, numeric] of cells) {
          const td = document.createElement('td');
          if (numeric) td.className = 'is-numeric';
          td.textContent = text;
          tr.append(td);
        }
        return tr;
      }),
    );
    const label = sortButtons.find((b) => b.dataset.gmSort === sortKey)?.textContent?.trim() ?? '';
    const caption = `All districts, ${yearLabel(data.years[tableYear])}, sorted by ${label} (${sortDir === 1 ? 'ascending' : 'descending'})`;
    setText($('[data-gm-table-caption]', table), caption);
    setText($('[data-gm-table-status]', table), caption);
    for (const b of sortButtons) {
      const th = b.closest('th')!;
      if (b.dataset.gmSort === sortKey) th.setAttribute('aria-sort', sortDir === 1 ? 'ascending' : 'descending');
      else th.removeAttribute('aria-sort');
    }
  }

  for (const b of sortButtons) {
    b.disabled = false;
    b.addEventListener('click', () => {
      const key = b.dataset.gmSort!;
      const numeric = b.closest('th')!.classList.contains('is-numeric');
      if (key === sortKey) sortDir = sortDir === 1 ? -1 : 1;
      else {
        sortKey = key;
        sortDir = numeric ? -1 : 1; // numbers start highest-first, text A–Z
      }
      renderTable();
    });
  }
  yearSelect.disabled = false;
  yearSelect.addEventListener('change', () => {
    tableYear = Number(yearSelect.value);
    renderTable();
  });
  // Clicking a district name in the table opens its report without reloading the page.
  tbodyEl.addEventListener('click', (e) => {
    const a = (e.target as Element).closest<HTMLAnchorElement>('a[data-gm-pick]');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
    e.preventDefault();
    choose(a.dataset.gmPick!, { push: true, focusReport: true });
  });

  // =========================================================================
  // Selection + URL
  // =========================================================================
  function choose(id: string, opts: { push: boolean; focusReport: boolean }): void {
    const d = byId.get(id);
    if (!d) return;
    if (selectedId) pathById.get(selectedId)?.classList.remove('is-selected');
    selectedId = id;
    pathById.get(id)?.classList.add('is-selected');
    raiseSelected();
    tbodyEl.querySelectorAll('tr.is-selected').forEach((tr) => tr.classList.remove('is-selected'));
    tbodyEl.querySelectorAll('a[aria-current]').forEach((a) => a.removeAttribute('aria-current'));
    const row = tbodyEl.querySelector<HTMLElement>(`tr[data-gm-row="${CSS.escape(id)}"]`);
    row?.classList.add('is-selected');
    row?.querySelector('a')?.setAttribute('aria-current', 'true');

    renderReport(d);

    if (opts.push) {
      const url = new URL(window.location.href);
      url.searchParams.set('district', id);
      url.hash = 'district-report';
      window.history.pushState({ district: id }, '', url);
    }
    report.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    if (opts.focusReport) r('name')?.focus({ preventScroll: true });
  }

  function fromUrl(): void {
    const id = new URLSearchParams(window.location.search).get('district');
    if (id && byId.has(id)) choose(id, { push: false, focusReport: false });
  }
  window.addEventListener('popstate', () => {
    const id = new URLSearchParams(window.location.search).get('district');
    if (id && byId.has(id)) choose(id, { push: false, focusReport: false });
    else {
      if (selectedId) pathById.get(selectedId)?.classList.remove('is-selected');
      selectedId = null;
      $('[data-gm-report-empty]')!.hidden = false;
      $('[data-gm-report-body]')!.hidden = true;
      renderTable();
    }
  });

  renderTable();
  fromUrl();
}

void main();
