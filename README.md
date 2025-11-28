# Criminal Geoprofiler - Mostro di Firenze

Applicazione **100% client‑side** per sperimentare, in modo didattico, tecniche di *geoprofilazione* su una mappa interattiva.
L’app permette di inserire/gestire **punti‑evento** e di calcolare una **superficie di verosimiglianza** con più metodi noti
(es. *Rossmo/CGT*, *KDE gaussiana*, *Centro di gravità*, *Journey‑to‑crime*), visualizzandoli come **heatmap**.

> ⚠️ **Avvertenza**: i risultati sono **indicativi** e dipendono fortemente dai parametri inseriti,
> dalla qualità/completezza del dataset e dall’interpretazione. L’app non sostituisce in alcun modo
> l’attività investigativa ufficiale né costituisce prova.
---

## Indice

- [Caratteristiche](#caratteristiche)
- [Struttura del progetto](#struttura-del-progetto)
- [Prerequisiti](#prerequisiti)
- [Avvio rapido](#avvio-rapido)
- [Deploy statico (GitHub Pages / Netlify / Vercel)](#deploy-statico-github-pages--netlify--vercel)
- [Come si usa](#come-si-usa)
- [Metodi implementati](#metodi-implementati)
- [Parametri consigliati per il caso MdF](#parametri-consigliati-per-il-caso-mdf)
- [Responsive & Accessibilità](#responsive--accessibilità)
- [Limiti noti e roadmap](#limiti-noti-e-roadmap)
- [Privacy & Dati](#privacy--dati)
- [Crediti e licenza](#crediti-e-licenza)

---

## Caratteristiche

- UI reattiva con **Leaflet** e **Leaflet.heat** (tiles OpenStreetMap).
- Gestione **punti‑evento**: click su mappa, inserimento da coordinate, preset “Mostro di Firenze” (8 punti totali e cluster).
- **Algoritmi** disponibili: Rossmo/CGT, KDE (gaussiano), Centro di gravità (mean center), Journey‑to‑crime (decadimento esponenziale).
- **Parametri** regolabili + **preset** “provinciale / cluster SW / cluster N” per il caso MdF.
- **Heatmap** con passi di griglia configurabili e cap di sicurezza sulle celle.
- **Tutorial** iniziale + pulsante “About”. Modal con chiusura da ✕, *Esc* e click fuori.
- **Layout responsive**: su mobile la sidebar diventa un **drawer** (apertura da FAB ☰). Sidebar **ridimensionabile** su desktop.

> Nota: tutto gira **in locale** nel browser; non c’è backend. È necessaria la connessione a Internet solo per caricare le librerie via CDN e i tiles OSM.
---

## Struttura del progetto

```
.
├─ index.html        # markup e inclusioni
├─ styles.css        # stile (tema scuro, sidebar, modal, responsive)
├─ app.js            # logica: mappa, dataset, algoritmi, UI
└─ assets/
   └─ mostro.jpg     # immagine banner dietro al titolo (opzionale)
```

Puoi rinominare/ricollocare l’immagine del banner aggiornando l’URL in `styles.css` (`.app-title::before { background-image: ... }`).

---

## Prerequisiti

- Un browser moderno (Chrome, Edge, Firefox, Safari) **con JavaScript attivo**.
- Connessione Internet per i CDN (Leaflet, Leaflet.heat) e i tiles OSM.
- **Nessun** sistema di build richiesto: è una **static app**.

---

## Avvio rapido

**Metodo 1 - doppio click (solo per test veloce):**  
apri `index.html` direttamente dal filesystem. *Attenzione*: alcune policy dei browser potrebbero limitare funzionalità in `file://`.

**Metodo 2 - piccolo server statico (consigliato):**

- Python:
  ```bash
  python -m http.server 8000
  # poi apri http://localhost:8000
  ```

- Node (serve):
  ```bash
  npx serve . -p 8000
  ```

---

## Deploy statico (GitHub Pages / Netlify / Vercel)

Qualsiasi hosting statico va bene.  
**GitHub Pages** (branch `main` → `Settings > Pages > Deploy from branch > / (root)`), o pubblica la cartella su Netlify/Vercel trascinandola nel pannello.

Suggerimenti:
- Mantieni le librerie da CDN per semplicità, oppure effettua vendorizzazione se ti serve hardening/CSP.
- Rispetta la **Tile Usage Policy** di OpenStreetMap se pianifichi carichi elevati (valuta un provider tile dedicato).

---

## Come si usa

1. **Carica punti**: usa i preset MdF (tutti/cluster) oppure clicca sulla mappa. Clic su un marker → rimuove il punto.
2. **(Opzionale) Aggiunta da coordinate**: inserisci `lat, lon` nel campo dedicato e premi “Aggiungi”.
3. **Scegli il metodo** e regola i **parametri** (buffer, σ, λ…).
4. **Imposta la griglia** (passo in metri) e il **raggio heatmap**.
5. **Calcola & mostra**: genera l’heatmap. “Pulisci overlay” rimuove solo l’heatmap, non i marker.
6. **KPI**: numero celle e tempo di calcolo.

**Interazione con la UI**
- **Desktop**: la sidebar si ridimensiona trascinando il separatore verticale.
- **Mobile**: apri/chiudi la sidebar con il pulsante ☰ (FAB). I modal si chiudono con ✕, *Esc* o click fuori.

---

## Metodi implementati

- **Rossmo / CGT**: somma di termini *distance‑decay* con **buffer** (raggio *B*) per la *buffer zone* (probabilità ridotta in prossimità).
- **KDE (Gaussiana)**: kernel density; *σ* controlla la “spalmatura” dei punti.
- **Centro di gravità (mean center)**: gaussiana centrata sul baricentro; *σ* stimato dalle distanze e scalabile.
- **Journey‑to‑crime (esponenziale)**: verosimiglianza decrescente con *λ* in funzione della somma delle distanze.

Tutte le superfici sono **normalizzate** tra 0 e 1 per la resa in heatmap.

---

## Parametri consigliati per il caso MdF

Nel pannello dedicato trovi tre preset **(provinciale, cluster SW, cluster N)** che impostano:
- **Passo griglia** e **raggio heatmap**
- Valori tipici per **B, f, g (Rossmo)**, **σ (KDE)**, **scala σ (mean center)**, **λ (journey)**

> Sono linee guida empiriche utili per una **prima** esplorazione. Verifica sempre sul campo e con dati/contesto adeguati.
---

## Responsive & Accessibilità

- **Drawer mobile** con scrim e FAB ☰.
- **Modal** chiudibili da ✕, *Esc* e click sullo sfondo.
- **Contrasto** pensato per tema scuro; banner del titolo con velo scuro per leggibilità.
- No dipendenze da framework; **tab order** e focus follow naturali del browser.

---

## Limiti noti e roadmap

- Nessuna **persistenza** locale (es. salvataggio automatico dei punti) → possibile estensione (LocalStorage/URL share).
- Mancano **import/export** (CSV/GeoJSON) → feature da valutare.
- Parametrizzazione **limitata** dei kernel/metriche → estendibile.
- Nessun **geocoder** (indirizzo → coordinate).
- L’accuratezza dipende da **scala**, **passo della griglia** e **parametri**; il cap sulle celle (`MAX_CELLS = 12000`) evita freeze ma può ridurre il dettaglio.

---

## Privacy & Dati

- L’app **non invia** dati a server: tutto è calcolato nel **browser**.  
- L’unico traffico esterno riguarda **librerie CDN** e **map tiles** da OSM.

---

## Crediti e licenza

- Mappe: © OpenStreetMap contributors - tiles tramite `tile.openstreetmap.org`.
- Librerie: [Leaflet](https://leafletjs.com/), [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat).

**Licenza**: BSD 2-Clause License

Copyright© 2025, Giuseppe Sorgentone