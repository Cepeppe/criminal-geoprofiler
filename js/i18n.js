/**
 * i18n.js - dizionari, selezione della lingua e applicazione al DOM.
 *
 * Non importa nulla oltre alla chiave di storage: è il modulo di base, così
 * `dom`, `data`, `models`, `mapview` e `main` possono dipenderne senza cicli.
 *
 * Convenzioni negli attributi HTML:
 *   data-i18n="k"        → textContent
 *   data-i18n-html="k"   → innerHTML (mai su elementi che contengono controlli
 *                          con listener: verrebbero distrutti al cambio lingua)
 *   data-i18n-title="k"  → title
 *   data-i18n-label="k"  → aria-label
 *   data-i18n-ph="k"     → placeholder
 */

import { STORAGE_KEY } from './store.js';

export const LANGS = ['it', 'en'];

const LOCALES = { it: 'it-IT', en: 'en-GB' };

/* ═══════════════════════════ Dizionari ═══════════════════════════ */

const IT = {
  /* ── Documento ── */
  'doc.title': 'Criminal Geoprofiler - Mostro di Firenze',
  'doc.description': 'Strumento didattico 100% client-side di geoprofilazione criminale: inserisci punti-evento su mappa e calcola superfici di probabilità con Rossmo/CGT, KDE, centro di gravità e journey-to-crime. Dataset del caso Mostro di Firenze incluso.',
  'doc.ogDescription': 'Superfici di probabilità geoprofilanti (Rossmo/CGT, KDE, centro di gravità, journey-to-crime) calcolate nel browser, con dataset del caso Mostro di Firenze.',
  'doc.twitterDescription': 'Geoprofilazione criminale interattiva, interamente lato client.',
  'doc.locale': 'it_IT',

  /* ── Struttura ── */
  'app.skipToMap': 'Salta alla mappa',
  'app.sidebarLabel': 'Pannello di controllo',
  'app.tabsLabel': 'Sezioni',
  'app.resizerLabel': 'Ridimensiona pannello',
  'app.openSidebar': 'Apri pannello',
  'app.closeSidebar': 'Chiudi pannello',
  'app.noLeaflet.title': 'Libreria cartografica non disponibile',
  'app.noLeaflet.body': 'Leaflet non è stato caricato dalla CDN. Verifica la connessione o eventuali blocchi di rete, poi ricarica la pagina.',

  'masthead.eyebrow': 'Geoprofilazione criminale',
  'masthead.sub': 'Caso «Mostro di Firenze» · 1968–1985',

  'lang.switcher': 'Lingua dell\'interfaccia',
  'lang.label': 'Lingua',
  'lang.it': 'Italiano',
  'lang.en': 'English',
  'lang.auto': 'Segui il browser',
  'lang.changed': 'Lingua impostata su italiano.',

  'tab.data': 'Dati',
  'tab.model': 'Modello',
  'tab.view': 'Vista',
  'tab.results': 'Risultati',
  'tab.info': 'Info',

  /* ── Azioni ricorrenti ── */
  'action.undo': 'Annulla',
  'action.undo.title': 'Annulla (Ctrl+Z)',
  'action.redo': 'Ripeti',
  'action.redo.title': 'Ripeti (Ctrl+Y)',
  'action.fit': 'Inquadra tutti i punti',
  'action.apply': 'Applica',
  'action.close': 'Chiudi',
  'action.removePoint': 'Rimuovi punto',
  'action.removePointN': 'Rimuovi punto {n}',

  /* ── Scheda Dati ── */
  'data.dataset.title': 'Dataset «Mostro di Firenze»',
  'data.dataset.hint': 'Otto duplici omicidi attribuiti alla serie, 1968–1985. I cluster sono raggruppamenti geografici, non cronologici.',
  'data.loadAll': 'Serie completa',
  'data.loadSW': 'Cluster Sud-Ovest',
  'data.loadNE': 'Cluster Nord-Est',
  'data.clear': 'Svuota punti',

  'data.manual.title': 'Inserimento manuale',
  'data.addMode': 'Clic-su-mappa per aggiungere',
  'data.addMode.hint': 'Con la modalità attiva, ogni clic sulla mappa crea un punto-evento. Clic su un marker esistente per ispezionarlo o rimuoverlo.',
  'data.coord.label': 'Coordinate decimali (lat, lon)',
  'data.coord.add': 'Aggiungi',
  'data.coord.hint': 'Accettati anche <code>43.794588 11.082310</code> e <code>43,794588; 11,082310</code>.',

  'data.points.title': 'Punti-evento',
  'data.points.empty': 'Nessun punto. Carica un dataset o clicca sulla mappa.',
  'data.point.n': 'Punto {n}',

  'data.io.title': 'Import / Export',
  'data.io.import': 'Importa CSV/GeoJSON',
  'data.io.exportCsv': 'Esporta CSV',
  'data.io.exportGeo': 'Esporta GeoJSON',
  'data.io.share': 'Copia link condivisibile',
  'data.io.hint': 'CSV atteso: intestazione con colonne <code>lat</code>, <code>lon</code> (o <code>lng</code>/<code>longitude</code>) ed eventuale <code>label</code>.',
  'data.io.csvName': 'geoprofiler-punti.csv',
  'data.io.geoName': 'geoprofiler-punti.geojson',

  /* ── Scheda Modello ── */
  'model.method.title': 'Metodo',
  'model.method.label': 'Superficie da calcolare',

  'method.rossmo.label': 'Rossmo / CGT',
  'method.kde.label': 'KDE - kernel gaussiano',
  'method.meanCenter.label': 'Centro di gravità',
  'method.journey.label': 'Journey-to-crime',

  'method.rossmo.desc': `
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
  'method.kde.desc': `
      <p><b>Stima di densità per nuclei</b>. Ogni punto-evento è sostituito da una gaussiana
      di ampiezza <i>σ</i> e le gaussiane si sommano:</p>
      <p class="formula">p(i) ∝ Σ<sub>n</sub> exp( − d<sub>n</sub>² / 2σ² )</p>
      <p>Descrive <b>dove si concentrano gli eventi</b>, non dove risiede l'autore: non
      incorpora alcuna ipotesi di <i>buffer zone</i>. È il riferimento naturale contro cui
      confrontare i modelli propriamente geoprofilanti.</p>
      <p class="note"><i>σ</i> piccolo → superficie frammentata attorno ai singoli punti;
      <i>σ</i> grande → una sola macchia centrata sul baricentro.</p>`,
  'method.meanCenter.desc': `
      <p><b>Modello centrografico</b>. Una singola gaussiana isotropa centrata sul baricentro
      dei punti-evento:</p>
      <p class="formula">p(i) ∝ exp( − d(i, C)² / 2σ² )</p>
      <p>dove <i>C</i> è il baricentro e <i>σ</i> la distanza standard dei punti da <i>C</i>,
      moltiplicata per il fattore di scala.</p>
      <p class="note">È il modello più semplice e più fragile: un singolo evento distante
      sposta sensibilmente <i>C</i>. Il pannello «Risultati» riporta anche la
      <b>mediana geometrica</b>, stimatore robusto alternativo.</p>`,
  'method.journey.desc': `
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

  'model.err.unknown': 'Modello sconosciuto: {method}',
  'model.err.noPoints': 'Nessun punto-evento.',

  'param.buffer': 'Buffer <i>B</i>',
  'param.decay': 'Decadimento <i>f</i>',
  'param.compensation': 'Compensazione <i>g</i>',
  'param.bandwidth': 'Bandwidth <i>σ</i>',
  'param.autoSigma': 'Stima automatica (Silverman)',
  'param.scale': 'Scala <i>σ</i>',
  'param.scale.hint': 'σ deriva dalla distanza standard dei punti dal baricentro, moltiplicata per questo fattore.',
  'param.lambda': 'Lambda <i>λ</i>',
  // Il valore calcolato vive in un <b> gemello, fuori dal nodo tradotto: così
  // il riferimento DOM sopravvive al cambio di lingua.
  'param.lambda.hint': 'Distanza di dimezzamento <i>d<sub>½</sub></i> = ln2/λ = ',

  'model.grid.title': 'Metrica & griglia',
  'model.metric.label': 'Metrica di distanza',
  'model.metric.haversine': 'Euclidea geodetica (great-circle)',
  'model.metric.manhattan': 'Manhattan (reticolo urbano)',
  'model.metric.hint': 'Rossmo formulò la CGT su distanza Manhattan, adatta a reticoli urbani. In contesto extraurbano la geodetica è di norma più realistica.',
  'model.grid.auto': 'Risoluzione automatica',
  'model.grid.step': 'Passo griglia',
  'model.grid.hint': 'La griglia si adatta all\'estensione dei punti puntando a ~40 000 celle.',
  'model.grid.active': 'Griglia attiva: {nx} × {ny} celle ({n}), passo {step} m al suolo.',

  'model.run': 'Calcola superficie',
  'model.rerun': 'Ricalcola superficie',
  'model.running': 'Calcolo in corso…',
  'model.clearSurface': 'Rimuovi superficie',
  'model.how.title': 'Come funziona',

  /* ── Scheda Vista ── */
  'view.surface.title': 'Superficie',
  'view.colormap.label': 'Scala cromatica',
  'view.colormap.viridis': 'Viridis - percettivamente uniforme',
  'view.colormap.inferno': 'Inferno',
  'view.colormap.magma': 'Magma',
  'view.colormap.cividis': 'Cividis - ottimizzata per daltonismo',
  'view.colormap.ice': 'Ghiaccio - tinta singola',
  'view.colorScale.label': 'Mappatura dei valori',
  'view.colorScale.percentile': 'Percentile d\'area (consigliata)',
  'view.colorScale.linear': 'Lineare sulla probabilità',
  'view.colorScale.hint': 'La mappatura per percentile garantisce che la zona di interesse resti sempre leggibile, indipendentemente dall\'intervallo dinamico del modello.',
  'view.opacity': 'Opacità',
  'view.threshold': 'Soglia inferiore',
  'view.threshold.hint': 'Nasconde le celle sotto il percentile indicato: utile per isolare il nucleo ad alta probabilità.',
  'view.contours': 'Isolinee ai percentili 50 / 75 / 90 / 95 / 99',

  'view.map.title': 'Mappa',
  'view.basemap.label': 'Mappa di base',
  'view.basemap.dark': 'CARTO Dark Matter',
  'view.basemap.light': 'CARTO Positron',
  'view.basemap.osm': 'OpenStreetMap standard',
  'view.showLabels': 'Etichette permanenti sui punti',
  'view.showCentro': 'Indicatori centrografici (baricentro, mediana geometrica)',
  'view.showEllipse': 'Ellisse di deviazione standard (1σ)',

  'view.ui.title': 'Interfaccia',
  'view.theme.label': 'Tema',
  'view.theme.dark': 'Scuro',
  'view.theme.light': 'Chiaro',
  'view.theme.auto': 'Segui il sistema',

  /* ── Scheda Risultati ── */
  'res.peaks.title': 'Picchi di probabilità',
  'res.peaks.hint': 'Massimi locali della superficie, ordinati per probabilità decrescente. Sono l\'output operativo di un geoprofilo: le aree da esaminare per prime.',
  'res.peaks.empty': 'Calcola una superficie per ottenere i picchi.',
  'res.peaks.intensity': 'intensità {p}% del picco principale',
  'res.peaks.top': 'top {p}%',
  'res.peaks.topTitle': 'Frazione dell\'area di studio da perlustrare per raggiungere questo picco',

  'res.hit.title': 'Hit score',
  'res.hit.hint': 'Metrica standard di valutazione di un geoprofilo: la percentuale dell\'area di studio da perlustrare, seguendo l\'ordine di probabilità, prima di raggiungere un punto di ancoraggio ipotizzato. Più è bassa, più il profilo è informativo.',
  'res.hit.setAnchor': 'Posiziona ipotesi di ancoraggio',
  'res.hit.clickMap': 'Clicca sulla mappa… (Esc per annullare)',
  'res.hit.clearAnchor': 'Rimuovi ancoraggio',
  'res.hit.score': 'Hit score',
  'res.hit.area': 'Area da perlustrare',
  'res.hit.coord': 'Coordinate',
  'res.hit.needSurface': 'calcola prima la superficie',
  'res.hit.outOfGrid': 'fuori griglia',
  'res.hit.areaOf': '{search} su {total}',

  'res.stats.title': 'Statistiche centrografiche',
  'res.stats.empty': 'Servono almeno 2 punti.',
  'res.stats.span': 'Estensione massima',
  'res.stats.centroid': 'Baricentro',
  'res.stats.median': 'Mediana geometrica',
  'res.stats.sd': 'Distanza standard',
  'res.stats.nnMedian': 'Primo vicino (mediana)',
  'res.stats.nnRange': 'Primo vicino (min–max)',
  'res.stats.ellipse': 'Ellisse 1σ (semiassi)',
  'res.stats.azimuth': 'Azimut asse maggiore',

  /* ── Scheda Info ── */
  'info.warn.title': 'Avvertenza',
  'info.warn.body': 'Le superfici prodotte sono <b>indicative e didattiche</b>. Dipendono in modo determinante dai punti inseriti, dalla scala, dalla metrica e dai parametri scelti. Non costituiscono prova, non sostituiscono l\'attività investigativa e non identificano persone. L\'applicazione non effettua inferenze autonome né correlazioni temporali: elabora esclusivamente i punti forniti.',

  'info.ref.title': 'Valori di riferimento - caso MdF',
  'info.ref.hint': 'Punti di partenza empirici, da verificare caso per caso. «Applica» imposta metodo e parametri.',
  'info.ref.a': '<b>A.</b> Scala provinciale - serie completa',
  'info.ref.b': '<b>B.</b> Cluster Sud-Ovest',
  'info.ref.c': '<b>C.</b> Cluster Nord-Est',
  'info.ref.a.rossmo': '<i>B</i>=2,5 km · <i>f</i>=1,2 · <i>g</i>=1,6',
  'info.ref.a.kde': '<i>σ</i>=2,8 km',
  'info.ref.a.mc': 'scala 1,1×',
  'info.ref.a.jtc': '<i>λ</i>=0,25 (<i>d</i><sub>½</sub>≈2,8 km)',
  'info.ref.b.rossmo': '<i>B</i>=1,0 km · <i>f</i>=1,4 · <i>g</i>=1,8',
  'info.ref.b.kde': '<i>σ</i>=0,9 km',
  'info.ref.b.mc': 'scala 0,9×',
  'info.ref.b.jtc': '<i>λ</i>=0,60',
  'info.ref.c.rossmo': '<i>B</i>=1,2 km · <i>f</i>=1,3 · <i>g</i>=1,7',
  'info.ref.c.kde': '<i>σ</i>=1,2 km',
  'info.ref.c.mc': 'scala 1,0×',
  'info.ref.c.jtc': '<i>λ</i>=0,50',

  'info.choose.title': 'Come si scelgono i parametri',
  'info.choose.grid': '<b>Passo griglia</b> - circa 1/200 della diagonale del bounding box; l\'automatismo lo calcola per te.',
  'info.choose.buffer': '<b>Buffer <i>B</i></b> - ordine di grandezza della «zona cuscinetto» attorno alla base: 0,8–1,5 km su cluster, 2–3 km su scala provinciale.',
  'info.choose.fg': '<b><i>f</i> e <i>g</i></b> - esponenti di decadimento fuori e dentro il buffer: <i>f</i> 1,2–1,5, <i>g</i> 1,6–1,9.',
  'info.choose.sigma': '<b>σ (KDE)</b> - la stima di Silverman è un buon punto di partenza; in alternativa 0,8× la mediana delle distanze al primo vicino.',
  'info.choose.lambda': '<b>λ (JTC)</b> - scegli la distanza di dimezzamento <i>d</i><sub>½</sub> plausibile e poni λ = ln2 / <i>d</i><sub>½</sub>.',

  'info.opinion.title': 'Opinione dell\'autore',
  'info.opinion.body': 'L\'autore ritiene, <b>a titolo puramente personale</b>, che la pista del «Rosso del Mugello» sia la più solida fra le ipotesi considerate. È un\'opinione, non un fatto accertato, e non discende dai calcoli di questa applicazione.',

  'info.privacy.title': 'Privacy e dati',
  'info.privacy.p1': 'Il calcolo avviene <b>interamente nel browser</b>: nessun punto-evento lascia il tuo dispositivo. I punti inseriti sono salvati solo in <code>localStorage</code>, in locale.',
  'info.privacy.p2': 'Il traffico verso l\'esterno riguarda: le librerie da CDN (unpkg), le tile cartografiche (OpenStreetMap / CARTO) e <b>Google Analytics</b>, che raccoglie statistiche di navigazione aggregate. Puoi bloccarlo con un qualsiasi content blocker senza perdere alcuna funzionalità.',

  'info.credits.title': 'Crediti',
  'info.credits.maps': 'Cartografia © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · tile © <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>.',
  'info.credits.engine': 'Motore mappa: <a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet 1.9.4</a>. Nessun\'altra dipendenza.',
  'info.credits.colormaps': 'Scale cromatiche: viridis, inferno, magma, cividis (matplotlib, licenza CC0).',
  'info.credits.license': 'Licenza del progetto: BSD 2-Clause · © 2025 Giuseppe Sorgentone.',
  'info.credits.tutorial': 'Rivedi il tutorial',
  'info.credits.reset': 'Ripristina impostazioni di fabbrica',

  /* ── Overlay mappa ── */
  'kpi.points': 'Punti',
  'kpi.cells': 'Celle',
  'kpi.res': 'Risoluzione',
  'kpi.time': 'Calcolo',

  'legend.title': 'Probabilità relativa',
  'legend.stale': 'non aggiornata',
  'legend.stale.title': 'I punti o i parametri sono cambiati dopo l\'ultimo calcolo',
  'legend.collapse': 'Comprimi legenda',
  'legend.expand': 'Espandi legenda',
  'legend.ramp': 'Scala cromatica dalla probabilità minima alla massima',
  'legend.low': 'basso',
  'legend.high': 'alto',
  'legend.percentile': 'Percentile d\'area',
  'legend.linear': 'Probabilità della cella',
  'legend.halfMax': '½ max',
  'legend.contourNote': 'Isolinee ai percentili {levels}. ',
  'legend.notePercentile': 'Il colore indica quanta parte dell\'area di studio ha probabilità inferiore.',
  'legend.noteLinear': 'Il colore è proporzionale alla probabilità della cella.',

  /* ── Mappa ── */
  'map.anchor': 'Ipotesi di ancoraggio',
  'map.centroid': 'Baricentro',
  'map.median': 'Mediana geometrica',

  /* ── Tutorial ── */
  'tut.eyebrow': 'Benvenuto',
  'tut.intro': 'Strumento didattico di <b>geoprofilazione criminale</b>. A partire da una serie di punti-evento georiferiti, stima dove è più probabile si trovi il <i>punto di ancoraggio</i> dell\'autore (residenza, luogo di lavoro, base operativa).',
  'tut.step1': '<b>Carica i punti</b> - usa il dataset MdF nella scheda <i>Dati</i>, oppure clicca sulla mappa.',
  'tut.step2': '<b>Scegli il modello</b> - Rossmo/CGT, KDE, centro di gravità o journey-to-crime, nella scheda <i>Modello</i>.',
  'tut.step3': '<b>Calcola</b> - la superficie compare sulla mappa con isolinee ai percentili; i picchi sono elencati in <i>Risultati</i>.',
  'tut.warn': 'Le superfici sono indicative e didattiche: non costituiscono prova né sostituiscono attività investigative.',
  'tut.start': 'Inizia',

  /* ── File guard ── */
  'guard.title': 'Serve un server locale',
  'guard.p1': 'Questa pagina usa moduli JavaScript, che i browser non caricano dal protocollo <code>file://</code>. Avvia un server statico nella cartella del progetto:',
  'guard.p2': 'poi apri <code>http://localhost:8000</code>. Online (GitHub Pages) funziona senza alcuna configurazione.',

  /* ── Dataset e preset ── */
  'dataset.all': 'Serie completa',
  'dataset.sw': 'Cluster Sud-Ovest',
  'dataset.ne': 'Cluster Nord-Est',
  'preset.provinciale': 'Scala provinciale',
  'preset.clusterSW': 'Cluster Sud-Ovest',
  'preset.clusterN': 'Cluster Nord-Est',

  /* ── Notifiche ── */
  'toast.anchorSet': 'Ipotesi di ancoraggio posizionata.',
  'toast.anchorCleared': 'Ancoraggio rimosso.',
  'toast.needPoint': 'Aggiungi almeno un punto-evento prima di calcolare.',
  'toast.computeFailed': 'Calcolo non riuscito: {message}',
  'toast.needTwoPoints': 'Servono almeno 2 punti per stimare la bandwidth.',
  'toast.sigma': 'σ = {sigma} km (Silverman).',
  'toast.sigmaAlt': ' Alternativa da primo vicino: {alt} km.',
  'toast.pointsCleared': 'Punti rimossi. Ctrl+Z per annullare.',
  'toast.presetApplied': 'Applicato: {preset} - {method}.',
  'toast.linkCopied': 'Link copiato negli appunti.',
  'toast.linkFailed': 'Copia non riuscita: seleziona manualmente l\'URL.',
  'toast.nothingToExport': 'Non ci sono punti da esportare.',
  'toast.loaded': 'Caricati {n} punti-evento.',
  'toast.badCoord': 'Coordinate non riconosciute. Formato atteso: «43.794588, 11.082310».',
  'toast.noValidPoints': 'Nessun punto valido trovato nel file.',
  'toast.imported': 'Importati {n} punti.',
  'toast.importedSkipped': 'Importati {n} punti ({skipped} righe ignorate).',
  'toast.fileUnreadable': 'File non leggibile: {message}',
  'toast.sharedLoaded': 'Caricati {n} punti dal link condiviso.',
  'toast.settingsReset': 'Impostazioni ripristinate.',
  'confirm.resetAll': 'Ripristinare le impostazioni di fabbrica e cancellare tutti i punti?',
};

