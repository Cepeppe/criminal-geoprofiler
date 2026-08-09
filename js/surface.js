/**
 * surface.js - resa grafica della superficie di probabilità.
 *
 * Perché un raster e non una heatmap di punti: `leaflet.heat` (usato dalla
 * versione precedente) è progettato per nuvole di punti sparsi e **accumula**
 * i contributi che si sovrappongono entro il raggio del kernel. Dandogli una
 * griglia regolare fitta, ogni cella somma quelle vicine e il risultato satura
 * o svanisce a seconda del raggio scelto - da cui la necessità di «alzare il
 * raggio a 50 e ricalcolare». Una griglia va invece resa come raster, con una
 * corrispondenza diretta valore → colore. Il parametro «raggio» sparisce e la
 * superficie diventa deterministica.
 */

/* ─────────────────────────── Scale cromatiche ─────────────────────────── */

/** Tutte monotone in luminosità: leggibili anche in scala di grigi e con CVD. */
const RAMPS = {
  viridis: ['#440154', '#46327e', '#365c8d', '#277f8e', '#1fa187', '#4ac16d', '#9fda3a', '#fde725'],
  inferno: ['#000004', '#1f0c48', '#550f6d', '#88226a', '#ba3655', '#e35933', '#f98c0a', '#fcffa4'],
  magma:   ['#000004', '#1c1044', '#4f127b', '#812581', '#b5367a', '#e55964', '#fb8761', '#fbfdbf'],
  cividis: ['#00204d', '#00336f', '#39486b', '#575d6d', '#707173', '#8a8678', '#a59c74', '#c3b369', '#e1cc55', '#fee838'],
  ice:     ['#06182f', '#0a2b52', '#0d4076', '#12579b', '#2273bd', '#4a92d6', '#79b1e6', '#a9cff2', '#d9ecfb'],
};

export const COLORMAP_NAMES = Object.keys(RAMPS);

const hexToRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

/** Precalcola una LUT a 256 voci: evita l'interpolazione per ogni pixel. */
function buildLut(name) {
  const stops = (RAMPS[name] || RAMPS.viridis).map(hexToRgb);
  const lut = new Uint8ClampedArray(256 * 3);
  const segs = stops.length - 1;
  for (let i = 0; i < 256; i++) {
    const t = (i / 255) * segs;
    const k = Math.min(segs - 1, Math.floor(t));
    const f = t - k;
    const a = stops[k], b = stops[k + 1];
    lut[i * 3] = a[0] + (b[0] - a[0]) * f;
    lut[i * 3 + 1] = a[1] + (b[1] - a[1]) * f;
    lut[i * 3 + 2] = a[2] + (b[2] - a[2]) * f;
  }
  return lut;
}

const lutCache = new Map();
const getLut = (name) => {
  if (!lutCache.has(name)) lutCache.set(name, buildLut(name));
  return lutCache.get(name);
};

/* ─────────────────────────── Rampa di opacità ─────────────────────────── */

/**
 * Rampa di opacità.
 *
 * Con la mappatura per percentile il campo è uniformemente distribuito in
 * [0,1]: una soglia di piena opacità al 70° percentile renderebbe opaco il
 * 30 % della mappa, seppellendo la cartografia. Un geoprofilo è interessante
 * nel suo **quarto superiore**, quindi la metà inferiore resta del tutto
 * invisibile e l'opacità sale ripida solo nell'ultimo quarto.
 *
 * Conseguenza voluta: sotto ALPHA_LO si vede solo la mappa; il nucleo ad alta
 * probabilità emerge come una macchia compatta invece che come una coltre.
 */
export const ALPHA_LO = 0.50;
export const ALPHA_HI = 0.95;

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export const alphaRamp = (t) => smoothstep(ALPHA_LO, ALPHA_HI, t);

/* ─────────────────────── Trasformazioni del campo ─────────────────────── */

/**
 * Rango percentile di ogni cella, in [0,1]. Il valore 0,95 significa
 * «questa cella è più probabile del 95 % dell'area di studio»: le isolinee
 * diventano quindi frazioni d'area esatte e la superficie resta leggibile
 * qualunque sia l'intervallo dinamico del modello.
 */
export function percentileField(prob) {
  const n = prob.length;
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) order[i] = i;
  order.sort((a, b) => prob[a] - prob[b]);

  const pct = new Float32Array(n);
  const inv = n > 1 ? 1 / (n - 1) : 0;
  for (let r = 0; r < n; r++) pct[order[r]] = r * inv;
  return pct;
}

/** Normalizzazione min-max lineare sulla probabilità. */
export function linearField(prob) {
  const n = prob.length;
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < n; i++) {
    const v = prob[i];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  const span = max - min || 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (prob[i] - min) / span;
  return out;
}

export const buildField = (prob, scale) =>
  scale === 'linear' ? linearField(prob) : percentileField(prob);

/* ─────────────────────────── Marching squares ─────────────────────────── */

/**
 * Estrae le isolinee del campo a un livello dato. Opera sul reticolo dei
 * centri-cella e restituisce segmenti in coordinate di griglia continue.
 */
