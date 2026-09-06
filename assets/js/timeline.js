(function () {
  'use strict';
  const root = document.getElementById('research-timeline');
  if (!root) return;
  const zh = document.documentElement.lang.startsWith('zh');
  const words = zh ? {
    present: '至今', period: '研究周期', publication: '论文 / 发表年份', ongoing: '进行中',
    details: '查看详情', paper: '论文', code: '代码', poster: '海报', record: '论文条目',
    now: '现在', months: '个月', empty: '该年份无此方向项目', count: '个项目',
    project: '项目', image: '论文示意图', openImage: '查看原图', missing: '更多信息请查看论文。'
  } : {
    present: 'Present', period: 'Research period', publication: 'Publication / year', ongoing: 'Ongoing',
    details: 'View details', paper: 'Paper', code: 'Code', poster: 'Poster', record: 'Publication entry',
    now: 'Now', months: 'mo', empty: 'No projects in this topic', count: 'projects',
    project: 'Project', image: 'Research figure', openImage: 'Open full figure', missing: 'See the paper for more information.'
  };
  function read(id) { return JSON.parse(document.getElementById(id).textContent); }
  function month(value) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value || '')) return null;
    const parts = value.split('-').map(Number);
    return parts[0] * 12 + parts[1] - 1;
  }
  function dateLabel(index) { return Math.floor(index / 12) + '.' + String(index % 12 + 1).padStart(2, '0'); }
  function node(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
  }
  function safeUrl(value) {
    if (!value) return null;
    try {
      const url = new URL(value, location.href);
      return /^https?:$/.test(url.protocol) ? url.href : null;
    } catch (_) { return null; }
  }
  let data, columns, range;
  try { data = read('timeline-data'); columns = read('timeline-columns'); range = read('timeline-range') || {}; }
  catch (_) { return; } // The server-rendered project list remains usable.
  if (!Array.isArray(data) || !data.length || !Array.isArray(columns) || !columns.length) return;
  const today = new Date();
  const now = today.getFullYear() * 12 + today.getMonth();
  const projects = data.map(p => ({...p, startIndex: month(p.start), endIndex: p.end ? month(p.end) : now}))
    .filter(p => p.startIndex !== null && p.endIndex !== null && p.endIndex >= p.startIndex && columns[p.lane])
    .sort((a, b) => b.endIndex - a.endIndex || b.startIndex - a.startIndex || a.name.localeCompare(b.name));
  if (!projects.length) return;
  // Keep a fixed, complete extent when filtering so bar lengths stay comparable.
  const first = Math.min(month(range.start) ?? projects[0].startIndex, ...projects.map(p => p.startIndex));
  const last = Math.max(month(range.end) ?? now, ...projects.map(p => p.endIndex));
  const totalMonths = last - first + 1;
  const journey = document.getElementById('timeline-journey');
  const gantt = document.getElementById('timeline-gantt');
  const journeyContent = document.getElementById('timeline-journey-content');
  const ganttScroll = document.getElementById('timeline-gantt-scroll');
  const dialog = document.getElementById('timeline-details');
  const detailContent = document.getElementById('timeline-detail-content');
  const params = new URLSearchParams(location.search);
  let view = params.get('view') === 'gantt' ? 'gantt' : 'journey';
  let topic = params.get('topic') || 'all';
  if (!columns.some((_, i) => String(i) === topic)) topic = 'all';
  let opener = null;

  function period(p) { return dateLabel(p.startIndex) + ' – ' + (p.end ? dateLabel(p.endIndex) : words.present); }
  function publication(p) {
    if (!p.venue) return p.publicationYear || words.project;
    return p.publicationYear && !p.venue.includes(p.publicationYear) ? p.venue + ' · ' + p.publicationYear : p.venue;
  }
  function color(el, lane) { el.style.setProperty('--topic-color', columns[lane].color); return el; }
  function projectButton(p, className) {
    const el = color(node('button', className), p.lane);
    el.type = 'button';
    el.dataset.project = p.id;
    el.setAttribute('aria-haspopup', 'dialog');
    el.setAttribute('aria-controls', 'timeline-details');
    el.setAttribute('aria-label', p.name + ', ' + words.period + ': ' + period(p) + ', ' + words.details);
    el.addEventListener('click', () => showDetails(p, el));
    return el;
  }
  function renderJourney(list) {
    journeyContent.replaceChildren();
    const lanes = columns.map((_, i) => i).filter(i => topic === 'all' || String(i) === topic);
    journeyContent.style.setProperty('--topic-count', lanes.length);
    const headings = node('div', 'journey-headings');
    headings.append(node('span', 'journey-year-label', zh ? '年份' : 'Year'));
    lanes.forEach(i => headings.append(color(node('span', 'journey-topic-heading', columns[i].label), i)));
    journeyContent.append(headings);
    const years = [...new Set(list.map(p => Math.floor(p.endIndex / 12)))];
    years.forEach(year => {
      const section = node('section', 'journey-year');
      section.setAttribute('aria-labelledby', 'journey-year-' + year);
      const heading = node('h2', 'journey-year__heading', year);
      heading.id = 'journey-year-' + year;
      section.append(heading);
      lanes.forEach(i => {
        const lane = node('div', 'journey-lane');
        const matches = list.filter(p => Math.floor(p.endIndex / 12) === year && p.lane === i);
        if (!matches.length) {
          const empty = node('span', 'journey-empty', '—');
          empty.setAttribute('aria-label', words.empty);
          lane.append(empty);
        }
        matches.forEach(p => {
          const card = projectButton(p, 'journey-card');
          card.append(node('span', 'journey-card__topic', columns[i].label));
          card.append(node('strong', 'journey-card__name', p.name));
          card.append(node('span', 'journey-card__period', period(p)));
          const meta = node('span', 'journey-card__meta');
          meta.append(node('span', 'timeline-venue', publication(p)));
          if (!p.end) meta.append(node('span', 'timeline-ongoing', words.ongoing));
          card.append(meta);
          card.append(node('span', 'journey-card__more', words.details + ' ↗'));
          lane.append(card);
        });
        if (!matches.length) lane.classList.add('journey-lane--empty');
        section.append(lane);
      });
      journeyContent.append(section);
    });
  }

  function renderGantt(list) {
    ganttScroll.replaceChildren();
    const chart = node('div', 'gantt-chart');
    chart.style.setProperty('--months', totalMonths);
    const header = node('div', 'gantt-header');
    header.append(node('div', 'gantt-label gantt-label--header', words.project));
    const ticks = node('div', 'gantt-scale');
    // Consecutive grid cells always represent exactly one inclusive calendar month.
    for (let index = first; index <= last; index++) {
      const cell = node('span', 'gantt-month');
      const m = index % 12;
      if (m === 0 || index === first) cell.append(node('strong', 'gantt-year', Math.floor(index / 12)));
      if (m % 3 === 0) cell.append(node('span', 'gantt-quarter', 'Q' + (Math.floor(m / 3) + 1)));
      cell.title = dateLabel(index);
      ticks.append(cell);
    }
    header.append(ticks);
    chart.append(header);
    columns.forEach((col, i) => {
      const lane = list.filter(p => p.lane === i);
      if (!lane.length) return;
      const group = color(node('div', 'gantt-group'), i);
      group.append(node('h3', 'gantt-group__heading', col.label));
      chart.append(group);
      lane.forEach(p => {
        const row = node('div', 'gantt-row');
        const label = projectButton(p, 'gantt-label gantt-project');
        label.append(node('strong', '', p.name), node('span', '', period(p)));
        const track = node('div', 'gantt-track');
        const bar = projectButton(p, 'gantt-bar');
        const duration = p.endIndex - p.startIndex + 1;
        bar.style.left = ((p.startIndex - first) / totalMonths * 100) + '%';
        bar.style.width = (duration / totalMonths * 100) + '%';
        bar.dataset.months = duration;
        bar.title = p.name + '\n' + period(p) + ' · ' + duration + ' ' + words.months;
        if (!p.end) bar.classList.add('gantt-bar--ongoing');
        if (duration >= 3) bar.append(node('span', '', duration + ' ' + words.months));
        track.append(bar);
        row.append(label, track);
        chart.append(row);
      });
    });
    if (now >= first && now <= last) {
      const marker = node('div', 'gantt-now');
      marker.style.left = 'calc(var(--label-width) + (100% - var(--label-width)) * ' + ((now - first + 0.5) / totalMonths) + ')';
      marker.append(node('span', '', words.now));
      chart.append(marker);
    }
    ganttScroll.append(chart);
  }

  function addLink(parent, label, value) {
    const url = safeUrl(value);
    if (!url) return;
    const a = node('a', 'timeline-detail-link', label + ' ↗');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    parent.append(a);
  }
  function showDetails(p, button) {
    opener = button;
    detailContent.replaceChildren();
    color(dialog, p.lane);
    detailContent.append(node('p', 'timeline-details__topic', columns[p.lane].label));
    const heading = node('h2', '', p.title);
    heading.id = 'timeline-detail-title';
    detailContent.append(heading);
    const facts = node('dl', 'timeline-details__facts');
    facts.append(node('dt', '', words.period), node('dd', '', period(p)), node('dt', '', words.publication), node('dd', '', publication(p)));
    detailContent.append(facts);
    if (safeUrl(p.image)) {
      const figure = node('figure', 'timeline-details__figure');
      const img = node('img');
      img.src = safeUrl(p.image);
      img.alt = words.image + ': ' + p.name;
      img.decoding = 'async';
      figure.append(img);
      const caption = node('figcaption');
      addLink(caption, words.openImage, p.image);
      figure.append(caption);
      detailContent.append(figure);
    }
    detailContent.append(node('p', 'timeline-details__summary', p.summary || words.missing));
    const links = node('div', 'timeline-details__links');
    addLink(links, words.paper, p.paper);
    addLink(links, words.code, p.code);
    addLink(links, words.poster, p.poster);
    addLink(links, words.record, p.url);
    detailContent.append(links);
    dialog.showModal();
    dialog.scrollTop = 0;
  }
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { if (opener && opener.isConnected) opener.focus({preventScroll: true}); });

  function syncLocation() {
    const url = new URL(location.href);
    url.searchParams.set('view', view);
    if (topic === 'all') url.searchParams.delete('topic'); else url.searchParams.set('topic', topic);
    history.replaceState(null, '', url);
    document.querySelectorAll('.masthead a[hreflang]').forEach(link => {
      const target = new URL(link.href);
      target.searchParams.set('view', view);
      if (topic === 'all') target.searchParams.delete('topic'); else target.searchParams.set('topic', topic);
      link.href = target.href;
    });
  }
  function update() {
    const list = projects.filter(p => topic === 'all' || String(p.lane) === topic);
    renderJourney(list);
    renderGantt(list);
    journey.hidden = view !== 'journey';
    gantt.hidden = view !== 'gantt';
    // Open the scrollable chart at the most recent months on narrow screens.
    if (view === 'gantt') ganttScroll.scrollLeft = ganttScroll.scrollWidth - ganttScroll.clientWidth;
    root.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
    root.querySelectorAll('[data-topic]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.topic === topic)));
    document.getElementById('timeline-count').textContent = list.length + ' / ' + projects.length + ' ' + words.count;
    syncLocation();
  }
  root.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { view = b.dataset.view; update(); }));
  root.querySelectorAll('[data-topic]').forEach(b => b.addEventListener('click', () => { topic = b.dataset.topic; update(); }));
  update();
  root.querySelector('.timeline-toolbar').hidden = false;
  root.querySelector('.timeline-filters').hidden = false;
  document.getElementById('timeline-fallback').hidden = true;
})();
