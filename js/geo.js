/**
 * geo.js - geodesia, metriche di distanza, statistiche centrografiche e
 * costruzione della griglia di calcolo.
 *
 * La griglia è costruita in Web Mercator sferico (EPSG:3857, R = 6378137 m),
 * la stessa proiezione usata da Leaflet: questo garantisce che il raster
 * prodotto in `surface.js` combaci al pixel con `L.imageOverlay`, senza la
 * deformazione che si otterrebbe stendendo una griglia lat/lon su una mappa
 * di Mercatore.
 *
 * Le distanze per i modelli restano invece geodetiche, calcolate sulle
 * coordinate geografiche di ogni cella: proiezione e metrica sono separate.
 */

export const R_EARTH_KM = 6371.0088;   // raggio medio (IUGG) - per le distanze
const R_MERC = 6378137;                // raggio della sfera EPSG:3857 - per la proiezione

export const toRad = (d) => (d * Math.PI) / 180;
export const toDeg = (r) => (r * 180) / Math.PI;

const MAX_MERC_LAT = 85.05112878;
export const clampLat = (lat) => Math.min(MAX_MERC_LAT, Math.max(-MAX_MERC_LAT, lat));

/* ─────────────────────────── Proiezione ─────────────────────────── */

export function project(lat, lng) {
  const φ = toRad(clampLat(lat));
  return {
    x: R_MERC * toRad(lng),
    y: R_MERC * Math.log(Math.tan(Math.PI / 4 + φ / 2)),
  };
}

export function unproject(x, y) {
  return {
    lat: toDeg(2 * Math.atan(Math.exp(y / R_MERC)) - Math.PI / 2),
    lng: toDeg(x / R_MERC),
  };
}

/* ─────────────────────────── Distanze ─────────────────────────── */

/** Distanza great-circle (formula dell'emisenoverso), in km. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R_EARTH_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/**
 * Distanza Manhattan (|Δnord| + |Δest|) in km, sul piano tangente alla
 * latitudine media. È la metrica su cui Rossmo formulò originariamente la CGT,
 * pensata per reticoli stradali urbani.
 */
export function manhattanKm(lat1, lng1, lat2, lng2) {
  const dNorth = R_EARTH_KM * toRad(lat2 - lat1);
  const dEast = R_EARTH_KM * toRad(lng2 - lng1) * Math.cos(toRad((lat1 + lat2) / 2));
  return Math.abs(dNorth) + Math.abs(dEast);
}

export const METRICS = {
  haversine: { fn: haversineKm, label: 'Euclidea geodetica' },
  manhattan: { fn: manhattanKm, label: 'Manhattan' },
};

export const getMetric = (key) => (METRICS[key] || METRICS.haversine).fn;

/* ─────────────────────── Statistiche centrografiche ─────────────────────── */

export function bboxOf(points) {
  let south = Infinity, west = Infinity, north = -Infinity, east = -Infinity;
  for (const p of points) {
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
  }
  return { south, west, north, east };
}

/** Baricentro aritmetico (mean center). */
export function centroid(points) {
  let lat = 0, lng = 0;
  for (const p of points) { lat += p.lat; lng += p.lng; }
  return { lat: lat / points.length, lng: lng / points.length };
}

/**
 * Mediana geometrica (punto di minima distanza aggregata), via algoritmo di
 * Weiszfeld. È più robusta del baricentro rispetto ai punti anomali e in
 * geoprofilazione è spesso un miglior stimatore del punto di ancoraggio.
 */
export function geometricMedian(points, { metric = haversineKm, iterations = 200, tol = 1e-9 } = {}) {
  if (points.length === 0) return null;
  if (points.length <= 2) return centroid(points);

  let { lat, lng } = centroid(points);

  for (let it = 0; it < iterations; it++) {
    let wSum = 0, latSum = 0, lngSum = 0, coincident = false;

    for (const p of points) {
      const d = metric(lat, lng, p.lat, p.lng);
      if (d < 1e-9) { coincident = true; continue; }
      const w = 1 / d;
      wSum += w;
      latSum += p.lat * w;
      lngSum += p.lng * w;
    }
    if (wSum === 0) break;

    const nLat = latSum / wSum;
    const nLng = lngSum / wSum;
    const shift = Math.abs(nLat - lat) + Math.abs(nLng - lng);
    lat = nLat; lng = nLng;
    if (shift < tol && !coincident) break;
  }
  return { lat, lng };
}

