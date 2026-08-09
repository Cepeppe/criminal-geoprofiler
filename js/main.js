/**
 * main.js - orchestrazione: collega stato, interfaccia, mappa e modelli.
 *
 * Il risultato del modello viene memorizzato: cambiare scala cromatica,
 * opacità, soglia o isolinee ridisegna soltanto il raster, senza ricalcolare
 * la superficie. Il ricalcolo avviene solo quando cambiano i dati, il modello,
 * i suoi parametri, la metrica o la griglia.
 */

import {
  $, $$, on, setText, setHtml, show, toast, createModal, debounce, cssColorHex,
  fmtInt, fmtNum, fmtDistance, fmtArea, fmtPercent, fmtCoord, fmtDuration,
} from './dom.js';
import { createStore } from './store.js';
import { loadDataset, PRESETS, presetName, relocalizeLabel } from './data.js';
import {
  buildGrid, getMetric, centroid, geometricMedian, standardDistanceKm,
  nearestNeighborStats, standardDeviationalEllipse, maxPairDistanceKm,
} from './geo.js';
import {
  METHODS, methodLabel, methodDesc, computeSurface, suggestBandwidth, halfDistanceFromLambda,
} from './models.js';
import {
  percentileField, linearField, renderRaster, canvasToUrl, findPeaks, hitScore,
  drawLegendRamp, CONTOUR_LEVELS,
} from './surface.js';
import {
  parseLatLng, parseCsv, toCsv, parseGeoJson, toGeoJson, downloadText,
  encodeShareUrl, decodeShareUrl, copyToClipboard,
} from './io.js';
import { createMapView } from './mapview.js';
import { t, applyI18n, setLang, getLang, resolveLang, langFromUrl } from './i18n.js';

/* ═══════════════════════════ Avvio ═══════════════════════════ */

if (!window.L) {
  document.body.innerHTML =
    '<div class="file-guard"><div class="file-guard__box">' +
    `<h2>${t('app.noLeaflet.title')}</h2>` +
    `<p>${t('app.noLeaflet.body')}</p>` +
    '</div></div>';
  throw new Error('Leaflet non disponibile');
}

const store = createStore();

/**
 * Ultimo risultato del modello, riusato per i ridisegni puramente grafici.
 * `pct` (rango percentile) è calcolato una sola volta e resta indipendente
 * dalla scala di visualizzazione scelta: picchi e hit score devono riferirsi
 * sempre alle frazioni d'area, non alla mappatura cromatica corrente.
 */
let current = null;   // { grid, prob, pct, maxProb, field, scale, peaks, elapsedMs }
let renderToken = 0;

/* ═══════════════════════════ Riferimenti DOM ═══════════════════════════ */

const el = {
  sidebar: $('#sidebar'),
  scrim: $('#scrim'),
  resizer: $('#resizer'),

  pointsList: $('#pointsList'),
  pointsEmpty: $('#pointsEmpty'),
  pointsCount: $('#pointsCount'),
  btnUndo: $('#btnUndo'),
  btnRedo: $('#btnRedo'),
  btnFit: $('#btnFit'),

  btnAddMode: $('#btnAddMode'),
  coordInput: $('#coordInput'),

  method: $('#method'),
  methodDesc: $('#methodDesc'),
  distMetric: $('#distMetric'),
  gridAuto: $('#gridAuto'),
  gridStep: $('#gridStep'),
  gridInfo: $('#gridInfo'),
  btnRun: $('#btnRun'),

  colormap: $('#colormap'),
  colorScale: $('#colorScale'),
  opacity: $('#opacity'),
  opacityOut: $('#opacityOut'),
  threshold: $('#threshold'),
  thresholdOut: $('#thresholdOut'),
  showContours: $('#showContours'),
  basemap: $('#basemap'),
  showLabels: $('#showLabels'),
  showCentro: $('#showCentro'),
  showEllipse: $('#showEllipse'),
  theme: $('#theme'),
  lang: $('#lang'),

  peaksList: $('#peaksList'),
  peaksEmpty: $('#peaksEmpty'),
  btnSetAnchor: $('#btnSetAnchor'),
  btnClearAnchor: $('#btnClearAnchor'),
  anchorResult: $('#anchorResult'),
  hitScore: $('#hitScore'),
  hitArea: $('#hitArea'),
  anchorCoord: $('#anchorCoord'),
  statsList: $('#statsList'),
  statsEmpty: $('#statsEmpty'),

  kpiPoints: $('#kpiPoints'),
  kpiCells: $('#kpiCells'),
  kpiRes: $('#kpiRes'),
  kpiTime: $('#kpiTime'),

  legendCard: $('#legendCard'),
  legendRamp: $('#legendRamp'),
  legendTitle: $('#legendTitle'),
  legendStale: $('#legendStale'),
  legendScale: $('#legendScale'),
  legendNotes: $('#legendNotes'),

  fileInput: $('#fileInput'),
};