const EN = {
  /* ── Document ── */
  'doc.title': 'Criminal Geoprofiler - Monster of Florence',
  'doc.description': 'A 100% client-side educational criminal geographic profiling tool: place event points on a map and compute probability surfaces with Rossmo/CGT, KDE, centre of gravity and journey-to-crime. Monster of Florence case dataset included.',
  'doc.ogDescription': 'Geographic profiling probability surfaces (Rossmo/CGT, KDE, centre of gravity, journey-to-crime) computed in the browser, with the Monster of Florence case dataset.',
  'doc.twitterDescription': 'Interactive criminal geographic profiling, entirely client-side.',
  'doc.locale': 'en_GB',

  /* ── Structure ── */
  'app.skipToMap': 'Skip to map',
  'app.sidebarLabel': 'Control panel',
  'app.tabsLabel': 'Sections',
  'app.resizerLabel': 'Resize panel',
  'app.openSidebar': 'Open panel',
  'app.closeSidebar': 'Close panel',
  'app.noLeaflet.title': 'Mapping library unavailable',
  'app.noLeaflet.body': 'Leaflet could not be loaded from the CDN. Check your connection or any network blocking, then reload the page.',

  'masthead.eyebrow': 'Geographic profiling',
  'masthead.sub': '“Monster of Florence” case · 1968–1985',

  'lang.switcher': 'Interface language',
  'lang.label': 'Language',
  'lang.it': 'Italiano',
  'lang.en': 'English',
  'lang.auto': 'Follow the browser',
  'lang.changed': 'Language set to English.',

  'tab.data': 'Data',
  'tab.model': 'Model',
  'tab.view': 'View',
  'tab.results': 'Results',
  'tab.info': 'Info',

  /* ── Recurring actions ── */
  'action.undo': 'Undo',
  'action.undo.title': 'Undo (Ctrl+Z)',
  'action.redo': 'Redo',
  'action.redo.title': 'Redo (Ctrl+Y)',
  'action.fit': 'Zoom to all points',
  'action.apply': 'Apply',
  'action.close': 'Close',
  'action.removePoint': 'Remove point',
  'action.removePointN': 'Remove point {n}',

  /* ── Data tab ── */
  'data.dataset.title': '“Monster of Florence” dataset',
  'data.dataset.hint': 'Eight double murders attributed to the series, 1968–1985. The clusters are geographic groupings, not chronological ones.',
  'data.loadAll': 'Full series',
  'data.loadSW': 'South-West cluster',
  'data.loadNE': 'North-East cluster',
  'data.clear': 'Clear points',

  'data.manual.title': 'Manual entry',
  'data.addMode': 'Click-on-map to add',
  'data.addMode.hint': 'While this mode is on, every click on the map creates an event point. Click an existing marker to inspect or remove it.',
  'data.coord.label': 'Decimal coordinates (lat, lon)',
  'data.coord.add': 'Add',
  'data.coord.hint': '<code>43.794588 11.082310</code> and <code>43,794588; 11,082310</code> are accepted too.',

  'data.points.title': 'Event points',
  'data.points.empty': 'No points yet. Load a dataset or click on the map.',
  'data.point.n': 'Point {n}',

  'data.io.title': 'Import / Export',
  'data.io.import': 'Import CSV/GeoJSON',
  'data.io.exportCsv': 'Export CSV',
  'data.io.exportGeo': 'Export GeoJSON',
  'data.io.share': 'Copy shareable link',
  'data.io.hint': 'Expected CSV: a header with <code>lat</code>, <code>lon</code> (or <code>lng</code>/<code>longitude</code>) columns and an optional <code>label</code>.',
  'data.io.csvName': 'geoprofiler-points.csv',
  'data.io.geoName': 'geoprofiler-points.geojson',

  /* ── Model tab ── */
  'model.method.title': 'Method',
  'model.method.label': 'Surface to compute',

  'method.rossmo.label': 'Rossmo / CGT',
  'method.kde.label': 'KDE - Gaussian kernel',
  'method.meanCenter.label': 'Centre of gravity',
  'method.journey.label': 'Journey-to-crime',

  'method.rossmo.desc': `
      <p><b>Criminal Geographic Targeting</b> (D.&nbsp;K. Rossmo, 1995). Each event point
      contributes a <i>distance decay</i> function split into two regimes:</p>
      <p class="formula">p(i) = Σ<sub>n</sub> [ φ · d<sub>n</sub><sup>−f</sup> + (1−φ) · B<sup>g−f</sup> / (2B − d<sub>n</sub>)<sup>g</sup> ]</p>
      <p>with φ = 1 if d<sub>n</sub> &gt; <i>B</i>, and 0 otherwise.</p>
      <p><b>Beyond the buffer</b> (d &gt; <i>B</i>) the likelihood decays as a power law with
      exponent <i>f</i>: the farther away, the less plausible it is that the offender lives there.
      <b>Inside the buffer</b> (d ≤ <i>B</i>) the term <i>grows</i> with distance: this models the
      <i>buffer zone</i>, the area immediately around the anchor point that an offender tends to
      avoid so as not to be recognised. The maximum therefore falls on the <b>ring</b> of radius
      <i>B</i>, not on the event point itself.</p>
      <p class="note">The original formulation uses Manhattan distance, consistent with an urban
      street grid. You can select it in the “Metric” section.</p>`,
  'method.kde.desc': `
      <p><b>Kernel density estimation</b>. Each event point is replaced by a Gaussian of
      width <i>σ</i>, and the Gaussians are summed:</p>
      <p class="formula">p(i) ∝ Σ<sub>n</sub> exp( − d<sub>n</sub>² / 2σ² )</p>
      <p>It describes <b>where the events cluster</b>, not where the offender lives: it carries
      no <i>buffer zone</i> assumption whatsoever. It is the natural baseline against which to
      compare genuine geographic profiling models.</p>
      <p class="note">Small <i>σ</i> → a surface fragmented around individual points;
      large <i>σ</i> → a single blob centred on the mean centre.</p>`,
  'method.meanCenter.desc': `
      <p><b>Centrographic model</b>. A single isotropic Gaussian centred on the mean centre
      of the event points:</p>
      <p class="formula">p(i) ∝ exp( − d(i, C)² / 2σ² )</p>
      <p>where <i>C</i> is the mean centre and <i>σ</i> the standard distance of the points from
      <i>C</i>, multiplied by the scale factor.</p>
      <p class="note">It is the simplest and most fragile model: a single distant event shifts
      <i>C</i> appreciably. The “Results” panel also reports the <b>geometric median</b>, a robust
      alternative estimator.</p>`,
  'method.journey.desc': `
      <p><b>Journey-to-crime model</b> with exponential decay. It assumes each anchor→event trip
      is independent, with a probability that decays exponentially with distance:</p>
      <p class="formula">log p(i) = − λ · Σ<sub>n</sub> d<sub>n</sub> + const.</p>
      <p>The parameter <i>λ</i> is the inverse of a characteristic distance: the
      <b>half distance</b> is <i>d</i><sub>½</sub> = ln2 / λ.</p>
      <p class="note">By summing distances, the model strongly favours locations with the smallest
      aggregate distance: the surface tends to concentrate around the <b>geometric median</b>.
      The computation runs on a log scale, so it stays accurate even with large λ and many points.</p>`,

  'model.err.unknown': 'Unknown model: {method}',
  'model.err.noPoints': 'No event points.',

  'param.buffer': 'Buffer <i>B</i>',
  'param.decay': 'Decay <i>f</i>',
  'param.compensation': 'Compensation <i>g</i>',
  'param.bandwidth': 'Bandwidth <i>σ</i>',
  'param.autoSigma': 'Automatic estimate (Silverman)',
  'param.scale': 'Scale <i>σ</i>',
  'param.scale.hint': 'σ is derived from the standard distance of the points from the mean centre, multiplied by this factor.',
  'param.lambda': 'Lambda <i>λ</i>',
  'param.lambda.hint': 'Half distance <i>d<sub>½</sub></i> = ln2/λ = ',

  'model.grid.title': 'Metric & grid',
  'model.metric.label': 'Distance metric',
  'model.metric.haversine': 'Geodesic Euclidean (great-circle)',
  'model.metric.manhattan': 'Manhattan (urban grid)',
  'model.metric.hint': 'Rossmo formulated CGT on Manhattan distance, suited to urban street grids. Outside built-up areas the geodesic metric is usually more realistic.',
  'model.grid.auto': 'Automatic resolution',
  'model.grid.step': 'Grid step',
  'model.grid.hint': 'The grid adapts to the extent of the points, targeting ~40,000 cells.',
  'model.grid.active': 'Active grid: {nx} × {ny} cells ({n}), {step} m step on the ground.',

  'model.run': 'Compute surface',
  'model.rerun': 'Recompute surface',
  'model.running': 'Computing…',
  'model.clearSurface': 'Remove surface',
  'model.how.title': 'How it works',

  /* ── View tab ── */
  'view.surface.title': 'Surface',
  'view.colormap.label': 'Colour scale',
  'view.colormap.viridis': 'Viridis - perceptually uniform',
  'view.colormap.inferno': 'Inferno',
  'view.colormap.magma': 'Magma',
  'view.colormap.cividis': 'Cividis - colour-blind friendly',
  'view.colormap.ice': 'Ice - single hue',
  'view.colorScale.label': 'Value mapping',
  'view.colorScale.percentile': 'Area percentile (recommended)',
  'view.colorScale.linear': 'Linear in probability',
  'view.colorScale.hint': 'Percentile mapping guarantees the area of interest stays readable, whatever the dynamic range of the model.',
  'view.opacity': 'Opacity',
  'view.threshold': 'Lower threshold',
  'view.threshold.hint': 'Hides cells below the given percentile: useful to isolate the high-probability core.',
  'view.contours': 'Contours at percentiles 50 / 75 / 90 / 95 / 99',

  'view.map.title': 'Map',
  'view.basemap.label': 'Basemap',
  'view.basemap.dark': 'CARTO Dark Matter',
  'view.basemap.light': 'CARTO Positron',
  'view.basemap.osm': 'OpenStreetMap standard',
  'view.showLabels': 'Permanent labels on points',
  'view.showCentro': 'Centrographic markers (mean centre, geometric median)',
  'view.showEllipse': 'Standard deviational ellipse (1σ)',

  'view.ui.title': 'Interface',
  'view.theme.label': 'Theme',
  'view.theme.dark': 'Dark',
  'view.theme.light': 'Light',
  'view.theme.auto': 'Follow the system',

  /* ── Results tab ── */
  'res.peaks.title': 'Probability peaks',
  'res.peaks.hint': 'Local maxima of the surface, sorted by decreasing probability. They are the operational output of a geoprofile: the areas to search first.',
  'res.peaks.empty': 'Compute a surface to obtain the peaks.',
  'res.peaks.intensity': 'intensity {p}% of the main peak',
  'res.peaks.top': 'top {p}%',
  'res.peaks.topTitle': 'Fraction of the study area to search in order to reach this peak',

  'res.hit.title': 'Hit score',
  'res.hit.hint': 'The standard metric for evaluating a geoprofile: the percentage of the study area to be searched, following the probability ordering, before reaching a hypothesised anchor point. The lower it is, the more informative the profile.',
  'res.hit.setAnchor': 'Place anchor hypothesis',
  'res.hit.clickMap': 'Click on the map… (Esc to cancel)',
  'res.hit.clearAnchor': 'Remove anchor',
  'res.hit.score': 'Hit score',
  'res.hit.area': 'Area to search',
  'res.hit.coord': 'Coordinates',
  'res.hit.needSurface': 'compute the surface first',
  'res.hit.outOfGrid': 'outside the grid',
  'res.hit.areaOf': '{search} of {total}',

  'res.stats.title': 'Centrographic statistics',
  'res.stats.empty': 'At least 2 points are required.',
  'res.stats.span': 'Maximum extent',
  'res.stats.centroid': 'Mean centre',
  'res.stats.median': 'Geometric median',
  'res.stats.sd': 'Standard distance',
  'res.stats.nnMedian': 'Nearest neighbour (median)',
  'res.stats.nnRange': 'Nearest neighbour (min–max)',
  'res.stats.ellipse': '1σ ellipse (semi-axes)',
  'res.stats.azimuth': 'Major axis azimuth',

  /* ── Info tab ── */
  'info.warn.title': 'Disclaimer',
  'info.warn.body': 'The surfaces produced are <b>indicative and educational</b>. They depend decisively on the points entered, on the scale, on the metric and on the chosen parameters. They are not evidence, they do not replace investigative work and they do not identify people. The application performs no autonomous inference and no temporal correlation: it processes only the points supplied.',

  'info.ref.title': 'Reference values - MoF case',
  'info.ref.hint': 'Empirical starting points, to be checked case by case. “Apply” sets the method and its parameters.',
  'info.ref.a': '<b>A.</b> Province scale - full series',
  'info.ref.b': '<b>B.</b> South-West cluster',
  'info.ref.c': '<b>C.</b> North-East cluster',
  'info.ref.a.rossmo': '<i>B</i>=2.5 km · <i>f</i>=1.2 · <i>g</i>=1.6',
  'info.ref.a.kde': '<i>σ</i>=2.8 km',
  'info.ref.a.mc': 'scale 1.1×',
  'info.ref.a.jtc': '<i>λ</i>=0.25 (<i>d</i><sub>½</sub>≈2.8 km)',
  'info.ref.b.rossmo': '<i>B</i>=1.0 km · <i>f</i>=1.4 · <i>g</i>=1.8',
  'info.ref.b.kde': '<i>σ</i>=0.9 km',
  'info.ref.b.mc': 'scale 0.9×',
  'info.ref.b.jtc': '<i>λ</i>=0.60',
  'info.ref.c.rossmo': '<i>B</i>=1.2 km · <i>f</i>=1.3 · <i>g</i>=1.7',
  'info.ref.c.kde': '<i>σ</i>=1.2 km',
  'info.ref.c.mc': 'scale 1.0×',
  'info.ref.c.jtc': '<i>λ</i>=0.50',

  'info.choose.title': 'How to choose the parameters',
  'info.choose.grid': '<b>Grid step</b> - roughly 1/200 of the bounding box diagonal; the automatic mode works it out for you.',
  'info.choose.buffer': '<b>Buffer <i>B</i></b> - the order of magnitude of the “buffer zone” around the anchor: 0.8–1.5 km on clusters, 2–3 km at province scale.',
  'info.choose.fg': '<b><i>f</i> and <i>g</i></b> - decay exponents outside and inside the buffer: <i>f</i> 1.2–1.5, <i>g</i> 1.6–1.9.',
  'info.choose.sigma': '<b>σ (KDE)</b> - Silverman\'s estimate is a good starting point; alternatively 0.8× the median nearest-neighbour distance.',
  'info.choose.lambda': '<b>λ (JTC)</b> - pick a plausible half distance <i>d</i><sub>½</sub> and set λ = ln2 / <i>d</i><sub>½</sub>.',

  'info.opinion.title': 'Author\'s opinion',
  'info.opinion.body': 'The author believes, <b>as a purely personal view</b>, that the “Rosso del Mugello” lead is the most solid among the hypotheses considered. It is an opinion, not an established fact, and it does not follow from the calculations of this application.',

  'info.privacy.title': 'Privacy and data',
  'info.privacy.p1': 'The computation runs <b>entirely in the browser</b>: no event point leaves your device. The points you enter are stored only in <code>localStorage</code>, locally.',
  'info.privacy.p2': 'Outbound traffic covers: the CDN libraries (unpkg), the map tiles (OpenStreetMap / CARTO) and <b>Google Analytics</b>, which collects aggregate browsing statistics. You can block it with any content blocker without losing any functionality.',

  'info.credits.title': 'Credits',
  'info.credits.maps': 'Cartography © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a> contributors · tiles © <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">CARTO</a>.',
  'info.credits.engine': 'Map engine: <a href="https://leafletjs.com/" target="_blank" rel="noopener noreferrer">Leaflet 1.9.4</a>. No other dependency.',
  'info.credits.colormaps': 'Colour scales: viridis, inferno, magma, cividis (matplotlib, CC0 licence).',
  'info.credits.license': 'Project licence: BSD 2-Clause · © 2025 Giuseppe Sorgentone.',
  'info.credits.tutorial': 'Replay the tutorial',
  'info.credits.reset': 'Restore factory settings',

  /* ── Map overlays ── */
  'kpi.points': 'Points',
  'kpi.cells': 'Cells',
  'kpi.res': 'Resolution',
  'kpi.time': 'Compute',

  'legend.title': 'Relative probability',
  'legend.stale': 'out of date',
  'legend.stale.title': 'The points or the parameters changed after the last computation',
  'legend.collapse': 'Collapse legend',
  'legend.expand': 'Expand legend',
  'legend.ramp': 'Colour scale from lowest to highest probability',
  'legend.low': 'low',
  'legend.high': 'high',
  'legend.percentile': 'Area percentile',
  'legend.linear': 'Cell probability',
  'legend.halfMax': '½ max',
  'legend.contourNote': 'Contours at percentiles {levels}. ',
  'legend.notePercentile': 'The colour shows how much of the study area has a lower probability.',
  'legend.noteLinear': 'The colour is proportional to the probability of the cell.',

  /* ── Map ── */
  'map.anchor': 'Anchor hypothesis',
  'map.centroid': 'Mean centre',
  'map.median': 'Geometric median',

  /* ── Tutorial ── */
  'tut.eyebrow': 'Welcome',
  'tut.intro': 'An educational <b>criminal geographic profiling</b> tool. Starting from a series of georeferenced event points, it estimates where the offender\'s <i>anchor point</i> (home, workplace, operating base) is most likely to be.',
  'tut.step1': '<b>Load the points</b> - use the MoF dataset in the <i>Data</i> tab, or click on the map.',
  'tut.step2': '<b>Choose the model</b> - Rossmo/CGT, KDE, centre of gravity or journey-to-crime, in the <i>Model</i> tab.',
  'tut.step3': '<b>Compute</b> - the surface appears on the map with percentile contours; the peaks are listed under <i>Results</i>.',
  'tut.warn': 'The surfaces are indicative and educational: they are not evidence and do not replace investigative work.',
  'tut.start': 'Start',

  /* ── File guard ── */
  'guard.title': 'A local server is required',
  'guard.p1': 'This page uses JavaScript modules, which browsers refuse to load over the <code>file://</code> protocol. Start a static server in the project folder:',
  'guard.p2': 'then open <code>http://localhost:8000</code>. Online (GitHub Pages) it works with no configuration at all.',

  /* ── Datasets and presets ── */
  'dataset.all': 'Full series',
  'dataset.sw': 'South-West cluster',
  'dataset.ne': 'North-East cluster',
  'preset.provinciale': 'Province scale',
  'preset.clusterSW': 'South-West cluster',
  'preset.clusterN': 'North-East cluster',

  /* ── Notifications ── */
  'toast.anchorSet': 'Anchor hypothesis placed.',
  'toast.anchorCleared': 'Anchor removed.',
  'toast.needPoint': 'Add at least one event point before computing.',
  'toast.computeFailed': 'Computation failed: {message}',
  'toast.needTwoPoints': 'At least 2 points are needed to estimate the bandwidth.',
  'toast.sigma': 'σ = {sigma} km (Silverman).',
  'toast.sigmaAlt': ' Nearest-neighbour alternative: {alt} km.',
  'toast.pointsCleared': 'Points removed. Ctrl+Z to undo.',
  'toast.presetApplied': 'Applied: {preset} - {method}.',
  'toast.linkCopied': 'Link copied to the clipboard.',
  'toast.linkFailed': 'Copy failed: select the URL manually.',
  'toast.nothingToExport': 'There are no points to export.',
  'toast.loaded': 'Loaded {n} event points.',
  'toast.badCoord': 'Coordinates not recognised. Expected format: “43.794588, 11.082310”.',
  'toast.noValidPoints': 'No valid point found in the file.',
  'toast.imported': 'Imported {n} points.',
  'toast.importedSkipped': 'Imported {n} points ({skipped} rows ignored).',
  'toast.fileUnreadable': 'File not readable: {message}',
  'toast.sharedLoaded': 'Loaded {n} points from the shared link.',
  'toast.settingsReset': 'Settings restored.',
  'confirm.resetAll': 'Restore factory settings and delete all points?',
};

