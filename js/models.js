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

/* ─────────────────────────── Metadati ─────────────────────────── */

export const METHODS = {
  rossmo: {
    label: 'Rossmo / CGT',
    desc: `
      <p><b>Criminal Geographic Targeting</b> (D.&nbsp;K. Rossmo, 1995). Ogni punto-evento
      contribuisce con una funzione di <i>distance decay</i> spezzata in due regimi:</p>
      <p class="formula">p(i) = Σ<sub>n</sub> [ φ · d<sub>n</sub><sup>−f</sup> + (1−φ) · B<sup>g−f</sup> / (2B − d<sub>n</sub>)<sup>g</sup> ]</p>
      <p>con φ = 1 se d<sub>n</sub> &gt; <i>B</i>, altrimenti 0.</p>
      <p><b>Oltre il buffer</b> (d &gt; <i>B</i>) la verosimiglianza decade come una potenza
      di esponente <i>f</i>: più ci si allontana, meno è plausibile che lì risieda l'autore.
      <b>Dentro il buffer</b> (d ≤ <i>B</i>) il termine <i>cresce</i> con la distanza: modella la
      <i>buffer zone</i>, l'area immediatamente attorno alla base che un autore tende a
      evitare per non essere riconosciuto. Il massimo cade quindi sull'<b>anello</b> di raggio
      <i>B</i>, non sul punto-evento.</p>
      <p class="note">La formulazione originale usa la distanza Manhattan, coerente con un
      reticolo stradale urbano. Puoi selezionarla nella sezione «Metrica».</p>`,
  },
  kde: {
    label: 'KDE - kernel gaussiano',
    desc: `
      <p><b>Stima di densità per nuclei</b>. Ogni punto-evento è sostituito da una gaussiana
      di ampiezza <i>σ</i> e le gaussiane si sommano:</p>
      <p class="formula">p(i) ∝ Σ<sub>n</sub> exp( − d<sub>n</sub>² / 2σ² )</p>
      <p>Descrive <b>dove si concentrano gli eventi</b>, non dove risiede l'autore: non
      incorpora alcuna ipotesi di <i>buffer zone</i>. È il riferimento naturale contro cui
      confrontare i modelli propriamente geoprofilanti.</p>
      <p class="note"><i>σ</i> piccolo → superficie frammentata attorno ai singoli punti;
      <i>σ</i> grande → una sola macchia centrata sul baricentro.</p>`,
  },
  meanCenter: {
    label: 'Centro di gravità',
    desc: `
      <p><b>Modello centrografico</b>. Una singola gaussiana isotropa centrata sul baricentro
      dei punti-evento:</p>
      <p class="formula">p(i) ∝ exp( − d(i, C)² / 2σ² )</p>
      <p>dove <i>C</i> è il baricentro e <i>σ</i> la distanza standard dei punti da <i>C</i>,
      moltiplicata per il fattore di scala.</p>
      <p class="note">È il modello più semplice e più fragile: un singolo evento distante
      sposta sensibilmente <i>C</i>. Il pannello «Risultati» riporta anche la
      <b>mediana geometrica</b>, stimatore robusto alternativo.</p>`,
  },
  journey: {
    label: 'Journey-to-crime',
    desc: `
      <p><b>Modello di viaggio verso il crimine</b> a decadimento esponenziale. Ipotizza che
      ogni spostamento base→evento sia indipendente, con probabilità che decade
      esponenzialmente nella distanza:</p>
      <p class="formula">log p(i) = − λ · Σ<sub>n</sub> d<sub>n</sub> + cost.</p>
      <p>Il parametro <i>λ</i> è l'inverso di una distanza caratteristica: la
      <b>distanza di dimezzamento</b> è <i>d</i><sub>½</sub> = ln2 / λ.</p>
      <p class="note">Sommando le distanze, il modello privilegia fortemente i punti a
      distanza aggregata minima: la superficie tende a concentrarsi attorno alla
      <b>mediana geometrica</b>. Il calcolo avviene in scala logaritmica, quindi resta
      accurato anche con λ elevati e molti punti.</p>`,
  },
};

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
  if (!kernel) throw new Error(`Modello sconosciuto: ${method}`);
  if (!points.length) throw new Error('Nessun punto-evento.');

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