const PARAM_FIELDS = {
  rossmo: { B: '#rossmoB', f: '#rossmoF', g: '#rossmoG' },
  kde: { sigma: '#kdeSigma' },
  meanCenter: { scale: '#mcScale' },
  journey: { lambda: '#journeyLambda' },
};

/* ═══════════════════════════ Mappa ═══════════════════════════ */

const view = createMapView('map', {
  onMapClick: (latlng, mode) => {
    if (mode === 'add') {
      store.addPoint({ lat: latlng.lat, lng: latlng.lng, label: '' });
    } else if (mode === 'anchor') {
      store.setAnchor(latlng);
      setAnchorMode(false);
      toast(t('toast.anchorSet'), 'ok');
    }
  },
  onRemovePoint: (index) => store.removePoint(index),
  onPointHover: (index, active) => {
    const li = el.pointsList?.querySelector(`li[data-index="${index}"]`);
    li?.classList.toggle('is-hover', active);
  },
});

/* ═══════════════════════════ Tema ═══════════════════════════ */

const prefersLight = window.matchMedia('(prefers-color-scheme: light)');

function applyTheme(mode) {
  const resolved = mode === 'auto' ? (prefersLight.matches ? 'light' : 'dark') : mode;
  document.documentElement.dataset.theme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute(
    'content', resolved === 'light' ? '#eef1f7' : '#080c18',
  );
  updateLegend();
}
on(prefersLight, 'change', () => {
  if (store.state.settings.theme === 'auto') applyTheme('auto');
});

/* ═══════════════════════════ Lingua ═══════════════════════════ */

/**
 * Cambia lingua senza ricaricare: riscrive i nodi annotati e poi rigenera
 * tutto ciò che è prodotto da JavaScript. Nessun ricalcolo del modello — la
 * superficie non dipende dalla lingua — quindi `current` resta valido.
 */
function applyLanguage(pref) {
  setLang(resolveLang(pref));
  applyI18n();

  // Le etichette del dataset contengono una data scritta a parole
  store.relabelPoints(relocalizeLabel);

  syncFormFromState();   // riallinea anche i due selettori di lingua
  renderPointsList();
  renderStats();
  renderCentrographic();
  renderPeaks();
  updateHitScore();
  updateGridInfo();
  updateLegend();
  setStale(stale);
  setAnchorMode(el.btnSetAnchor.getAttribute('aria-pressed') === 'true');
  view.renderPoints(store.state.points, { showLabels: store.state.settings.showLabels });
}

function syncLangControls(pref) {
  if (el.lang) el.lang.value = pref;
  for (const btn of $$('.langswitch__btn')) {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === getLang()));
  }
}

/* ═══════════════════════════ Schede ═══════════════════════════ */

function initTabs() {
  const tabs = $$('.tab');
  const panes = tabs.map((tab) => $(`#${tab.getAttribute('aria-controls')}`));

  const select = (index) => {
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      if (panes[i]) {
        panes[i].hidden = !active;
        panes[i].classList.toggle('is-active', active);
      }
    });
  };

  tabs.forEach((tab, i) => {
    on(tab, 'click', () => select(i));
    on(tab, 'keydown', (e) => {
      const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!delta) return;
      e.preventDefault();
      const next = (i + delta + tabs.length) % tabs.length;
      select(next);
      tabs[next].focus();
    });
  });

  return { select };
}
const tabs = initTabs();

/* ═══════════════════════════ Drawer & resizer ═══════════════════════════ */

const isMobile = () => window.matchMedia('(max-width: 900px)').matches;

function openSidebar() {
  document.body.classList.add('sidebar-open');
  show(el.scrim, true);
  $('#btnOpenSidebar')?.setAttribute('aria-expanded', 'true');
  setTimeout(() => view.invalidate(), 280);
}
function closeSidebar() {
  document.body.classList.remove('sidebar-open');
  show(el.scrim, false);
  $('#btnOpenSidebar')?.setAttribute('aria-expanded', 'false');
  setTimeout(() => view.invalidate(), 280);
}

on($('#btnOpenSidebar'), 'click', () =>
  document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar());
on($('#btnCloseSidebar'), 'click', closeSidebar);
on(el.scrim, 'click', closeSidebar);