const DICT = { it: IT, en: EN };

/* ═══════════════════════════ Stato ═══════════════════════════ */

/** Preferenza esplicita nell'URL: `?lang=en` oppure `#…&lang=en`. */
export function langFromUrl() {
  try {
    const search = new URLSearchParams(location.search).get('lang');
    if (LANGS.includes(search)) return search;
    const hash = new URLSearchParams(location.hash.replace(/^#/, '')).get('lang');
    if (LANGS.includes(hash)) return hash;
  } catch { /* URL malformato: irrilevante */ }
  return null;
}

/** Preferenza salvata dallo store (`'it' | 'en' | 'auto'`). */
function storedPreference() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const lang = raw ? JSON.parse(raw)?.settings?.lang : null;
    return typeof lang === 'string' ? lang : null;
  } catch {
    return null;
  }
}

/**
 * Risolve una preferenza in una lingua concreta. `'auto'` (o un valore ignoto)
 * interroga il browser; se nessuna delle lingue dichiarate è supportata si
 * ripiega sull'inglese, la scelta più utile per un visitatore internazionale.
 */
export function resolveLang(pref) {
  if (LANGS.includes(pref)) return pref;
  const declared = navigator.languages?.length ? navigator.languages : [navigator.language || ''];
  for (const tag of declared) {
    const base = String(tag).toLowerCase().slice(0, 2);
    if (LANGS.includes(base)) return base;
  }
  return 'en';
}

