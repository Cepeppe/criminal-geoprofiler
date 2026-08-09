/**
 * mapview.js - tutto ciò che tocca Leaflet.
 *
 * Isola la libreria cartografica dal resto dell'applicazione: i moduli di
 * calcolo (`geo`, `models`, `surface`) non conoscono Leaflet e restano
 * verificabili in isolamento.
 */

import { BASEMAPS } from './data.js';
import { ellipseRing } from './geo.js';
import { fmtCoord } from './dom.js';

const FLORENCE = [43.79, 11.25];

export function createMapView(containerId, {
  onMapClick,
  onRemovePoint,
  onPointHover,
} = {}) {
  const map = L.map(containerId, {
    zoomControl: false,
    attributionControl: true,
    preferCanvas: true,
    worldCopyJump: false,
  }).setView(FLORENCE, 11);

  L.control.zoom({ position: 'topright' }).addTo(map);
  L.control.scale({ imperial: false, position: 'bottomleft', maxWidth: 140 }).addTo(map);

  // Ordine di sovrapposizione: base (200) → superficie (350) → etichette (360)
  // → vettori (400) → marker (600). Le etichette della cartografia restano
  // leggibili anche sotto una superficie opaca.
  map.createPane('surfacePane');
  const surfacePane = map.getPane('surfacePane');
  surfacePane.style.zIndex = '350';
  surfacePane.style.pointerEvents = 'none';

  map.createPane('labelsPane');
  const labelsPane = map.getPane('labelsPane');
  labelsPane.style.zIndex = '360';
  labelsPane.style.pointerEvents = 'none';

  let baseLayer = null;
  let labelsLayer = null;
  let surfaceLayer = null;
  let revokeSurface = null;
  let clickMode = null;

  const markers = [];
  const centroLayer = L.layerGroup().addTo(map);
  let anchorMarker = null;

  map.on('click', (e) => {
    if (!clickMode) return;
    onMapClick?.({ lat: e.latlng.lat, lng: e.latlng.lng }, clickMode);
  });

  /* ─────────────────────── Mappa di base ─────────────────────── */

  function setBasemap(key) {
    const def = BASEMAPS[key] || BASEMAPS.dark;

    if (baseLayer) { map.removeLayer(baseLayer); baseLayer = null; }
    if (labelsLayer) { map.removeLayer(labelsLayer); labelsLayer = null; }

    // Niente `detectRetina`: l'URL contiene già il segnaposto {r}, che Leaflet
    // risolve in «@2x» sui display ad alta densità. Attivarli entrambi
    // richiederebbe tile a zoom+1 *e* a doppia risoluzione.
    baseLayer = L.tileLayer(def.url, def.options).addTo(map);
    baseLayer.setZIndex(0);

    if (def.labelsUrl) {
      // L'alone (in CSS) va scelto in base al colore dei glifi della tile,
      // non al tema dell'interfaccia: «dark_only_labels» ha testo chiaro.
      labelsPane.dataset.ink = key === 'light' ? 'dark' : 'light';
      labelsLayer = L.tileLayer(def.labelsUrl, { ...def.options, pane: 'labelsPane' }).addTo(map);
    }
  }

  /* ─────────────────────── Punti-evento ─────────────────────── */

  function clearMarkers() {
    for (const m of markers) map.removeLayer(m);
    markers.length = 0;
  }

  function renderPoints(points, { showLabels = false } = {}) {
    clearMarkers();

    points.forEach((p, i) => {
      const marker = L.marker([p.lat, p.lng], {
        icon: L.divIcon({
          className: 'evt-marker',
          html: String(i + 1),
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        }),
        keyboard: true,
        title: p.label || fmtCoord(p.lat, p.lng),
        riseOnHover: true,
      }).addTo(map);

      const labelText = p.label || fmtCoord(p.lat, p.lng);
      marker.bindTooltip(labelText, {
        permanent: showLabels,
        direction: 'top',
        offset: [0, -15],
        className: 'evt-label',
        opacity: 1,
      });

      marker.bindPopup(() => buildPopup(p, i));
      marker.on('mouseover', () => onPointHover?.(i, true));
      marker.on('mouseout', () => onPointHover?.(i, false));

      markers.push(marker);
    });
  }

  function buildPopup(point, index) {
    const wrap = document.createElement('div');

    const title = document.createElement('div');
    title.className = 'popup-title';
    title.textContent = point.label || `Punto ${index + 1}`;
    wrap.appendChild(title);

    const coord = document.createElement('div');
    coord.className = 'popup-coord';
    coord.textContent = fmtCoord(point.lat, point.lng);
    wrap.appendChild(coord);

    const actions = document.createElement('div');
    actions.className = 'popup-actions';
    const del = document.createElement('button');
    del.className = 'btn btn--compact btn--danger';
    del.textContent = 'Rimuovi punto';
    del.addEventListener('click', () => { map.closePopup(); onRemovePoint?.(index); });
    actions.appendChild(del);
    wrap.appendChild(actions);

    return wrap;
  }

  function highlightPoint(index, active) {
    const marker = markers[index];
    if (!marker) return;
    const el = marker.getElement();
    if (el) el.classList.toggle('evt-marker--hover', !!active);
  }

  /* ─────────────────────── Ancoraggio ─────────────────────── */

  function setAnchor(anchor) {
    if (anchorMarker) { map.removeLayer(anchorMarker); anchorMarker = null; }
    if (!anchor) return;

    anchorMarker = L.marker([anchor.lat, anchor.lng], {
      icon: L.divIcon({ className: 'anchor-marker', html: '⌂', iconSize: [30, 30], iconAnchor: [15, 15] }),
      title: 'Ipotesi di ancoraggio',
      zIndexOffset: 500,
    }).addTo(map);
    anchorMarker.bindTooltip('Ipotesi di ancoraggio', { direction: 'top', offset: [0, -17], className: 'evt-label' });
  }

  /* ─────────────────── Indicatori centrografici ─────────────────── */

  function renderCentrographic({ centroid, median, ellipse, show = true, showEllipse = false } = {}) {
    centroLayer.clearLayers();
    if (!show && !showEllipse) return;

    if (showEllipse && ellipse) {
      const ring = ellipseRing(ellipse);
      if (ring.length) {
        L.polygon(ring, {
          color: '#a78bfa', weight: 1.5, opacity: .75,
          fillColor: '#a78bfa', fillOpacity: .06, dashArray: '5 4',
          interactive: false,
        }).addTo(centroLayer);
      }
    }

    if (!show) return;

    if (centroid) {
      L.marker([centroid.lat, centroid.lng], {
        icon: L.divIcon({ className: 'centro-marker', html: '', iconSize: [16, 16], iconAnchor: [8, 8] }),
        interactive: true,
      }).bindTooltip('Baricentro', { direction: 'top', offset: [0, -10], className: 'evt-label' })
        .addTo(centroLayer);
    }
    if (median) {
      L.marker([median.lat, median.lng], {
        icon: L.divIcon({ className: 'centro-marker centro-marker--median', html: '', iconSize: [16, 16], iconAnchor: [8, 8] }),
        interactive: true,
      }).bindTooltip('Mediana geometrica', { direction: 'top', offset: [0, -10], className: 'evt-label' })
        .addTo(centroLayer);
    }
  }

  /* ─────────────────────── Superficie ─────────────────────── */

  function setSurface(url, bounds, revoke) {
    clearSurface();
    surfaceLayer = L.imageOverlay(
      url,
      [[bounds.south, bounds.west], [bounds.north, bounds.east]],
      { pane: 'surfacePane', interactive: false, className: 'surface-overlay' },
    ).addTo(map);
    revokeSurface = revoke || null;
  }

  function clearSurface() {
    if (surfaceLayer) { map.removeLayer(surfaceLayer); surfaceLayer = null; }
    if (revokeSurface) { revokeSurface(); revokeSurface = null; }
  }

  const hasSurface = () => !!surfaceLayer;

  /* ─────────────────────── Inquadratura ─────────────────────── */

  function fitPoints(points, { animate = true } = {}) {
    if (!points.length) return;
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], Math.max(map.getZoom(), 13), { animate });
      return;
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]));
    map.fitBounds(bounds, { padding: [56, 56], animate, maxZoom: 15 });
  }

  function flyTo(lat, lng, zoom) {
    map.flyTo([lat, lng], zoom ?? Math.max(map.getZoom(), 14), { duration: .7 });
  }

  /* ─────────────────────── Modalità di clic ─────────────────────── */

  function setClickMode(mode) {
    clickMode = mode;
    const body = document.body;
    body.classList.toggle('map-adding', mode === 'add');
    body.classList.toggle('map-anchoring', mode === 'anchor');
  }

  return {
    map,
    setBasemap,
    renderPoints,
    highlightPoint,
    setAnchor,
    renderCentrographic,
    setSurface,
    clearSurface,
    hasSurface,
    fitPoints,
    flyTo,
    setClickMode,
    invalidate: (opts) => map.invalidateSize(opts ?? { animate: false }),
  };
}