function initResizer() {
  const MIN = 320, MAX = 640;
  let dragging = false;

  const setWidth = (px) => {
    const w = Math.min(MAX, Math.max(MIN, px));
    document.documentElement.style.setProperty('--sidebar-w', `${w}px`);
    view.invalidate();
  };

  on(el.resizer, 'pointerdown', (e) => {
    if (isMobile()) return;
    dragging = true;
    el.resizer.setPointerCapture?.(e.pointerId);
    document.body.classList.add('is-resizing');
    e.preventDefault();
  });
  on(window, 'pointermove', (e) => { if (dragging) setWidth(e.clientX); });
  on(window, 'pointerup', () => {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('is-resizing');
  });

  on(el.resizer, 'keydown', (e) => {
    const delta = e.key === 'ArrowRight' ? 16 : e.key === 'ArrowLeft' ? -16 : 0;
    if (!delta) return;
    e.preventDefault();
    setWidth((el.sidebar?.getBoundingClientRect().width || 400) + delta);
  });
}
initResizer();

// La larghezza personalizzata vale solo su desktop: su mobile la sidebar è un
// drawer e la variabile inline sovrascriverebbe la media query.
on(window, 'resize', debounce(() => {
  if (isMobile()) {
    document.documentElement.style.removeProperty('--sidebar-w');
    closeSidebar();
  }
  view.invalidate();
}, 160));

/* ═══════════════════════════ Elenco punti ═══════════════════════════ */

function renderPointsList() {
  const { points } = store.state;
  setText(el.pointsCount, String(points.length));
  setText(el.kpiPoints, String(points.length));
  show(el.pointsEmpty, points.length === 0);

  el.pointsList.replaceChildren();

  points.forEach((p, i) => {
    const li = document.createElement('li');
    li.dataset.index = String(i);

    const idx = document.createElement('span');
    idx.className = 'p-idx';
    idx.textContent = String(i + 1);

    const body = document.createElement('span');
    body.className = 'p-body';
    const name = document.createElement('span');
    name.className = 'p-name';
    name.textContent = p.label || t('data.point.n', { n: i + 1 });
    const coord = document.createElement('span');
    coord.className = 'p-coord';
    coord.textContent = fmtCoord(p.lat, p.lng);
    body.append(name, coord);

    const del = document.createElement('button');
    del.className = 'icon-btn p-del';
    del.title = t('action.removePoint');
    del.setAttribute('aria-label', t('action.removePointN', { n: i + 1 }));
    del.textContent = '✕';
    on(del, 'click', (e) => { e.stopPropagation(); store.removePoint(i); });

    on(li, 'click', () => view.flyTo(p.lat, p.lng));
    on(li, 'mouseenter', () => view.highlightPoint(i, true));
    on(li, 'mouseleave', () => view.highlightPoint(i, false));

    li.append(idx, body, del);
    el.pointsList.appendChild(li);
  });

  if (el.btnUndo) el.btnUndo.disabled = !store.canUndo;
  if (el.btnRedo) el.btnRedo.disabled = !store.canRedo;
}

/* ═══════════════════════════ Statistiche ═══════════════════════════ */

function renderStats() {
  const { points, settings } = store.state;
  const metric = getMetric(settings.distMetric);

  show(el.statsEmpty, points.length < 2);
  el.statsList.replaceChildren();
  if (points.length < 2) return;

  const c = centroid(points);
  const med = geometricMedian(points, { metric });
  const sd = standardDistanceKm(points, c, metric);
  const nn = nearestNeighborStats(points, metric);
  const ell = standardDeviationalEllipse(points);
  const span = maxPairDistanceKm(points, metric);

  const rows = [
    [t('res.stats.span'), fmtDistance(span)],
    [t('res.stats.centroid'), fmtCoord(c.lat, c.lng)],
    [t('res.stats.median'), med ? fmtCoord(med.lat, med.lng) : '–'],
    [t('res.stats.sd'), fmtDistance(sd)],
    [t('res.stats.nnMedian'), nn ? fmtDistance(nn.median) : '–'],
    [t('res.stats.nnRange'), nn ? `${fmtDistance(nn.min)} – ${fmtDistance(nn.max)}` : '–'],
  ];
  if (ell) {
    rows.push([t('res.stats.ellipse'), `${fmtDistance(ell.semiMajorKm)} × ${fmtDistance(ell.semiMinorKm)}`]);
    rows.push([t('res.stats.azimuth'), `${fmtNum(ell.azimuthDeg, 0)}°`]);
  }

  for (const [label, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    el.statsList.append(dt, dd);
  }
}

function renderCentrographic() {
  const { points, settings } = store.state;
  if (points.length < 2) { view.renderCentrographic({ show: false, showEllipse: false }); return; }

  const metric = getMetric(settings.distMetric);
  view.renderCentrographic({
    centroid: centroid(points),
    median: geometricMedian(points, { metric }),
    ellipse: standardDeviationalEllipse(points),
    show: settings.showCentro,
    showEllipse: settings.showEllipse,
  });
}

/* ═══════════════════════════ Calcolo ═══════════════════════════ */

async function runAnalysis() {
  const { points, settings } = store.state;
  if (!points.length) {
    toast(t('toast.needPoint'), 'error');
    tabs.select(0);
    return;
  }

  const btn = el.btnRun;
  btn.disabled = true;
  btn.textContent = t('model.running');
  let succeeded = false;

  // Lascia ridisegnare l'interfaccia prima di occupare il thread principale
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const grid = buildGrid(points, {
      targetCells: 40000,
      stepM: settings.gridAuto ? null : Math.max(25, settings.gridStep),
    });

    const { prob, elapsedMs } = computeSurface(
      settings.method, grid, points,
      settings.params[settings.method],
      getMetric(settings.distMetric),
    );

    const pct = percentileField(prob);
    let maxProb = 0;
    for (let i = 0; i < prob.length; i++) if (prob[i] > maxProb) maxProb = prob[i];

    current = {
      grid, prob, pct, maxProb, elapsedMs,
      field: null, scale: null,
      peaks: findPeaks(grid, prob, pct, { count: 5 }),
    };
    renderPeaks();

    setText(el.kpiCells, `${fmtInt(grid.n)}`);
    setText(el.kpiRes, `${fmtInt(grid.groundStepM)} m`);
    setText(el.kpiTime, fmtDuration(elapsedMs));
    updateGridInfo();

    await renderSurface({ rebuildField: true });
    updateHitScore();
    succeeded = true;
  } catch (err) {
    console.error(err);
    toast(t('toast.computeFailed', { message: err.message }), 'error', 6000);
  } finally {
    btn.disabled = false;
    setStale(succeeded ? false : stale);
  }
}