let current = resolveLang(langFromUrl() || storedPreference() || 'auto');

export const getLang = () => current;
export const locale = () => LOCALES[current] || LOCALES.it;

export function setLang(lang) {
  current = LANGS.includes(lang) ? lang : 'it';
  document.documentElement.lang = current;
  return current;
}

/* ═══════════════════════════ Traduzione ═══════════════════════════ */

const interpolate = (s, vars) =>
  (vars ? s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : s);

/**
 * Testo tradotto per `key`. In assenza di traduzione ripiega sull'italiano —
 * lingua di riferimento del progetto — e infine sulla chiave stessa, così una
 * voce mancante è visibile in sviluppo invece di sparire.
 */
export function t(key, vars) {
  const s = DICT[current]?.[key] ?? DICT.it[key];
  return s === undefined ? key : interpolate(s, vars);
}

/* ═══════════════════════════ Applicazione al DOM ═══════════════════════════ */

const BINDINGS = [
  ['data-i18n', (node, value) => { node.textContent = value; }],
  ['data-i18n-html', (node, value) => { node.innerHTML = value; }],
  ['data-i18n-title', (node, value) => node.setAttribute('title', value)],
  ['data-i18n-label', (node, value) => node.setAttribute('aria-label', value)],
  ['data-i18n-ph', (node, value) => node.setAttribute('placeholder', value)],
];

const setMeta = (selector, value) => document.head.querySelector(selector)?.setAttribute('content', value);

/** Titolo, descrizione e metadati social nella lingua corrente. */
function applyDocumentMeta() {
  document.title = t('doc.title');
  setMeta('meta[name="description"]', t('doc.description'));
  setMeta('meta[property="og:title"]', t('doc.title'));
  setMeta('meta[property="og:description"]', t('doc.ogDescription'));
  setMeta('meta[property="og:locale"]', t('doc.locale'));
  setMeta('meta[name="twitter:title"]', t('doc.title'));
  setMeta('meta[name="twitter:description"]', t('doc.twitterDescription'));
}

/**
 * Riscrive tutti i nodi annotati. Va richiamata a ogni cambio di lingua; i
 * testi generati da JavaScript (elenchi, legenda, notifiche) sono invece
 * responsabilità dei rispettivi `render*`.
 */
export function applyI18n(root = document) {
  for (const [attr, assign] of BINDINGS) {
    for (const node of root.querySelectorAll(`[${attr}]`)) {
      assign(node, t(node.getAttribute(attr)));
    }
  }
  if (root === document) applyDocumentMeta();
}