export function marchingSquares(field, nx, ny, level) {
  const segs = [];
  const at = (i, j) => field[j * nx + i];
  const lerp = (va, vb) => {
    const d = vb - va;
    return Math.abs(d) < 1e-12 ? 0.5 : Math.min(1, Math.max(0, (level - va) / d));
  };

  for (let j = 0; j < ny - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = at(i, j), b = at(i + 1, j), c = at(i + 1, j + 1), d = at(i, j + 1);
      let idx = 0;
      if (a >= level) idx |= 8;   // alto-sinistra
      if (b >= level) idx |= 4;   // alto-destra
      if (c >= level) idx |= 2;   // basso-destra
      if (d >= level) idx |= 1;   // basso-sinistra
      if (idx === 0 || idx === 15) continue;

      const top    = () => [i + lerp(a, b), j];
      const right  = () => [i + 1, j + lerp(b, c)];
      const bottom = () => [i + lerp(d, c), j + 1];
      const left   = () => [i, j + lerp(a, d)];

      switch (idx) {
        case 1:  case 14: segs.push(left(), bottom()); break;
        case 2:  case 13: segs.push(bottom(), right()); break;
        case 3:  case 12: segs.push(left(), right()); break;
        case 4:  case 11: segs.push(top(), right()); break;
        case 6:  case 9:  segs.push(top(), bottom()); break;
        case 7:  case 8:  segs.push(top(), left()); break;
        case 5:  segs.push(top(), left(), bottom(), right()); break;   // sella
        case 10: segs.push(top(), right(), left(), bottom()); break;   // sella
      }
    }
  }
  return segs;   // coppie consecutive = un segmento
}

/* ─────────────────────────── Raster ─────────────────────────── */

export const CONTOUR_LEVELS = [0.5, 0.75, 0.9, 0.95, 0.99];

/**
 * Disegna la superficie su un canvas, ricampionata bilinearmente a risoluzione
 * superiore a quella della griglia: elimina l'effetto «scacchiera» senza
 * inventare informazione, perché l'interpolazione è lineare fra celle adiacenti.
 *
 * @returns {HTMLCanvasElement}
 */
export function renderRaster(grid, field, {
  colormap = 'viridis',
  opacity = 0.85,
  threshold = 0,
  contours = true,
  targetPx = 1200,
} = {}) {
  const { nx, ny } = grid;
  const scale = Math.max(1, Math.min(16, Math.round(targetPx / Math.max(nx, ny))));
  const W = nx * scale;
  const H = ny * scale;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  const lut = getLut(colormap);
  const img = ctx.createImageData(W, H);
  const px = img.data;
  const invScale = 1 / scale;

  for (let y = 0; y < H; y++) {
    const gy = (y + 0.5) * invScale - 0.5;
    const j0 = Math.max(0, Math.min(ny - 1, Math.floor(gy)));
    const j1 = Math.min(ny - 1, j0 + 1);
    const fy = Math.min(1, Math.max(0, gy - j0));
    const rowA = j0 * nx;
    const rowB = j1 * nx;

    for (let x = 0; x < W; x++) {
      const gx = (x + 0.5) * invScale - 0.5;
      const i0 = Math.max(0, Math.min(nx - 1, Math.floor(gx)));
      const i1 = Math.min(nx - 1, i0 + 1);
      const fx = Math.min(1, Math.max(0, gx - i0));

      const v =
        field[rowA + i0] * (1 - fx) * (1 - fy) +
        field[rowA + i1] * fx * (1 - fy) +
        field[rowB + i0] * (1 - fx) * fy +
        field[rowB + i1] * fx * fy;

      const o = (y * W + x) << 2;
      if (v < threshold) { px[o + 3] = 0; continue; }

      const c = Math.max(0, Math.min(255, (v * 255) | 0)) * 3;
      px[o]     = lut[c];
      px[o + 1] = lut[c + 1];
      px[o + 2] = lut[c + 2];
      px[o + 3] = (alphaRamp(v) * opacity * 255) | 0;
    }
  }
  ctx.putImageData(img, 0, 0);

  if (contours) drawContours(ctx, grid, field, scale, threshold, colormap);
  return canvas;
}