/** Descrive la griglia effettivamente usata; senza risultato, la nota di default. */
function updateGridInfo() {
  const grid = current?.grid;
  setText(el.gridInfo, grid
    ? t('model.grid.active', {
        nx: grid.nx, ny: grid.ny, n: fmtInt(grid.n), step: fmtInt(grid.groundStepM),
      })
    : t('model.grid.hint'));
}

/** Ridisegna il raster dai risultati già calcolati. */
async function renderSurface({ rebuildField = false } = {}) {
  if (!current) return;
  const { settings } = store.state;
  const token = ++renderToken;

  if (rebuildField || current.scale !== settings.colorScale || !current.field) {
    current.field = settings.colorScale === 'linear' ? linearField(current.prob) : current.pct;
    current.scale = settings.colorScale;
  }

  const canvas = renderRaster(current.grid, current.field, {
    colormap: settings.colormap,
    opacity: settings.opacity,
    threshold: settings.threshold,
    contours: settings.contours,
  });

  const { url, revoke } = await canvasToUrl(canvas);
  if (token !== renderToken) { revoke?.(); return; }   // un ridisegno più recente ha vinto

  view.setSurface(url, current.grid.bounds, revoke);
  updateLegend();
}

const scheduleRerender = debounce(() => { renderSurface(); }, 120);

/**
 * Una superficie calcolata su dati o parametri ormai cambiati continuerebbe a
 * essere mostrata come se fosse valida. La marchiamo invece di cancellarla,
 * così il lavoro non va perso ma l'utente sa che va ricalcolata.
 */
let stale = false;

function setStale(value) {
  if (!current) value = false;
  stale = value;
  show(el.legendStale, value);
  el.btnRun.textContent = t(value ? 'model.rerun' : 'model.run');
  el.btnRun.classList.toggle('btn--attention', value);
}

function clearSurface() {
  current = null;
  renderToken++;
  view.clearSurface();
  setStale(false);
  show(el.legendCard, false);
  el.peaksList.replaceChildren();
  show(el.peaksEmpty, true);
  setText(el.kpiCells, '–');
  setText(el.kpiRes, '–');
  setText(el.kpiTime, '–');
  updateGridInfo();
  updateHitScore();
}

/* ═══════════════════════════ Legenda ═══════════════════════════ */

function updateLegend() {
  if (!current) { show(el.legendCard, false); return; }
  const { settings } = store.state;
  show(el.legendCard, true);

  drawLegendRamp(el.legendRamp, settings.colormap, {
    opacity: settings.opacity,
    threshold: settings.threshold,
    background: cssColorHex('--surface', '#0f1526'),
  });

  const percentile = settings.colorScale === 'percentile';
  setText(el.legendTitle, t(percentile ? 'legend.percentile' : 'legend.linear'));

  el.legendScale.replaceChildren();
  const labels = percentile
    ? ['0%', '50%', '100%']
    : ['0', t('legend.halfMax'), `${fmtNum(current.maxProb * 100, 4)}%`];
  for (const label of labels) {
    const s = document.createElement('span');
    s.textContent = label;
    el.legendScale.appendChild(s);
  }

  const contourNote = settings.contours
    ? t('legend.contourNote', { levels: CONTOUR_LEVELS.map((l) => fmtNum(l * 100, 0)).join(' · ') })
    : '';
  const scaleNote = t(percentile ? 'legend.notePercentile' : 'legend.noteLinear');
  setHtml(el.legendNotes, `${contourNote}${scaleNote}`);
}

