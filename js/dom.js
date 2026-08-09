/** dom.js - utilità DOM, formattazione numerica, notifiche e modali accessibili. */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function on(target, type, handler, opts) {
  if (!target) return () => {};
  target.addEventListener(type, handler, opts);
  return () => target.removeEventListener(type, handler, opts);
}

export const setText = (elm, value) => { if (elm) elm.textContent = value; };
export const setHtml = (elm, value) => { if (elm) elm.innerHTML = value; };
export const show = (elm, visible) => { if (elm) elm.hidden = !visible; };

/* ─────────────────────────── Formattazione ─────────────────────────── */

const nf = (min, max) => new Intl.NumberFormat('it-IT', { minimumFractionDigits: min, maximumFractionDigits: max });

export const fmtInt = (v) => new Intl.NumberFormat('it-IT').format(Math.round(v));
export const fmtNum = (v, d = 2) => nf(d, d).format(v);

export function fmtDistance(km) {
  if (!Number.isFinite(km)) return '–';
  return km < 1 ? `${fmtInt(km * 1000)} m` : `${fmtNum(km, km < 10 ? 2 : 1)} km`;
}

export function fmtArea(km2) {
  if (!Number.isFinite(km2)) return '–';
  return km2 < 1 ? `${fmtNum(km2 * 100, 1)} ha` : `${fmtNum(km2, km2 < 100 ? 1 : 0)} km²`;
}

export const fmtPercent = (frac, d = 1) => `${fmtNum(frac * 100, d)}%`;

export const fmtCoord = (lat, lng) => `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

export function fmtDuration(ms) {
  if (!Number.isFinite(ms)) return '–';
  return ms < 1000 ? `${Math.round(ms)} ms` : `${fmtNum(ms / 1000, 2)} s`;
}

/* ─────────────────────────── Notifiche ─────────────────────────── */

let toastHost = null;

export function toast(message, kind = 'info', duration = 3600) {
  toastHost ||= $('#toasts');
  if (!toastHost) return;

  const node = document.createElement('div');
  node.className = `toast toast--${kind}`;
  node.textContent = message;
  toastHost.appendChild(node);

  const remove = () => {
    node.classList.add('is-out');
    setTimeout(() => node.remove(), 200);
  };
  setTimeout(remove, duration);
}

/* ─────────────────────────── Modali ─────────────────────────── */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Rende un elemento una modale accessibile: focus trap, Esc, clic sullo sfondo
 * e ripristino del focus all'elemento che l'aveva aperta.
 */
export function createModal(overlay, { onClose } = {}) {
  if (!overlay) return { open() {}, close() {}, get isOpen() { return false; } };

  let lastFocused = null;

  const trap = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); api.close(); return; }
    if (e.key !== 'Tab') return;

    const items = $$(FOCUSABLE, overlay).filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];

    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const onBackdrop = (e) => { if (e.target === overlay) api.close(); };

  const api = {
    get isOpen() { return !overlay.hidden; },
    open() {
      if (api.isOpen) return;
      lastFocused = document.activeElement;
      overlay.hidden = false;
      document.addEventListener('keydown', trap, true);
      overlay.addEventListener('mousedown', onBackdrop);
      const first = $$(FOCUSABLE, overlay).find((n) => n.offsetParent !== null);
      (first || overlay).focus?.();
    },
    close() {
      if (!api.isOpen) return;
      overlay.hidden = true;
      document.removeEventListener('keydown', trap, true);
      overlay.removeEventListener('mousedown', onBackdrop);
      lastFocused?.focus?.();
      onClose?.();
    },
  };
  return api;
}

/* ─────────────────────────── Varie ─────────────────────────── */

export function debounce(fn, ms = 200) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Legge un colore calcolato dal tema come esadecimale (per il canvas). */
export function cssColorHex(varName, fallback = '#0f1526') {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw[1]}${raw[1]}${raw[2]}${raw[2]}${raw[3]}${raw[3]}`;
  }
  return fallback;
}
