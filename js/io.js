/**
 * io.js - import/export dei punti-evento e condivisione via URL.
 * Tutto in locale: nessun dato lascia il browser.
 */

/* ─────────────────────────── Parsing coordinate ─────────────────────────── */

/**
 * Interpreta una stringa «lat, lon» tollerando separatori e virgole decimali.
 * Accetta: «43.79, 11.08» · «43,79 11,08» · «43.79; 11.08» · «43.79 11.08».
 * @returns {{lat:number,lng:number}|null}
 */
export function parseLatLng(raw) {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;

  // Virgola decimale italiana: «43,794 11,082» oppure «43,794; 11,082»
  if (/^-?\d+,\d+\s*[;\s]\s*-?\d+,\d+$/.test(s)) s = s.replace(/,/g, '.');

  const nums = s.split(/[;,\s]+/).map((t) => Number(t.replace(',', '.'))).filter((v) => Number.isFinite(v));
  if (nums.length < 2) return null;

  const [lat, lng] = nums;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

/* ─────────────────────────── CSV ─────────────────────────── */

function splitCsvLine(line) {
  const out = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ',' || ch === ';' || ch === '\t') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

const LAT_KEYS = ['lat', 'latitude', 'latitudine', 'y'];
const LNG_KEYS = ['lon', 'lng', 'long', 'longitude', 'longitudine', 'x'];
const LABEL_KEYS = ['label', 'name', 'nome', 'etichetta', 'luogo', 'place', 'descrizione'];
const DATE_KEYS = ['date', 'data', 'datetime'];

/**
 * Importa punti da CSV. Riconosce l'intestazione per nome di colonna; in
 * assenza di intestazione riconoscibile assume l'ordine `lat, lon, label`.
 * @returns {{points:Array, skipped:number}}
 */
export function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length);
  if (!lines.length) return { points: [], skipped: 0 };

  const first = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const iLat = first.findIndex((h) => LAT_KEYS.includes(h));
  const iLng = first.findIndex((h) => LNG_KEYS.includes(h));
  const hasHeader = iLat >= 0 && iLng >= 0;

  const iLabel = hasHeader ? first.findIndex((h) => LABEL_KEYS.includes(h)) : 2;
  const iDate = hasHeader ? first.findIndex((h) => DATE_KEYS.includes(h)) : -1;

  const latCol = hasHeader ? iLat : 0;
  const lngCol = hasHeader ? iLng : 1;

  const points = [];
  let skipped = 0;

  for (let r = hasHeader ? 1 : 0; r < lines.length; r++) {
    const cells = splitCsvLine(lines[r]);
    const lat = Number(String(cells[latCol] ?? '').replace(',', '.'));
    const lng = Number(String(cells[lngCol] ?? '').replace(',', '.'));
    if (!Number.isFinite(lat) || !Number.isFinite(lng) ||
        lat < -90 || lat > 90 || lng < -180 || lng > 180) { skipped++; continue; }

    points.push({
      lat, lng,
      label: (iLabel >= 0 ? cells[iLabel] : '') || '',
      date: (iDate >= 0 ? cells[iDate] : '') || '',
    });
  }
  return { points, skipped };
}

export function toCsv(points) {
  const esc = (v) => {
    const s = String(v ?? '');
    return /[",;\t\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['lat', 'lon', 'label', 'date'].join(',')];
  for (const p of points) {
    rows.push([p.lat.toFixed(6), p.lng.toFixed(6), esc(p.label), esc(p.date)].join(','));
  }
  return rows.join('\n');
}

/* ─────────────────────────── GeoJSON ─────────────────────────── */

/** @returns {{points:Array, skipped:number}} */
export function parseGeoJson(text) {
  const data = JSON.parse(text);
  const features = data.type === 'FeatureCollection' ? (data.features || [])
    : data.type === 'Feature' ? [data]
    : [];

  const points = [];
  let skipped = 0;

  for (const f of features) {
    const g = f && f.geometry;
    if (!g || g.type !== 'Point' || !Array.isArray(g.coordinates)) { skipped++; continue; }
    const [lng, lat] = g.coordinates;
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) { skipped++; continue; }
    const props = f.properties || {};
    points.push({
      lat, lng,
      label: props.label || props.name || props.nome || '',
      date: props.date || props.data || '',
    });
  }
  return { points, skipped };
}

export function toGeoJson(points, meta = {}) {
  return JSON.stringify({
    type: 'FeatureCollection',
    ...(Object.keys(meta).length ? { properties: meta } : {}),
    features: points.map((p, i) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [Number(p.lng.toFixed(6)), Number(p.lat.toFixed(6))] },
      properties: { id: i + 1, label: p.label || '', date: p.date || '' },
    })),
  }, null, 2);
}

/* ─────────────────────────── Download ─────────────────────────── */

export function downloadText(filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ─────────────────────────── Condivisione via URL ─────────────────────────── */

// `_` e `~` sono caratteri "unreserved": encodeURIComponent non li tocca, quindi
// li codifichiamo a mano per non confonderli con i separatori.
const encField = (s) => encodeURIComponent(String(s ?? '')).replace(/_/g, '%5F').replace(/~/g, '%7E');
const decField = (s) => { try { return decodeURIComponent(s); } catch { return s; } };

export function encodeShareUrl(points, settings) {
  const p = points
    .map((pt) => `${pt.lat.toFixed(5)}_${pt.lng.toFixed(5)}_${encField(pt.label)}`)
    .join('~');

  const params = new URLSearchParams();
  if (p) params.set('p', p);
  if (settings?.method) params.set('m', settings.method);
  if (settings?.distMetric) params.set('d', settings.distMetric);

  const mp = settings?.params?.[settings.method];
  if (mp) for (const [k, v] of Object.entries(mp)) params.set(k, String(v));

  const base = `${location.origin}${location.pathname}`;
  return `${base}#${params.toString()}`;
}

/** Legge lo stato condiviso dall'hash dell'URL. @returns {object|null} */
export function decodeShareUrl(hash = location.hash) {
  const raw = hash.replace(/^#/, '');
  if (!raw) return null;

  const params = new URLSearchParams(raw);
  const p = params.get('p');
  if (!p) return null;

  const points = [];
  for (const rec of p.split('~')) {
    const [latS, lngS, labelS] = rec.split('_');
    const lat = Number(latS), lng = Number(lngS);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) continue;
    points.push({ lat, lng, label: decField(labelS || '') });
  }
  if (!points.length) return null;

  const out = { points };
  const method = params.get('m');
  if (method) out.method = method;
  const metric = params.get('d');
  if (metric) out.distMetric = metric;

  const numeric = {};
  for (const key of ['B', 'f', 'g', 'sigma', 'scale', 'lambda']) {
    const v = Number(params.get(key));
    if (Number.isFinite(v)) numeric[key] = v;
  }
  if (Object.keys(numeric).length) out.methodParams = numeric;

  return out;
}

export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback per contesti non sicuri (http://) o permessi negati
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}