on($('#btnLegendToggle'), 'click', (e) => {
  const collapsed = el.legendCard.dataset.collapsed === 'true';
  el.legendCard.dataset.collapsed = String(!collapsed);
  e.currentTarget.textContent = collapsed ? '–' : '+';
  e.currentTarget.setAttribute('aria-expanded', String(collapsed));
  e.currentTarget.setAttribute('aria-label', t(collapsed ? 'legend.collapse' : 'legend.expand'));
  // Il testo tradotto dipende dallo stato, non è più quello dell'attributo
  e.currentTarget.setAttribute('data-i18n-label', collapsed ? 'legend.collapse' : 'legend.expand');
});

/* ═══════════════════════════ Picchi ═══════════════════════════ */

function renderPeaks() {
  const peaks = current?.peaks || [];
  show(el.peaksEmpty, peaks.length === 0);
  el.peaksList.replaceChildren();

  for (const peak of peaks) {
    const li = document.createElement('li');
    li.tabIndex = 0;

    const rank = document.createElement('span');
    rank.className = 'k-rank';
    rank.textContent = String(peak.rank);

    const body = document.createElement('span');
    const coord = document.createElement('span');
    coord.className = 'k-coord';
    coord.textContent = fmtCoord(peak.lat, peak.lng);
    const intensity = current?.maxProb ? peak.prob / current.maxProb : 0;
    const meta = document.createElement('span');
    meta.className = 'k-meta';
    meta.textContent = t('res.peaks.intensity', { p: fmtNum(intensity * 100, 0) });
    body.append(coord, document.createElement('br'), meta);

    const pct = document.createElement('span');
    pct.className = 'k-pct';
    pct.title = t('res.peaks.topTitle');
    pct.textContent = t('res.peaks.top', { p: fmtNum((1 - peak.percentile) * 100, 2) });

    const go = () => view.flyTo(peak.lat, peak.lng, 14);
    on(li, 'click', go);
    on(li, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });

    li.append(rank, body, pct);
    el.peaksList.appendChild(li);
  }
}

/* ═══════════════════════════ Hit score ═══════════════════════════ */

function setAnchorMode(active) {
  el.btnSetAnchor.setAttribute('aria-pressed', String(active));
  el.btnSetAnchor.textContent = t(active ? 'res.hit.clickMap' : 'res.hit.setAnchor');
  view.setClickMode(active ? 'anchor' : (addMode ? 'add' : null));
}

function updateHitScore() {
  const { anchor } = store.state;
  view.setAnchor(anchor);
  show(el.btnClearAnchor, !!anchor);

  if (!anchor) { show(el.anchorResult, false); return; }

  setText(el.anchorCoord, fmtCoord(anchor.lat, anchor.lng));

  if (!current) {
    show(el.anchorResult, true);
    setText(el.hitScore, '–');
    setText(el.hitArea, t('res.hit.needSurface'));
    return;
  }

  const result = hitScore(current.grid, current.prob, anchor.lat, anchor.lng);
  show(el.anchorResult, true);

  if (!result) {
    setText(el.hitScore, t('res.hit.outOfGrid'));
    setText(el.hitArea, '–');
    return;
  }
  setText(el.hitScore, fmtPercent(result.score, 2));
  setText(el.hitArea, t('res.hit.areaOf', {
    search: fmtArea(result.searchAreaKm2), total: fmtArea(result.totalAreaKm2),
  }));
}

/* ═══════════════════════════ Modalità inserimento ═══════════════════════════ */

let addMode = false;

function setAddMode(active) {
  addMode = active;
  el.btnAddMode.setAttribute('aria-pressed', String(active));
  const anchoring = el.btnSetAnchor.getAttribute('aria-pressed') === 'true';
  view.setClickMode(anchoring ? 'anchor' : (active ? 'add' : null));
}

/* ═══════════════════════════ Binding dei controlli ═══════════════════════════ */

