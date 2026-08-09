/**
 * store.js - stato dell'applicazione, cronologia annulla/ripeti e persistenza.
 *
 * I punti-evento e le impostazioni vivono in `localStorage`, sul dispositivo
 * dell'utente: nulla viene inviato a un server. La cronologia copre i dati
 * (punti e ancoraggio), non le preferenze di visualizzazione.
 */

const STORAGE_KEY = 'criminal-geoprofiler/v2';
const HISTORY_LIMIT = 60;

export const DEFAULT_SETTINGS = {
  method: 'rossmo',
  params: {
    rossmo: { B: 2.5, f: 1.2, g: 1.6 },
    kde: { sigma: 2.8 },
    meanCenter: { scale: 1.1 },
    journey: { lambda: 0.25 },
  },
  distMetric: 'haversine',
  gridAuto: true,
  gridStep: 300,

  colormap: 'viridis',
  colorScale: 'percentile',
  opacity: 0.85,
  threshold: 0,
  contours: true,

  basemap: 'dark',
  showLabels: false,
  showCentro: true,
  showEllipse: false,

  theme: 'dark',
  tutorialSeen: false,
};

const clone = (v) => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));

/** Fonde le impostazioni salvate sui default, ignorando chiavi sconosciute. */
function mergeSettings(saved) {
  const out = clone(DEFAULT_SETTINGS);
  if (!saved || typeof saved !== 'object') return out;

  for (const [key, value] of Object.entries(saved)) {
    if (!(key in out)) continue;
    if (key === 'params') {
      for (const [m, p] of Object.entries(value || {})) {
        if (out.params[m] && p && typeof p === 'object') Object.assign(out.params[m], p);
      }
    } else if (typeof value === typeof out[key]) {
      out[key] = value;
    }
  }
  return out;
}

function sanitizePoints(list) {
  if (!Array.isArray(list)) return [];
  return list
    .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng) &&
                   p.lat >= -90 && p.lat <= 90 && p.lng >= -180 && p.lng <= 180)
    .map((p) => ({
      lat: p.lat,
      lng: p.lng,
      label: typeof p.label === 'string' ? p.label : '',
      date: typeof p.date === 'string' ? p.date : '',
    }));
}

function readStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createStore() {
  const persisted = readStorage();

  const state = {
    points: sanitizePoints(persisted?.points),
    anchor: persisted?.anchor && Number.isFinite(persisted.anchor.lat) ? persisted.anchor : null,
    settings: mergeSettings(persisted?.settings),
  };

  const listeners = new Set();
  const past = [];
  const future = [];
  let saveTimer = null;

  const snapshot = () => ({ points: clone(state.points), anchor: clone(state.anchor) });

  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          points: state.points,
          anchor: state.anchor,
          settings: state.settings,
        }));
      } catch {
        /* quota esaurita o storage disabilitato: l'app resta pienamente usabile */
      }
    }, 300);
  }

  function emit(changed) {
    for (const fn of listeners) fn(state, changed);
    persist();
  }

  function pushHistory() {
    past.push(snapshot());
    if (past.length > HISTORY_LIMIT) past.shift();
    future.length = 0;
  }

  return {
    get state() { return state; },
    get canUndo() { return past.length > 0; },
    get canRedo() { return future.length > 0; },

    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /* ── Punti ── */
    setPoints(points, { history = true } = {}) {
      if (history) pushHistory();
      state.points = sanitizePoints(points);
      emit('points');
    },
    addPoint(point, { history = true } = {}) {
      if (history) pushHistory();
      state.points = [...state.points, ...sanitizePoints([point])];
      emit('points');
    },
    removePoint(index) {
      if (index < 0 || index >= state.points.length) return;
      pushHistory();
      state.points = state.points.filter((_, i) => i !== index);
      emit('points');
    },
    clearPoints() {
      if (!state.points.length) return;
      pushHistory();
      state.points = [];
      emit('points');
    },

    /* ── Ancoraggio ── */
    setAnchor(anchor) {
      pushHistory();
      state.anchor = anchor ? { lat: anchor.lat, lng: anchor.lng } : null;
      emit('anchor');
    },

    /* ── Impostazioni ── */
    setSetting(key, value) {
      if (!(key in state.settings)) return;
      state.settings[key] = value;
      emit('settings');
    },
    setMethodParam(method, key, value) {
      if (!state.settings.params[method]) return;
      state.settings.params[method][key] = value;
      emit('settings');
    },
    setMethodParams(method, patch) {
      if (!state.settings.params[method]) return;
      Object.assign(state.settings.params[method], patch);
      emit('settings');
    },

    /* ── Cronologia ── */
    undo() {
      if (!past.length) return false;
      future.push(snapshot());
      const prev = past.pop();
      state.points = prev.points;
      state.anchor = prev.anchor;
      emit('points');
      return true;
    },
    redo() {
      if (!future.length) return false;
      past.push(snapshot());
      const next = future.pop();
      state.points = next.points;
      state.anchor = next.anchor;
      emit('points');
      return true;
    },

    /* ── Reset ── */
    resetAll() {
      past.length = 0;
      future.length = 0;
      state.points = [];
      state.anchor = null;
      state.settings = clone(DEFAULT_SETTINGS);
      try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignorabile */ }
      emit('all');
    },
  };
}
