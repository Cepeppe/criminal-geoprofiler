# Criminal Geoprofiler - Monster of Florence

***English** · [Italiano](README.it.md)*

An educational **criminal geographic profiling** tool, entirely client-side. From a series of
georeferenced event points it computes a **probability surface** for the offender's anchor point
(home, workplace, operating base) using four classic models, and renders it as a continuous raster
with area-percentile contours.

**Demo:** <https://cepeppe.github.io/criminal-geoprofiler/>

> ⚠️ The results are **indicative and educational**. They depend decisively on the points entered,
> on the scale, on the metric and on the parameters. They are not evidence, they do not replace
> investigative work and they do not identify people.

---

## Contents

- [What it does](#what-it-does)
- [Language](#language)
- [Models implemented](#models-implemented)
- [How the surfaces are rendered](#how-the-surfaces-are-rendered)
- [Evaluation metrics](#evaluation-metrics)
- [Project structure](#project-structure)
- [Running locally](#running-locally)
- [Deployment](#deployment)
- [Import / export](#import--export)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [Reference values - MoF case](#reference-values---mof-case)
- [Privacy and data](#privacy-and-data)
- [Known limitations](#known-limitations)
- [Credits and licence](#credits-and-licence)

---

## What it does

- **Event points**: the historical dataset of the Monster of Florence case (8 episodes, 1968–1985,
  with two geographic clusters), entry by click on the map or by coordinates, CSV/GeoJSON import.
- **Four geographic profiling models** with adjustable parameters and two distance metrics
  (geodesic and Manhattan).
- **Probability surface** rendered as a continuous raster with area-percentile contours, five
  perceptually uniform colour scales, adjustable threshold and opacity.
- **Probability peaks** extracted automatically: the areas to search first, in order.
- **Hit score**: quantitative evaluation of the profile against an anchor hypothesis.
- **Centrographic statistics**: mean centre, geometric median, standard distance, nearest neighbour,
  standard deviational ellipse.
- **Bilingual interface**, Italian and English, auto-detected from the browser language.
- Local persistence, undo/redo, state sharing via URL, light/dark theme.

No backend, no build step, no framework. The only dependency is Leaflet.

---

## Language

The interface is available in **Italian** and **English**. The language is chosen from the
`IT / EN` switch at the top of the panel, or under *View → Interface → Language*, which also offers
“Follow the browser” (the default). The choice is saved in `localStorage`.

A link can force the language with the `?lang=it` or `?lang=en` parameter; the value becomes the
stored preference, so a link shared in English stays in English across reloads.

Switching is immediate and does not reload the page: besides the texts, it realigns number
formatting (`it-IT` / `en-GB`), the dates in the dataset labels and the page metadata
(`<html lang>`, `<title>`, Open Graph). Labels written or imported by the user are left untouched.
All strings live in [`js/i18n.js`](js/i18n.js): adding a language means adding one dictionary to
that file.

---

## Models implemented

Every model produces a **log-likelihood** field, converted to probability exactly once with the
log-sum-exp trick. The result is a genuine discrete distribution: the sum over the cells is 1.
This eliminates at the root the numerical underflow that afflicts naive implementations.

### Rossmo / CGT

```
p(i) = Σₙ [ φ · dₙ⁻ᶠ  +  (1−φ) · B^(g−f) / (2B − dₙ)^g ]        φ = 1 if dₙ > B, else 0
```

Outside the buffer the likelihood decays as a power law with exponent `f`; **inside** the buffer the
term *grows* with distance, modelling the *buffer zone* the offender tends to avoid. The maximum
therefore falls on the **ring** of radius `B`, not on the event point — the model's signature.
Rossmo's original formulation uses Manhattan distance, selectable in the interface.

### KDE - Gaussian kernel

```
p(i) ∝ Σₙ exp( −dₙ² / 2σ² )
```

It describes where the **events** cluster, not where the offender lives: it carries no buffer-zone
assumption. It is the natural baseline against which to compare genuine geographic profiling models.
The *Automatic estimate* button computes Silverman's bandwidth for two-dimensional data
(`h = σ·n^(−1/6)`) and offers the nearest-neighbour estimate as an alternative, usually tighter on
clustered data.

### Centre of gravity

```
p(i) ∝ exp( −d(i, C)² / 2σ² )
```

An isotropic Gaussian centred on the mean centre `C`, with `σ` equal to the standard distance of the
points from `C` times the scale factor. It is the simplest and most fragile model: a single distant
event shifts `C` appreciably. That is why the *Results* tab also reports the **geometric median**, a
robust estimator computed with Weiszfeld's algorithm.

### Journey-to-crime

```
log p(i) = −λ · Σₙ dₙ + const.
```

Exponential decay over the aggregate distance. `λ` is the inverse of a characteristic distance: the
half distance is `d½ = ln2 / λ`, shown live in the interface. Computing on a log scale stays accurate
even with large `λ` and many points, where `exp(−λ·Σd)` would collapse to zero in double precision.

---

## How the surfaces are rendered

The computation grid is built in **spherical Web Mercator** (EPSG:3857, the same as Leaflet), so the
raster matches the overlay pixel for pixel and does not suffer the distortion you would get by
stretching a lat/lon grid over a Mercator map. **Distances**, by contrast, stay geodesic, computed on
the geographic coordinates of each cell: projection and metric are kept separate.

The field is drawn on a canvas with **bilinear resampling** at a resolution higher than the grid's
(this removes the checkerboard effect without inventing information) and overlaid as an
`L.imageOverlay`.

**Area-percentile mapping** (the default): the colour of a cell tells how much of the study area has
a lower probability. The 0.95 contour therefore encloses *exactly* 5 % of the area. The area of
interest stays readable whatever the dynamic range of the model — no manual tuning parameter is
needed. Linear mapping in probability is available too.

The colour scales (viridis, inferno, magma, cividis, single hue) are all **monotone in lightness**:
they stay readable in greyscale and with colour vision deficiencies.

---

## Evaluation metrics

**Probability peaks** - local maxima of the surface with non-maximum suppression, sorted. For each
one, the fraction of the study area to be searched in order to reach it is reported.

**Hit score** - the standard metric for evaluating a geoprofile: by placing an anchor hypothesis, it
reports what percentage of the study area has to be searched, following decreasing probability order,
before reaching it. The lower it is, the more informative the profile. A hit score of 50 % is
equivalent to a random search.

---

## Project structure

```
.
├─ index.html            markup
├─ styles.css            token-based design system, light/dark theme
├─ mostro.jpg            masthead image
└─ js/
   ├─ main.js            orchestration: state ↔ interface ↔ map ↔ models
   ├─ mapview.js         everything that touches Leaflet
   ├─ store.js           state, undo/redo, persistence
   ├─ models.js          the four models, on a log scale
   ├─ geo.js             geodesy, metrics, centrography, grid
   ├─ surface.js         raster, colour scales, contours, peaks, hit score
   ├─ data.js            MoF dataset, presets, basemaps
   ├─ io.js              CSV, GeoJSON, URL sharing
   ├─ i18n.js            Italian/English dictionaries and DOM application
   └─ dom.js             DOM helpers, formatting, accessible modals
```

The computation modules (`geo`, `models`, `surface`) know nothing of Leaflet or the DOM: they can be
tested in isolation with Node, without a browser.

---

## Running locally

A **static server** is required: the page uses ES modules, which browsers refuse to load over the
`file://` protocol. Opening `index.html` by double-clicking shows a notice with the instructions.

```bash
python -m http.server 8000
# or
npx serve . -p 8000
```

Then open <http://localhost:8000>.

---

## Deployment

The repository is already configured for **GitHub Pages** through `.github/workflows/static.yml`
(*GitHub Actions* source, no Jekyll processing): on every push to `master` the whole folder is
published as is.

All references to local resources are **relative**, so the site also works under the project
subpath (`/criminal-geoprofiler/`). No build step is needed.

For any other static hosting, copying the folder is enough.

---

## Import / export

**CSV input** - the header is recognised by column name: `lat`/`latitude`/`y` and
`lon`/`lng`/`longitude`/`x`, with optional `label` and `date`. Accepted separators: comma, semicolon,
tab. With no recognisable header, the order `lat, lon, label` is assumed.

**GeoJSON** - a `FeatureCollection` of `Point` geometries; the `label`/`name` and `date` properties
are read when present.

**Export** - CSV and GeoJSON. The *Copy shareable link* button encodes points, model and parameters
in the URL fragment: whoever opens the link gets the same state, with nothing passing through a
server.

---

## Keyboard shortcuts

| Key | Action |
|---|---|
| `Enter` | Compute the surface |
| `A` | Toggle click-to-add entry |
| `F` | Zoom to all points |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |
| `Esc` | Leave the current mode or close the dialog |

---

## Reference values - MoF case

Empirical starting points, applicable with one click from the *Info* tab. They should be checked
case by case.

| Scope | Rossmo/CGT | KDE | Centre of gravity | Journey-to-crime |
|---|---|---|---|---|
| Province scale | B=2.5 km · f=1.2 · g=1.6 | σ=2.8 km | scale 1.1× | λ=0.25 (d½≈2.8 km) |
| South-West cluster | B=1.0 km · f=1.4 · g=1.8 | σ=0.9 km | scale 0.9× | λ=0.60 |
| North-East cluster | B=1.2 km · f=1.3 · g=1.7 | σ=1.2 km | scale 1.0× | λ=0.50 |

The grid step is computed automatically from the extent of the points (targeting ~40,000 cells) and
can still be forced by hand.

---

## Privacy and data

The computation runs **entirely in the browser**: no event point leaves the device. Points and
preferences are stored only in `localStorage`, locally.

Outbound traffic covers: the CDN libraries (unpkg), the map tiles (OpenStreetMap / CARTO) and
**Google Analytics**, which collects aggregate browsing statistics. The latter can be blocked with
any content blocker without losing any functionality.

---

## Known limitations

- The models treat every event point as independent: no temporal correlation, no weighting by how
  reliable the attribution is.
- The surface is computed over free space: it accounts for neither road networks, nor terrain,
  nor population distribution, nor barriers. These are possible extensions, not implemented.
- The 260,000-cell cap prevents the browser from freezing but limits detail over very large areas
  with a very fine step.
- No geocoder: entry happens by click or by coordinates, not by address.
- The MoF dataset is in the public domain and refers to **locations**, not to people. The
  attribution of individual episodes to the series is, in some cases, disputed.

---

## Credits and licence

Cartography © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors ·
tiles © [CARTO](https://carto.com/attributions). Map engine: [Leaflet](https://leafletjs.com/) 1.9.4.
The viridis, inferno, magma and cividis colour scales come from the matplotlib project (CC0).

**Licence:** BSD 2-Clause · © 2025 Giuseppe Sorgentone