function syncFormFromState() {
  const { settings } = store.state;

  el.method.value = settings.method;
  el.distMetric.value = settings.distMetric;
  el.gridAuto.checked = settings.gridAuto;
  el.gridStep.value = settings.gridStep;
  el.gridStep.disabled = settings.gridAuto;

  for (const [method, fields] of Object.entries(PARAM_FIELDS)) {
    for (const [key, sel] of Object.entries(fields)) {
      const input = $(sel);
      if (input) input.value = settings.params[method][key];
    }
  }

  el.colormap.value = settings.colormap;
  el.colorScale.value = settings.colorScale;
  el.opacity.value = Math.round(settings.opacity * 100);
  el.threshold.value = Math.round(settings.threshold * 100);
  el.showContours.checked = settings.contours;
  el.basemap.value = settings.basemap;
  el.showLabels.checked = settings.showLabels;
  el.showCentro.checked = settings.showCentro;
  el.showEllipse.checked = settings.showEllipse;
  el.theme.value = settings.theme;
  syncLangControls(settings.lang);

  setText(el.opacityOut, `${Math.round(settings.opacity * 100)}%`);
  setText(el.thresholdOut, `${Math.round(settings.threshold * 100)}%`);

  updateMethodPanels();
  updateJourneyHalf();
}

function updateMethodPanels() {
  const active = store.state.settings.method;
  for (const key of Object.keys(METHODS)) {
    const panel = $(`#p-${key}`);
    if (panel) panel.hidden = key !== active;
  }
  setHtml(el.methodDesc, METHODS[active] ? methodDesc(active) : '');
}

// Il valore vive fuori dal testo tradotto (che applyI18n riscrive per intero):
// lo si cerca a ogni aggiornamento, così resta corretto qualunque cosa accada
// al nodo che lo ospita.
function updateJourneyHalf() {
  const lambda = store.state.settings.params.journey.lambda;
  setText($('#journeyHalf'), `${fmtNum(halfDistanceFromLambda(lambda), 2)} km`);
}