function drawContours(ctx, grid, field, scale, threshold, colormap) {
  const { nx, ny } = grid;
  const lut = getLut(colormap);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const level of CONTOUR_LEVELS) {
    if (level < threshold) continue;
    const segs = marchingSquares(field, nx, ny, level);
    if (!segs.length) continue;

    // I livelli più alti sono più marcati: guidano l'occhio verso il nucleo
    const emphasis = (level - CONTOUR_LEVELS[0]) / (1 - CONTOUR_LEVELS[0]);

    // Il tratto si adatta alla luminosità della scala a quel livello: bianco
    // sui toni scuri, scuro sui toni chiari. Una linea bianca fissa sparisce
    // sul giallo del nucleo, che è proprio dove serve di più.
    const c = Math.max(0, Math.min(255, (level * 255) | 0)) * 3;
    const lum = (0.2126 * lut[c] + 0.7152 * lut[c + 1] + 0.0722 * lut[c + 2]) / 255;
    const ink = lum > 0.55 ? '18,14,4' : '255,255,255';

    // Sotto ALPHA_LO la superficie è invisibile: l'isolinea deve esserlo quasi
    const surfaceAlpha = alphaRamp(level);
    ctx.lineWidth = Math.max(0.8, scale / 6) * (0.8 + emphasis * 0.9);
    ctx.strokeStyle = `rgba(${ink},${(0.25 + 0.45 * emphasis) * (0.35 + 0.65 * surfaceAlpha)})`;

    ctx.beginPath();
    for (let k = 0; k < segs.length; k += 2) {
      const [ax, ay] = segs[k];
      const [bx, by] = segs[k + 1];
      ctx.moveTo((ax + 0.5) * scale, (ay + 0.5) * scale);
      ctx.lineTo((bx + 0.5) * scale, (by + 0.5) * scale);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Converte un canvas in URL utilizzabile da L.imageOverlay. */
export function canvasToUrl(canvas) {
  return new Promise((resolve) => {
    if (!canvas.toBlob) { resolve({ url: canvas.toDataURL('image/png'), revoke: null }); return; }
    canvas.toBlob((blob) => {
      if (!blob) { resolve({ url: canvas.toDataURL('image/png'), revoke: null }); return; }
      const url = URL.createObjectURL(blob);
      resolve({ url, revoke: () => URL.revokeObjectURL(url) });
    }, 'image/png');
  });
}

/* ─────────────────────────── Legenda ─────────────────────────── */

/**
 * Disegna la rampa di legenda applicando la stessa curva di opacità della
 * mappa, composta sul colore di sfondo passato: così la legenda mostra
 * esattamente i colori che l'utente vede sulla cartografia.
 */
export function drawLegendRamp(canvas, colormap, { opacity = 0.85, threshold = 0, background = '#0f1526' } = {}) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const lut = getLut(colormap);
  const [br, bg, bb] = hexToRgb(background.startsWith('#') ? background : '#0f1526');

  const img = ctx.createImageData(W, H);
  for (let x = 0; x < W; x++) {
    const t = W > 1 ? x / (W - 1) : 0;
    const c = Math.max(0, Math.min(255, (t * 255) | 0)) * 3;
    const a = t < threshold ? 0 : alphaRamp(t) * opacity;
    const r = lut[c] * a + br * (1 - a);
    const g = lut[c + 1] * a + bg * (1 - a);
    const b = lut[c + 2] * a + bb * (1 - a);
    for (let y = 0; y < H; y++) {
      const o = (y * W + x) << 2;
      img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/* ─────────────────────────── Analisi ─────────────────────────── */

/**
 * Massimi locali della superficie, con soppressione dei non-massimi entro un
 * raggio minimo: sono le aree da esaminare per prime, cioè l'output operativo
 * di un geoprofilo.
 */
export function findPeaks(grid, prob, pct, { count = 5, minSeparationCells } = {}) {
  const { nx, ny } = grid;
  const sep = minSeparationCells ?? Math.max(3, Math.round(Math.min(nx, ny) / 12));
  const candidates = [];

  for (let j = 1; j < ny - 1; j++) {
    for (let i = 1; i < nx - 1; i++) {
      const idx = j * nx + i;
      const v = prob[idx];
      let isMax = true, strictlyGreater = false;
      for (let dj = -1; dj <= 1 && isMax; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          const nv = prob[(j + dj) * nx + (i + di)];
          if (nv > v) { isMax = false; break; }
          if (nv < v) strictlyGreater = true;
        }
      }
      if (isMax && strictlyGreater) candidates.push({ idx, i, j, v });
    }
  }

  candidates.sort((a, b) => b.v - a.v);

  const picked = [];
  for (const c of candidates) {
    if (picked.length >= count) break;
    if (picked.some((p) => Math.hypot(p.i - c.i, p.j - c.j) < sep)) continue;
    picked.push(c);
  }

  return picked.map((p, rank) => ({
    rank: rank + 1,
    lat: grid.lat[p.idx],
    lng: grid.lng[p.idx],
    prob: p.v,
    percentile: pct[p.idx],
  }));
}

/**
 * Hit score: frazione dell'area di studio da perlustrare, seguendo l'ordine di
 * probabilità decrescente, prima di raggiungere il punto indicato. È la metrica
 * standard di valutazione di un geoprofilo - più bassa, più il profilo è utile.
 */
export function hitScore(grid, prob, lat, lng) {
  const idx = grid.indexAt(lat, lng);
  if (idx < 0) return null;

  const target = prob[idx];
  let atOrAbove = 0;
  for (let i = 0; i < prob.length; i++) if (prob[i] >= target) atOrAbove++;

  const score = atOrAbove / prob.length;
  const cellAreaKm2 = (grid.groundStepM / 1000) ** 2;
  return {
    score,
    searchAreaKm2: score * prob.length * cellAreaKm2,
    totalAreaKm2: prob.length * cellAreaKm2,
    cellProb: target,
  };
}
