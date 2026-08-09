# Criminal Geoprofiler - Mostro di Firenze

Strumento didattico di **geoprofilazione criminale**, interamente lato client. A partire da una serie di
punti-evento georiferiti calcola una **superficie di probabilità** del punto di ancoraggio dell'autore
(residenza, luogo di lavoro, base operativa) con quattro modelli classici, e la rende come raster
continuo con isolinee ai percentili d'area.

**Demo:** <https://cepeppe.github.io/criminal-geoprofiler/>

> ⚠️ I risultati sono **indicativi e didattici**. Dipendono in modo determinante dai punti inseriti,
> dalla scala, dalla metrica e dai parametri. Non costituiscono prova, non sostituiscono l'attività
> investigativa e non identificano persone.

---

## Indice

- [Cosa fa](#cosa-fa)
- [Modelli implementati](#modelli-implementati)
- [Come vengono rese le superfici](#come-vengono-rese-le-superfici)
- [Metriche di valutazione](#metriche-di-valutazione)
- [Struttura del progetto](#struttura-del-progetto)
- [Avvio in locale](#avvio-in-locale)
- [Deploy](#deploy)
- [Import / export](#import--export)
- [Scorciatoie da tastiera](#scorciatoie-da-tastiera)
- [Valori di riferimento - caso MdF](#valori-di-riferimento--caso-mdf)
- [Privacy e dati](#privacy-e-dati)
- [Limiti noti](#limiti-noti)
- [Licenza](#licenza)

---

## Cosa fa

- **Punti-evento**: dataset storico del caso Mostro di Firenze (8 episodi, 1968–1985, con due cluster
  geografici), inserimento per clic su mappa o per coordinate, import CSV/GeoJSON.
- **Quattro modelli** di geoprofilazione con parametri regolabili e due metriche di distanza
  (geodetica e Manhattan).
- **Superficie di probabilità** resa come raster continuo con isolinee ai percentili d'area, cinque
  scale cromatiche percettivamente uniformi, soglia e opacità regolabili.
- **Picchi di probabilità** estratti automaticamente: le aree da esaminare per prime, in ordine.
- **Hit score**: valutazione quantitativa del profilo rispetto a un'ipotesi di ancoraggio.
- **Statistiche centrografiche**: baricentro, mediana geometrica, distanza standard, primo vicino,
  ellisse di deviazione standard.
- Persistenza locale, annulla/ripeti, condivisione dello stato via URL, tema chiaro/scuro.

Nessun backend, nessuna build, nessun framework. L'unica dipendenza è Leaflet.

---

## Modelli implementati

Tutti i modelli producono un campo di **log-verosimiglianza**, convertito in probabilità una sola volta
con il trucco log-sum-exp. Il risultato è una vera distribuzione discreta: la somma sulle celle è 1.
Questo elimina alla radice l'underflow numerico che affligge le implementazioni ingenue.

### Rossmo / CGT

```
p(i) = Σₙ [ φ · dₙ⁻ᶠ  +  (1−φ) · B^(g−f) / (2B − dₙ)^g ]        φ = 1 se dₙ > B, altrimenti 0
```

Fuori dal buffer la verosimiglianza decade come potenza di esponente `f`; **dentro** il buffer il
termine *cresce* con la distanza, modellando la *buffer zone* che l'autore tende a evitare. Il massimo
cade quindi sull'**anello** di raggio `B`, non sul punto-evento - è la firma caratteristica del modello.
La formulazione originale di Rossmo usa la distanza Manhattan, selezionabile nell'interfaccia.

### KDE - kernel gaussiano

```
p(i) ∝ Σₙ exp( −dₙ² / 2σ² )
```

Descrive dove si concentrano gli **eventi**, non dove risiede l'autore: non incorpora alcuna ipotesi di
buffer zone. È il riferimento naturale contro cui confrontare i modelli propriamente geoprofilanti.
Il pulsante *Stima automatica* calcola la bandwidth di Silverman per dati bidimensionali
(`h = σ·n^(−1/6)`) e propone in alternativa la stima da distanza al primo vicino, di norma più stretta
su dati clusterizzati.

### Centro di gravità

```
p(i) ∝ exp( −d(i, C)² / 2σ² )
```

Gaussiana isotropa centrata sul baricentro `C`, con `σ` pari alla distanza standard dei punti da `C`
per il fattore di scala. È il modello più semplice e più fragile: un singolo evento distante sposta
sensibilmente `C`. Per questo la scheda *Risultati* riporta anche la **mediana geometrica**, stimatore
robusto calcolato con l'algoritmo di Weiszfeld.

### Journey-to-crime

```
log p(i) = −λ · Σₙ dₙ + cost.
```

Decadimento esponenziale sulla distanza aggregata. `λ` è l'inverso di una distanza caratteristica:
la distanza di dimezzamento è `d½ = ln2 / λ`, mostrata in tempo reale nell'interfaccia. Il calcolo in
scala logaritmica resta accurato anche con `λ` elevati e molti punti, dove `exp(−λ·Σd)` collasserebbe
a zero in doppia precisione.

---

## Come vengono rese le superfici

La griglia di calcolo è costruita in **Web Mercator sferico** (EPSG:3857, lo stesso di Leaflet), così il
raster combacia al pixel con l'overlay e non subisce la deformazione che si otterrebbe stendendo una
griglia lat/lon su una mappa di Mercatore. Le **distanze** restano invece geodetiche, calcolate sulle
coordinate geografiche di ogni cella: proiezione e metrica sono separate.

Il campo viene disegnato su canvas con **ricampionamento bilineare** a risoluzione superiore a quella
della griglia (elimina l'effetto scacchiera senza inventare informazione) e sovrapposto come
`L.imageOverlay`.

**Mappatura per percentile d'area** (predefinita): il colore di una cella indica quanta parte dell'area
di studio ha probabilità inferiore. L'isolinea a 0,95 racchiude quindi *esattamente* il 5 % dell'area.
La zona di interesse resta leggibile qualunque sia l'intervallo dinamico del modello - non serve alcun
parametro di regolazione manuale. È disponibile anche la mappatura lineare sulla probabilità.

Le scale cromatiche (viridis, inferno, magma, cividis, tinta singola) sono tutte **monotone in
luminosità**: restano leggibili in scala di grigi e con deficit della visione dei colori.

---

## Metriche di valutazione

**Picchi di probabilità** - massimi locali della superficie con soppressione dei non-massimi, ordinati.
Per ciascuno viene indicata la frazione dell'area di studio da perlustrare per raggiungerlo.

**Hit score** - metrica standard di valutazione di un geoprofilo: posizionando un'ipotesi di
ancoraggio, indica quale percentuale dell'area di studio va perlustrata, seguendo l'ordine di
probabilità decrescente, prima di raggiungerla. Più è bassa, più il profilo è informativo. Un hit score
del 50 % equivale a una ricerca casuale.

---

## Struttura del progetto

```
.
├─ index.html            markup
├─ styles.css            design system a token, tema chiaro/scuro
├─ mostro.jpg            immagine del masthead
└─ js/
   ├─ main.js            orchestrazione: stato ↔ interfaccia ↔ mappa ↔ modelli
   ├─ mapview.js         tutto ciò che tocca Leaflet
   ├─ store.js           stato, annulla/ripeti, persistenza
   ├─ models.js          i quattro modelli, in scala logaritmica
   ├─ geo.js             geodesia, metriche, centrografia, griglia
   ├─ surface.js         raster, scale cromatiche, isolinee, picchi, hit score
   ├─ data.js            dataset MdF, preset, mappe di base
   ├─ io.js              CSV, GeoJSON, condivisione via URL
   └─ dom.js             utilità DOM, formattazione, modali accessibili
```

I moduli di calcolo (`geo`, `models`, `surface`) non conoscono né Leaflet né il DOM: sono verificabili
in isolamento con Node, senza browser.

---

## Avvio in locale

Serve un **server statico**: la pagina usa moduli ES, che i browser non caricano dal protocollo
`file://`. Aprendo `index.html` con un doppio clic compare un avviso con le istruzioni.

```bash
python -m http.server 8000
# oppure
npx serve . -p 8000
```

Poi apri <http://localhost:8000>.

---

## Deploy

Il repository è già configurato per **GitHub Pages** tramite `.github/workflows/static.yml`
(sorgente *GitHub Actions*, nessuna elaborazione Jekyll): a ogni push su `master` l'intera cartella
viene pubblicata così com'è.

Tutti i riferimenti a risorse locali sono **relativi**, quindi il sito funziona anche sotto il
sottopercorso di progetto (`/criminal-geoprofiler/`). Non serve alcuna build.

Per un altro hosting statico è sufficiente copiare la cartella.

---

## Import / export

**CSV in ingresso** - intestazione riconosciuta per nome di colonna: `lat`/`latitude`/`y` e
`lon`/`lng`/`longitude`/`x`, con `label` e `date` opzionali. Separatori accettati: virgola, punto e
virgola, tabulazione. In assenza di intestazione riconoscibile si assume l'ordine `lat, lon, label`.

**GeoJSON** - `FeatureCollection` di geometrie `Point`; le proprietà `label`/`name` e `date` vengono
lette se presenti.

**Esportazione** - CSV e GeoJSON. Il pulsante *Copia link condivisibile* codifica punti, modello e
parametri nel frammento dell'URL: chi apre il link ottiene lo stesso stato, senza che nulla transiti
da un server.

---

## Scorciatoie da tastiera

| Tasto | Azione |
|---|---|
| `Invio` | Calcola la superficie |
| `A` | Attiva/disattiva l'inserimento per clic |
| `F` | Inquadra tutti i punti |
| `Ctrl+Z` / `Ctrl+Y` | Annulla / ripeti |
| `Esc` | Esce dalla modalità corrente o chiude la finestra |

---

## Valori di riferimento - caso MdF

Punti di partenza empirici, applicabili con un clic dalla scheda *Info*. Vanno verificati caso per caso.

| Ambito | Rossmo/CGT | KDE | Centro di gravità | Journey-to-crime |
|---|---|---|---|---|
| Scala provinciale | B=2,5 km · f=1,2 · g=1,6 | σ=2,8 km | scala 1,1× | λ=0,25 (d½≈2,8 km) |
| Cluster Sud-Ovest | B=1,0 km · f=1,4 · g=1,8 | σ=0,9 km | scala 0,9× | λ=0,60 |
| Cluster Nord-Est | B=1,2 km · f=1,3 · g=1,7 | σ=1,2 km | scala 1,0× | λ=0,50 |

Il passo della griglia è calcolato automaticamente dall'estensione dei punti (obiettivo ~40 000 celle)
e resta comunque forzabile a mano.

---

## Privacy e dati

Il calcolo avviene **interamente nel browser**: nessun punto-evento lascia il dispositivo. I punti e le
preferenze sono salvati solo in `localStorage`, in locale.

Il traffico verso l'esterno riguarda: le librerie da CDN (unpkg), le tile cartografiche
(OpenStreetMap / CARTO) e **Google Analytics**, che raccoglie statistiche di navigazione aggregate.
Quest'ultimo è bloccabile con un qualsiasi content blocker senza perdere alcuna funzionalità.

---

## Limiti noti

- I modelli trattano ogni punto-evento come indipendente: nessuna correlazione temporale, nessuna
  ponderazione per attendibilità dell'attribuzione.
- La superficie è calcolata su spazio libero: non tiene conto di viabilità, orografia, distribuzione
  della popolazione o barriere. Sono estensioni possibili, non implementate.
- Il tetto di 260 000 celle previene il blocco del browser ma limita il dettaglio su aree molto estese
  con passo molto fine.
- Nessun geocoder: l'inserimento avviene per clic o per coordinate, non per indirizzo.
- Il dataset MdF è di dominio pubblico e riferito a **località**, non a persone. L'attribuzione dei
  singoli episodi alla serie è, in alcuni casi, dibattuta.

---

## Crediti e licenza

Cartografia © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors ·
tile © [CARTO](https://carto.com/attributions). Motore mappa: [Leaflet](https://leafletjs.com/) 1.9.4.
Scale cromatiche viridis, inferno, magma e cividis dal progetto matplotlib (CC0).

**Licenza:** BSD 2-Clause · © 2025 Giuseppe Sorgentone