function bindControls() {
  on(el.method, 'change', () => {
    store.setSetting('method', el.method.value);
    updateMethodPanels();
    setStale(true);
  });

  for (const [method, fields] of Object.entries(PARAM_FIELDS)) {
    for (const [key, sel] of Object.entries(fields)) {
      const input = $(sel);
      on(input, 'change', () => {
        const value = Number(input.value);
        if (!Number.isFinite(value)) { input.value = store.state.settings.params[method][key]; return; }
        const min = Number(input.min);
        const safe = Number.isFinite(min) ? Math.max(min, value) : value;
        input.value = safe;
        store.setMethodParam(method, key, safe);
        if (method === 'journey') updateJourneyHalf();
        setStale(true);
      });
    }
  }

  on($('#btnAutoSigma'), 'click', () => {
    const { points, settings } = store.state;
    if (points.length < 2) { toast(t('toast.needTwoPoints'), 'error'); return; }

    const s = suggestBandwidth(points, getMetric(settings.distMetric));
    store.setMethodParam('kde', 'sigma', Number(s.silverman.toFixed(2)));
    $('#kdeSigma').value = s.silverman.toFixed(2);
    const alt = s.nearestNeighbor ? t('toast.sigmaAlt', { alt: fmtNum(s.nearestNeighbor, 2) }) : '';
    toast(`${t('toast.sigma', { sigma: fmtNum(s.silverman, 2) })}${alt}`, 'ok', 6000);
  });

  on(el.distMetric, 'change', () => {
    store.setSetting('distMetric', el.distMetric.value);
    renderStats();
    renderCentrographic();
    setStale(true);
  });

  on(el.gridAuto, 'change', () => {
    store.setSetting('gridAuto', el.gridAuto.checked);
    el.gridStep.disabled = el.gridAuto.checked;
    setStale(true);
  });
  on(el.gridStep, 'change', () => {
    const v = Math.max(25, Number(el.gridStep.value) || 300);
    el.gridStep.value = v;
    store.setSetting('gridStep', v);
    setStale(true);
  });

  on(el.btnRun, 'click', runAnalysis);
  on($('#btnClearSurface'), 'click', clearSurface);

  /* ── Vista: ridisegno immediato, nessun ricalcolo ── */
  on(el.colormap, 'change', () => { store.setSetting('colormap', el.colormap.value); scheduleRerender(); });
  on(el.colorScale, 'change', () => { store.setSetting('colorScale', el.colorScale.value); renderSurface({ rebuildField: true }); });
  on(el.showContours, 'change', () => { store.setSetting('contours', el.showContours.checked); scheduleRerender(); });

  on(el.opacity, 'input', () => {
    const v = Number(el.opacity.value) / 100;
    setText(el.opacityOut, `${el.opacity.value}%`);
    store.setSetting('opacity', v);
    scheduleRerender();
  });
  on(el.threshold, 'input', () => {
    const v = Number(el.threshold.value) / 100;
    setText(el.thresholdOut, `${el.threshold.value}%`);
    store.setSetting('threshold', v);
    scheduleRerender();
  });

  on(el.basemap, 'change', () => {
    store.setSetting('basemap', el.basemap.value);
    view.setBasemap(el.basemap.value);
  });
  on(el.showLabels, 'change', () => {
    store.setSetting('showLabels', el.showLabels.checked);
    view.renderPoints(store.state.points, { showLabels: el.showLabels.checked });
  });
  on(el.showCentro, 'change', () => { store.setSetting('showCentro', el.showCentro.checked); renderCentrographic(); });
  on(el.showEllipse, 'change', () => { store.setSetting('showEllipse', el.showEllipse.checked); renderCentrographic(); });
  on(el.theme, 'change', () => { store.setSetting('theme', el.theme.value); applyTheme(el.theme.value); });

  on(el.lang, 'change', () => {
    store.setSetting('lang', el.lang.value);
    applyLanguage(el.lang.value);
    toast(t('lang.changed'), 'ok');
  });
  for (const btn of $$('.langswitch__btn')) {
    on(btn, 'click', () => {
      if (btn.dataset.lang === getLang()) return;
      store.setSetting('lang', btn.dataset.lang);
      applyLanguage(btn.dataset.lang);
    });
  }

  /* ── Dati ── */
  on($('#btnLoadAll'), 'click', () => loadPreset('all'));
  on($('#btnLoadSW'), 'click', () => loadPreset('sw'));
  on($('#btnLoadN'), 'click', () => loadPreset('ne'));
  on($('#btnClearPoints'), 'click', () => {
    if (!store.state.points.length) return;
    store.clearPoints();
    toast(t('toast.pointsCleared'), 'info');
  });

  on(el.btnAddMode, 'click', () => setAddMode(el.btnAddMode.getAttribute('aria-pressed') !== 'true'));
  on(el.btnUndo, 'click', () => store.undo());
  on(el.btnRedo, 'click', () => store.redo());
  on(el.btnFit, 'click', () => view.fitPoints(store.state.points));

  on($('#btnAddCoord'), 'click', addFromCoordInput);
  on(el.coordInput, 'keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addFromCoordInput(); } });

  /* ── Ancoraggio ── */
  on(el.btnSetAnchor, 'click', () =>
    setAnchorMode(el.btnSetAnchor.getAttribute('aria-pressed') !== 'true'));
  on(el.btnClearAnchor, 'click', () => { store.setAnchor(null); toast(t('toast.anchorCleared'), 'info'); });

  /* ── Preset di parametri ── */
  for (const btn of $$('[data-apply]')) {
    on(btn, 'click', () => {
      const [presetKey, method] = btn.dataset.apply.split(':');
      const preset = PRESETS[presetKey];
      if (!preset || !preset[method]) return;
      store.setSetting('method', method);
      store.setMethodParams(method, preset[method]);
      syncFormFromState();
      toast(t('toast.presetApplied', { preset: presetName(presetKey), method: methodLabel(method) }), 'ok');
      tabs.select(1);
    });
  }

  /* ── Import / export ── */
  on($('#btnImport'), 'click', () => el.fileInput.click());
  on(el.fileInput, 'change', handleFileImport);
  on($('#btnExportCsv'), 'click', () => {
    if (!requirePoints()) return;
    downloadText(t('data.io.csvName'), toCsv(store.state.points), 'text/csv;charset=utf-8');
  });
  on($('#btnExportGeo'), 'click', () => {
    if (!requirePoints()) return;
    downloadText(t('data.io.geoName'),
      toGeoJson(store.state.points, { generator: 'Criminal Geoprofiler' }),
      'application/geo+json');
  });
  on($('#btnShare'), 'click', async () => {
    if (!requirePoints()) return;
    const url = encodeShareUrl(store.state.points, store.state.settings);
    const ok = await copyToClipboard(url);
    toast(t(ok ? 'toast.linkCopied' : 'toast.linkFailed'), ok ? 'ok' : 'error');
  });

  on($('#btnResetAll'), 'click', () => {
    if (!confirm(t('confirm.resetAll'))) return;
    clearSurface();
    store.resetAll();
    applyLanguage(store.state.settings.lang);
    applyTheme(store.state.settings.theme);
    view.setBasemap(store.state.settings.basemap);
    toast(t('toast.settingsReset'), 'ok');
  });
}

function requirePoints() {
  if (store.state.points.length) return true;
  toast(t('toast.nothingToExport'), 'error');
  return false;
}

function loadPreset(key) {
  const points = loadDataset(key);
  store.setPoints(points);
  view.fitPoints(points);
  toast(t('toast.loaded', { n: points.length }), 'ok');
  if (isMobile()) closeSidebar();
}

function addFromCoordInput() {
  const parsed = parseLatLng(el.coordInput.value);
  if (!parsed) {
    toast(t('toast.badCoord'), 'error', 5000);
    el.coordInput.focus();
    return;
  }
  store.addPoint({ ...parsed, label: '' });
  el.coordInput.value = '';
  view.flyTo(parsed.lat, parsed.lng);
}

async function handleFileImport(e) {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;

  try {
    const text = await file.text();
    const isJson = /\.(json|geojson)$/i.test(file.name) || text.trimStart().startsWith('{');
    const { points, skipped } = isJson ? parseGeoJson(text) : parseCsv(text);

    if (!points.length) {
      toast(t('toast.noValidPoints'), 'error', 5000);
      return;
    }
    store.setPoints(points);
    view.fitPoints(points);
    toast(
      skipped
        ? t('toast.importedSkipped', { n: points.length, skipped })
        : t('toast.imported', { n: points.length }),
      'ok', 5000,
    );
  } catch (err) {
    console.error(err);
    toast(t('toast.fileUnreadable', { message: err.message }), 'error', 6000);
  }
}

/* ═══════════════════════════ Tutorial ═══════════════════════════ */

// Il tutorial si presenta una sola volta: chiuderlo equivale a dire «visto».
// Resta raggiungibile dalla scheda Info, quindi non serve una spunta apposita.
const tutorial = createModal($('#tutorialModal'), {
  onClose: () => store.setSetting('tutorialSeen', true),
});
on($('#btnCloseTutorial'), 'click', () => tutorial.close());
on($('#btnStart'), 'click', () => tutorial.close());
on($('#btnOpenTutorial'), 'click', () => tutorial.open());

/* ═══════════════════════════ Scorciatoie ═══════════════════════════ */

on(window, 'keydown', (e) => {
  if (e.key === 'Escape') {
    if (el.btnSetAnchor.getAttribute('aria-pressed') === 'true') { setAnchorMode(false); return; }
    if (addMode) { setAddMode(false); return; }
  }

  // Non intercettare la digitazione né l'attivazione di un elemento interattivo
  // già a fuoco: Invio su un pulsante deve premere quel pulsante, non altro.
  const tag = e.target.tagName;
  if (/^(INPUT|SELECT|TEXTAREA|BUTTON|A|SUMMARY)$/.test(tag) || e.target.isContentEditable) return;
  if (!$('#tutorialModal').hidden) return;

  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();

  if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); store.undo(); }
  else if (mod && (key === 'y' || (key === 'z' && e.shiftKey))) { e.preventDefault(); store.redo(); }
  else if (mod) return;
  else if (e.key === 'Enter') { e.preventDefault(); runAnalysis(); }
  else if (key === 'a') { setAddMode(!addMode); }
  else if (key === 'f') { view.fitPoints(store.state.points); }
});

