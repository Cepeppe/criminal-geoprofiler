/**
 * data.js - dataset del caso «Mostro di Firenze» e preset di parametri.
 *
 * Le coordinate sono quelle dei luoghi dei duplici omicidi attribuiti alla
 * serie. Sono dati storici di dominio pubblico, riferiti a località, non a
 * persone. `cluster` indica il raggruppamento **geografico** (non cronologico):
 * l'episodio del 1968 non appartiene a nessuno dei due addensamenti.
 */

import { t, locale } from './i18n.js';

export const MDF_EVENTS = [
  { date: '1968-08-21', label: 'Castelletti di Signa',            place: 'Signa',                          lat: 43.794588, lng: 11.082310, cluster: null },
  { date: '1974-09-14', label: 'Fontanine di Rabatta',            place: 'Borgo San Lorenzo',              lat: 43.939006, lng: 11.416401, cluster: 'ne' },
  { date: '1981-06-06', label: 'Mosciano',                        place: 'Scandicci',                      lat: 43.733137, lng: 11.168896, cluster: 'sw' },
  { date: '1981-10-22', label: 'Le Bartoline',                    place: 'Travalle, Calenzano',            lat: 43.871624, lng: 11.159006, cluster: 'ne' },
  { date: '1982-06-19', label: 'Baccaiano',                       place: 'Montespertoli',                  lat: 43.654490, lng: 11.090818, cluster: 'sw' },
  { date: '1983-09-09', label: 'Giogoli',                         place: 'Galluzzo, Firenze',              lat: 43.732229, lng: 11.206382, cluster: 'sw' },
  { date: '1984-07-29', label: 'La Boschetta',                    place: 'Vicchio',                        lat: 43.918821, lng: 11.497872, cluster: 'ne' },
  { date: '1985-09-08', label: 'Scopeti',                         place: 'San Casciano in Val di Pesa',    lat: 43.694574, lng: 11.202129, cluster: 'sw' },
];

/** «1981-06-06» → «6 giu 1981» / «6 Jun 1981», secondo la lingua attiva. */
export function formatDate(iso) {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(String(iso).trim());
  if (!m) return iso;
  const date = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(locale(), {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(date);
}

/** Etichetta completa mostrata su mappa e in elenco: «6 giu 1981 - Mosciano (Scandicci)». */
export function eventLabel(e) {
  const where = e.place ? `${e.label} (${e.place})` : e.label;
  return e.date ? `${formatDate(e.date)} - ${where}` : where;
}

/**
 * Le etichette del dataset incorporano una data scritta a parole, quindi
 * invecchiano al cambio di lingua. I punti caricati dai preset sono
 * riconoscibili dalle coordinate esatte: solo per quelli l'etichetta viene
 * rigenerata, lasciando intatte quelle scritte o importate dall'utente.
 */
const MDF_BY_COORD = new Map(MDF_EVENTS.map((e) => [`${e.lat},${e.lng}`, e]));

export function relocalizeLabel(point) {
  const event = MDF_BY_COORD.get(`${point.lat},${point.lng}`);
  return event ? eventLabel(event) : point.label;
}

export const DATASETS = {
  all: { filter: () => true },
  sw:  { filter: (e) => e.cluster === 'sw' },
  ne:  { filter: (e) => e.cluster === 'ne' },
};

export const datasetName = (key) => t(`dataset.${key}`);

export function loadDataset(key) {
  const ds = DATASETS[key];
  if (!ds) return [];
  return MDF_EVENTS.filter(ds.filter).map((e) => ({
    lat: e.lat,
    lng: e.lng,
    label: eventLabel(e),
    place: e.place,
    date: e.date,
  }));
}

/* ─────────────────────────── Preset di parametri ─────────────────────────── */

export const PRESETS = {
  provinciale: {
    rossmo: { B: 2.5, f: 1.2, g: 1.6 },
    kde: { sigma: 2.8 },
    meanCenter: { scale: 1.1 },
    journey: { lambda: 0.25 },
  },
  clusterSW: {
    rossmo: { B: 1.0, f: 1.4, g: 1.8 },
    kde: { sigma: 0.9 },
    meanCenter: { scale: 0.9 },
    journey: { lambda: 0.6 },
  },
  clusterN: {
    rossmo: { B: 1.2, f: 1.3, g: 1.7 },
    kde: { sigma: 1.2 },
    meanCenter: { scale: 1.0 },
    journey: { lambda: 0.5 },
  },
};

export const presetName = (key) => t(`preset.${key}`);

/* ─────────────────────────── Mappe di base ─────────────────────────── */

const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const CARTO_ATTR = `${OSM_ATTR} &copy; <a href="https://carto.com/attributions">CARTO</a>`;

const CARTO = { maxZoom: 20, subdomains: 'abcd', attribution: CARTO_ATTR };

/**
 * `labelsUrl`, quando presente, è un livello di sole etichette che viene
 * disegnato **sopra** la superficie di probabilità. Senza questa separazione
 * una superficie opaca seppellisce toponimi e viabilità, rendendo impossibile
 * collocare geograficamente il risultato — che è tutto il punto di una mappa.
 * OpenStreetMap non distribuisce tile separate, quindi lì l'accorgimento non
 * è applicabile.
 */
export const BASEMAPS = {
  dark: {
    name: 'CARTO Dark Matter',
    url: 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png',
    labelsUrl: 'https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png',
    options: CARTO,
  },
  light: {
    name: 'CARTO Positron',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    labelsUrl: 'https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png',
    options: CARTO,
  },
  osm: {
    name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    labelsUrl: null,
    options: { maxZoom: 19, attribution: OSM_ATTR },
  },
};