/** Distanza standard (deviazione standard bidimensionale) dal centro, in km. */
export function standardDistanceKm(points, center, metric = haversineKm) {
  if (points.length < 2) return 0;
  let sum = 0;
  for (const p of points) {
    const d = metric(center.lat, center.lng, p.lat, p.lng);
    sum += d * d;
  }
  return Math.sqrt(sum / points.length);
}

/**
 * Ellisse di deviazione standard a 1σ, calcolata sulla matrice di covarianza
 * delle coordinate proiettate localmente in km. Restituisce semiassi in km e
 * l'azimut dell'asse maggiore in gradi (0 = nord, orario).
 */
export function standardDeviationalEllipse(points) {
  if (points.length < 3) return null;
  const c = centroid(points);
  const cosφ = Math.cos(toRad(c.lat));

  let sxx = 0, syy = 0, sxy = 0;
  for (const p of points) {
    const x = R_EARTH_KM * toRad(p.lng - c.lng) * cosφ;   // est, km
    const y = R_EARTH_KM * toRad(p.lat - c.lat);          // nord, km
    sxx += x * x; syy += y * y; sxy += x * y;
  }
  const n = points.length;
  sxx /= n; syy /= n; sxy /= n;

  // Autovalori/autovettori della matrice 2×2 di covarianza
  const tr = sxx + syy;
  const det = sxx * syy - sxy * sxy;
  const disc = Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
  const l1 = tr / 2 + disc;
  const l2 = tr / 2 - disc;

  const semiMajor = Math.sqrt(Math.max(0, l1));
  const semiMinor = Math.sqrt(Math.max(0, l2));
  // Angolo dell'autovettore dominante rispetto all'asse est
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const azimuth = (90 - toDeg(theta) + 360) % 180;

  return { center: c, semiMajorKm: semiMajor, semiMinorKm: semiMinor, azimuthDeg: azimuth, theta };
}

/** Converte un'ellisse in un anello di coordinate geografiche per il disegno. */
export function ellipseRing(ellipse, steps = 128) {
  if (!ellipse) return [];
  const { center, semiMajorKm, semiMinorKm, theta } = ellipse;
  const cosφ = Math.cos(toRad(center.lat));
  const ring = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const ex = semiMajorKm * Math.cos(t);
    const ey = semiMinorKm * Math.sin(t);
    const x = ex * Math.cos(theta) - ey * Math.sin(theta);   // est, km
    const y = ex * Math.sin(theta) + ey * Math.cos(theta);   // nord, km
    ring.push([
      center.lat + toDeg(y / R_EARTH_KM),
      center.lng + toDeg(x / (R_EARTH_KM * cosφ)),
    ]);
  }
  return ring;
}

/** Statistiche sulle distanze al primo vicino, in km. */
export function nearestNeighborStats(points, metric = haversineKm) {
  if (points.length < 2) return null;
  const dists = points.map((p, i) => {
    let best = Infinity;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      const d = metric(p.lat, p.lng, points[j].lat, points[j].lng);
      if (d < best) best = d;
    }
    return best;
  });
  const sorted = [...dists].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return {
    mean: dists.reduce((a, b) => a + b, 0) / dists.length,
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

/** Distanza massima fra due punti qualsiasi dell'insieme, in km. */
export function maxPairDistanceKm(points, metric = haversineKm) {
  let max = 0;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const d = metric(points[i].lat, points[i].lng, points[j].lat, points[j].lng);
      if (d > max) max = d;
    }
  }
  return max;
}

/* ─────────────────────────── Griglia ─────────────────────────── */

export const GRID_LIMITS = { minSide: 24, maxSide: 480, maxCells: 260000 };

