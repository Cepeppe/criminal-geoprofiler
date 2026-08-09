/**
 * models.js - modelli di geoprofilazione.
 *
 * Ogni modello produce un campo di **log-verosimiglianza** sulla griglia.
 * La conversione finale in probabilità avviene una sola volta, con il trucco
 * log-sum-exp: questo elimina alla radice l'underflow che affligge le
 * implementazioni ingenue (p.es. journey-to-crime, dove exp(-λ·Σd) collassa a
 * zero in doppia precisione già con una decina di punti a scala provinciale).
 *
 * Il risultato è una vera distribuzione discreta: Σ p_i = 1 sulle celle.
 */

import { centroid, standardDistanceKm, nearestNeighborStats, haversineKm } from './geo.js';
import { t } from './i18n.js';

/* ─────────────────────────── Metadati ─────────────────────────── */

/**
 * Le chiavi definiscono l'insieme dei modelli disponibili; etichetta e
 * descrizione vivono nei dizionari (`method.<chiave>.label|desc`) perché
 * cambiano con la lingua, mentre i kernel no.
 */
export const METHODS = {
  rossmo: {},
  kde: {},
  meanCenter: {},
  journey: {},
};

export const methodLabel = (method) => t(`method.${method}.label`);
export const methodDesc = (method) => t(`method.${method}.desc`);


/* ─────────────────────── Normalizzazione ─────────────────────── */

/**
 * Converte un campo di log-verosimiglianza in una distribuzione di probabilità
 * (Σ = 1) con il trucco log-sum-exp. Robusto a qualunque intervallo dinamico.
 */
export function logsToProbability(logs) {
  const n = logs.length;
  const prob = new Float64Array(n);

  let max = -Infinity;
  for (let i = 0; i < n; i++) if (logs[i] > max) max = logs[i];

  if (!Number.isFinite(max)) {          // degenere: distribuzione uniforme
    prob.fill(1 / n);
    return prob;
  }

  let sum = 0;
  for (let i = 0; i < n; i++) {
    const e = Math.exp(logs[i] - max);
    prob[i] = e;
    sum += e;
  }
  if (sum <= 0 || !Number.isFinite(sum)) { prob.fill(1 / n); return prob; }
  for (let i = 0; i < n; i++) prob[i] /= sum;
  return prob;
}

/* ─────────────────────────── Modelli ─────────────────────────── */

function rossmoLogs(grid, points, { B, f, g }, dist, dMinKm) {
  const { n, lat, lng } = grid;
  const logs = new Float64Array(n);
  const Bs = Math.max(0.02, B);
  const coef = Math.pow(Bs, g - f);

  for (let i = 0; i < n; i++) {
    const cLat = lat[i], cLng = lng[i];
    let s = 0;
    for (let k = 0; k < points.length; k++) {
      const d = Math.max(dMinKm, dist(cLat, cLng, points[k].lat, points[k].lng));
      s += d > Bs
        ? Math.pow(d, -f)                       // fuori dalla buffer zone
        : coef / Math.pow(2 * Bs - d, g);       // dentro: cresce verso il bordo
    }
    logs[i] = s > 0 ? Math.log(s) : -Infinity;
  }
  return logs;
}

function kdeLogs(grid, points, { sigma }, dist, dMinKm) {
  const { n, lat, lng } = grid;
  const logs = new Float64Array(n);
  const s2 = 2 * Math.max(0.02, sigma) ** 2;
  const m = points.length;
  const terms = new Float64Array(m);

  for (let i = 0; i < n; i++) {
    const cLat = lat[i], cLng = lng[i];
    // log-sum-exp locale: la somma di gaussiane non sottotraccia mai
    let max = -Infinity;
    for (let k = 0; k < m; k++) {
      const d = Math.max(dMinKm, dist(cLat, cLng, points[k].lat, points[k].lng));
      const t = -(d * d) / s2;
      terms[k] = t;
      if (t > max) max = t;
    }
    let acc = 0;
    for (let k = 0; k < m; k++) acc += Math.exp(terms[k] - max);
    logs[i] = max + Math.log(acc);
  }
  return logs;
}

function meanCenterLogs(grid, points, { scale }, dist) {
  const { n, lat, lng } = grid;
  const logs = new Float64Array(n);
  const c = centroid(points);
  const sd = standardDistanceKm(points, c, dist);
  const sigma = Math.max(0.25, sd * Math.max(0.1, scale));
  const s2 = 2 * sigma * sigma;

  for (let i = 0; i < n; i++) {
    const d = dist(lat[i], lng[i], c.lat, c.lng);
    logs[i] = -(d * d) / s2;
  }
  return logs;
}

function journeyLogs(grid, points, { lambda }, dist, dMinKm) {
  const { n, lat, lng } = grid;
  const logs = new Float64Array(n);
  const lam = Math.max(0.001, lambda);

  for (let i = 0; i < n; i++) {
    const cLat = lat[i], cLng = lng[i];
    let sumD = 0;
    for (let k = 0; k < points.length; k++) {
      sumD += Math.max(dMinKm, dist(cLat, cLng, points[k].lat, points[k].lng));
    }
    logs[i] = -lam * sumD;   // in scala log: nessun underflow, qualunque sia λ·Σd
  }
  return logs;
}

const KERNELS = {
  rossmo: rossmoLogs,
  kde: kdeLogs,
  meanCenter: meanCenterLogs,
  journey: journeyLogs,
};

/**
 * Calcola la superficie di probabilità.
 *
 * @param {string} method   chiave in METHODS
 * @param {object} grid     griglia da geo.buildGrid
 * @param {Array}  points   punti-evento {lat,lng}
 * @param {object} params   parametri del modello
 * @param {Function} dist   metrica di distanza (lat1,lng1,lat2,lng2) → km
 * @returns {{prob:Float64Array, elapsedMs:number}}
 */
export function computeSurface(method, grid, points, params, dist = haversineKm) {
  const kernel = KERNELS[method];
  if (!kernel) throw new Error(t('model.err.unknown', { method }));
  if (!points.length) throw new Error(t('model.err.noPoints'));

  // Sotto mezza cella la geometria non è risolvibile: evita singolarità in d→0
  const dMinKm = Math.max(1e-4, grid.groundStepM / 2000);

  const t0 = performance.now();
  const logs = kernel(grid, points, params, dist, dMinKm);
  const prob = logsToProbability(logs);
  const elapsedMs = performance.now() - t0;

  return { prob, elapsedMs };
}

/* ─────────────────────── Stima dei parametri ─────────────────────── */

/**
 * Bandwidth di Silverman per dati bidimensionali: h = σ · n^(−1/6),
 * con σ ricavato dalla distanza standard. Su dati fortemente clusterizzati
 * tende a sovralisciare, per questo restituiamo anche l'alternativa basata
 * sulla distanza al primo vicino.
 */
export function suggestBandwidth(points, dist = haversineKm) {
  if (points.length < 2) return null;
  const c = centroid(points);
  const sd = standardDistanceKm(points, c, dist);
  const silverman = (sd / Math.SQRT2) * Math.pow(points.length, -1 / 6);
  const nn = nearestNeighborStats(points, dist);
  return {
    silverman: Math.max(0.05, silverman),
    nearestNeighbor: nn ? Math.max(0.05, 0.8 * nn.median) : null,
  };
}

/** Distanza di dimezzamento a partire da λ, e viceversa. */
export const halfDistanceFromLambda = (lambda) => Math.LN2 / Math.max(1e-6, lambda);
export const lambdaFromHalfDistance = (d) => Math.LN2 / Math.max(1e-6, d);