/* ═══════════════════════════ Reazione allo stato ═══════════════════════════ */

store.subscribe((state, changed) => {
  if (changed === 'points' || changed === 'all') {
    renderPointsList();
    view.renderPoints(state.points, { showLabels: state.settings.showLabels });
    renderStats();
    renderCentrographic();
    updateHitScore();
    setStale(true);
  }
  if (changed === 'anchor') updateHitScore();
});

/* ═══════════════════════════ Inizializzazione ═══════════════════════════ */

function boot() {
  // `?lang=` (o `#…&lang=`) ha la precedenza e diventa la preferenza salvata:
  // un link condiviso in inglese deve restare in inglese anche dopo il reload.
  const forced = langFromUrl();
  if (forced) store.setSetting('lang', forced);

  setLang(resolveLang(store.state.settings.lang));
  applyI18n();
  store.relabelPoints(relocalizeLabel);

  applyTheme(store.state.settings.theme);
  view.setBasemap(store.state.settings.basemap);
  syncFormFromState();
  bindControls();

  // Stato condiviso via URL: ha la precedenza su quanto salvato in locale
  const shared = decodeShareUrl();
  if (shared) {
    store.setPoints(shared.points, { history: false });
    if (shared.method && METHODS[shared.method]) store.setSetting('method', shared.method);
    if (shared.distMetric) store.setSetting('distMetric', shared.distMetric);
    if (shared.methodParams) {
      const target = shared.method || store.state.settings.method;
      const allowed = Object.keys(store.state.settings.params[target] || {});
      const patch = {};
      for (const k of allowed) if (k in shared.methodParams) patch[k] = shared.methodParams[k];
      if (Object.keys(patch).length) store.setMethodParams(target, patch);
    }
    syncFormFromState();
    toast(t('toast.sharedLoaded', { n: shared.points.length }), 'ok', 5000);
  }

  renderPointsList();
  view.renderPoints(store.state.points, { showLabels: store.state.settings.showLabels });
  renderStats();
  renderCentrographic();
  updateHitScore();

  if (store.state.points.length) view.fitPoints(store.state.points, { animate: false });

  if (!store.state.settings.tutorialSeen) tutorial.open();

  view.invalidate();
}

boot();