/**
 * Costruisce una griglia regolare in Web Mercator che copre i punti con un
 * margine proporzionale all'estensione del caso.
 *
 * @param {{lat:number,lng:number}[]} points
 * @param {object} opts
 * @param {number} [opts.targetCells=40000]  celle desiderate (modalità automatica)
 * @param {number|null} [opts.stepM=null]    passo al suolo in metri (modalità manuale)
 * @param {number} [opts.padFraction=0.45]   margine, come frazione del lato maggiore
 * @param {number} [opts.minPadKm=2]         margine minimo assoluto
 * @returns {{nx:number, ny:number, n:number, cell:number, groundStepM:number,
 *            lat:Float64Array, lng:Float64Array, bounds:object}}
 */
export function buildGrid(points, {
  targetCells = 40000,
  stepM = null,
  padFraction = 0.45,
  minPadKm = 2,
} = {}) {
  const bb = bboxOf(points);

  // Margine calcolato in gradi a partire dall'estensione geografica
  const centerLat = (bb.south + bb.north) / 2;
  const cosφ = Math.max(0.05, Math.cos(toRad(centerLat)));
  const heightKm = (bb.north - bb.south) * (Math.PI / 180) * R_EARTH_KM;
  const widthKm = (bb.east - bb.west) * (Math.PI / 180) * R_EARTH_KM * cosφ;
  const padKm = Math.max(minPadKm, padFraction * Math.max(widthKm, heightKm));

  const padLat = toDeg(padKm / R_EARTH_KM);
  const padLng = toDeg(padKm / (R_EARTH_KM * cosφ));

  const south = clampLat(bb.south - padLat);
  const north = clampLat(bb.north + padLat);
  const west = bb.west - padLng;
  const east = bb.east + padLng;

  const sw = project(south, west);
  const ne = project(north, east);
  const W = Math.max(1, ne.x - sw.x);
  const H = Math.max(1, ne.y - sw.y);

  // Lato della cella in metri di Mercatore (quadrata in proiezione, quindi
  // quadrata anche sullo schermo: è ciò che serve al raster).
  let cell;
  if (stepM && stepM > 0) {
    cell = stepM / cosφ;                       // da metri al suolo a metri Mercator
  } else {
    cell = Math.sqrt((W * H) / Math.max(1, targetCells));
  }

  let nx = Math.round(W / cell);
  let ny = Math.round(H / cell);

  // Vincoli di sicurezza: evitano griglie degeneri o esplosive
  const fit = (v) => Math.min(GRID_LIMITS.maxSide, Math.max(GRID_LIMITS.minSide, v));
  nx = fit(nx); ny = fit(ny);
  if (nx * ny > GRID_LIMITS.maxCells) {
    const k = Math.sqrt((nx * ny) / GRID_LIMITS.maxCells);
    nx = Math.max(GRID_LIMITS.minSide, Math.floor(nx / k));
    ny = Math.max(GRID_LIMITS.minSide, Math.floor(ny / k));
  }

  const cellX = W / nx;
  const cellY = H / ny;

  const n = nx * ny;
  const lat = new Float64Array(n);
  const lng = new Float64Array(n);

  // Riga 0 = estremo nord, così l'ordine delle celle coincide con quello dei
  // pixel di un canvas e l'overlay non va specchiato.
  for (let j = 0; j < ny; j++) {
    const y = ne.y - (j + 0.5) * cellY;
    const rowLat = toDeg(2 * Math.atan(Math.exp(y / R_MERC)) - Math.PI / 2);
    const base = j * nx;
    for (let i = 0; i < nx; i++) {
      const x = sw.x + (i + 0.5) * cellX;
      lat[base + i] = rowLat;
      lng[base + i] = toDeg(x / R_MERC);
    }
  }

  return {
    nx, ny, n,
    cell: (cellX + cellY) / 2,
    groundStepM: ((cellX + cellY) / 2) * cosφ,
    lat, lng,
    bounds: { south, west, north, east },
    /** Indice della cella che contiene un punto, o -1 se fuori griglia. */
    indexAt(pLat, pLng) {
      const p = project(pLat, pLng);
      const i = Math.floor((p.x - sw.x) / cellX);
      const j = Math.floor((ne.y - p.y) / cellY);
      if (i < 0 || i >= nx || j < 0 || j >= ny) return -1;
      return j * nx + i;
    },
  };
}
