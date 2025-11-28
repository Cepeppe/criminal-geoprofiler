/* Criminal Geoprofiler — Mostro di Firenze (responsive + modal fix) */

(() => {
  // --- Map init ---
  const map = L.map('map', { zoomControl: true }).setView([41.9028, 12.4964], 12);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors'
  }).addTo(map);

  // State
  let addMode = true;
  let markers = []; // {marker, lat, lng}
  let heatLayer = null;

  // UI refs
  const addModeState = document.getElementById('addModeState');
  const kpiCount = document.getElementById('kpiCount');
  const kpiGrid  = document.getElementById('kpiGrid');
  const kpiTime  = document.getElementById('kpiTime');
  const pointsList = document.getElementById('pointsList');
  const methodSelect = document.getElementById('method');
  const methodDesc   = document.getElementById('methodDesc');
  const gridStepEl   = document.getElementById('gridStep');
  const heatRadiusEl = document.getElementById('heatRadius');
  const rossmoBEl = document.getElementById('rossmoB');
  const rossmoFEl = document.getElementById('rossmoF');
  const rossmoGEl = document.getElementById('rossmoG');
  const kdeSigmaEl = document.getElementById('kdeSigma');
  const mcScaleEl = document.getElementById('mcScale');
  const journeyLambdaEl = document.getElementById('journeyLambda');

  // Tutorial modal
  const modal     = document.getElementById('tutorialModal');
  const openTut   = document.getElementById('openTutorial');
  const closeTut  = document.getElementById('closeTutorial');
  const startApp  = document.getElementById('startApp');

  // Mobile drawer
  const toggleSidebarBtn = document.getElementById('toggleSidebar');
  const closeSidebarBtn  = document.getElementById('closeSidebar');
  const scrim            = document.getElementById('sidebarScrim');

  // --- Descrizioni ---
  const DESCRIPTIONS = {
    rossmo: `<b>Rossmo / Criminal Geographic Targeting (CGT)</b><br/>Modello con distance-decay e buffer zone (B).`,
    kde: `<b>Kernel Density Estimation (KDE)</b><br/>Superficie continua con kernel gaussiano (σ).`,
    meanCenter: `<b>Centro di gravità</b><br/>Gaussiana centrata sul baricentro, scala σ dalle distanze.`,
    journey: `<b>Journey-to-crime</b><br/>Decadimento esponenziale con λ sulla somma delle distanze.`
  };
  function updateDescription(){ methodDesc.innerHTML = DESCRIPTIONS[methodSelect.value] || ''; }
  updateDescription();
  methodSelect.addEventListener('change', () => {
    for (const id of ['params-rossmo','params-kde','params-meanCenter','params-journey']){
      const el = document.getElementById(id); if (el) el.style.display = 'none';
    }
    const panel = document.getElementById(`params-${methodSelect.value}`);
    if (panel) panel.style.display = 'block';
    updateDescription();
  });

  // --- Map interactions & points ---
  map.on('click', (e) => { if (addMode) addPoint(e.latlng.lat, e.latlng.lng); });

  document.getElementById('btnToggleAdd').onclick = () => {
    addMode = !addMode; addModeState.textContent = addMode ? 'ON' : 'OFF';
  };
  document.getElementById('btnUndo').onclick = () => {
    const last = markers.pop(); if (last){ map.removeLayer(last.marker); refreshList(); }
  };
  document.getElementById('btnClear').onclick = () => { markers.forEach(m => map.removeLayer(m.marker)); markers = []; refreshList(); };
  document.getElementById('btnClearOverlay').onclick = clearOverlay;
  document.getElementById('btnRun').onclick = runAnalysis;

  // Parse coordinate input
  const coordInputEl = document.getElementById('coordInput');
  const btnAddCoordEl = document.getElementById('btnAddCoord');
  btnAddCoordEl?.addEventListener('click', () => {
    const s = (coordInputEl.value || '').trim();
    let lat, lon;
    if (s.includes(',')){ const [a,b] = s.split(','); lat = parseFloat(a); lon = parseFloat(b); }
    else { const ws = s.split(/\s+/); if (ws.length===2){ lat=parseFloat(ws[0]); lon=parseFloat(ws[1]); } }
    if (!isFinite(lat) || !isFinite(lon) || lat<-90 || lat>90 || lon<-180 || lon>180){ alert('Formato non valido. Usa "lat, lon".'); return; }
    addPoint(lat, lon); map.panTo([lat, lon]); coordInputEl.value = '';
  });

  function addPoint(lat, lng, label){
    const marker = L.marker([lat, lng], { draggable:false }).addTo(map);

    // Etichetta sopra il segnaposto (se fornita)
    if (label){
    const labelHtml = label
      .replace(/\s—\s/, '<br>')   // em dash
      .replace(/\s-\s/, '<br>');  // fallback su trattino normale

    marker.bindTooltip(labelHtml, {
      permanent: true,
      direction: 'top',
      offset: [0, -8],
      className: 'point-label'
    });
  }

    marker.on('click', () => {
      const idx = markers.findIndex(m => m.marker === marker);
      if (idx >= 0){ markers.splice(idx,1); map.removeLayer(marker); refreshList(); }
    });

    markers.push({marker, lat, lng, label});
    refreshList();
  }

  function refreshList(){
    kpiCount.textContent = markers.length.toString();
    pointsList.innerHTML = '';

    markers.forEach((m, i) => {
      const li = document.createElement('li');

      if (m.label){
        // Split su " — " (em dash) o " - "
        const parts = m.label.split(/\s—\s|\s-\s/);
        const date  = parts[0] || m.label;
        const place = parts.slice(1).join(' — ') || '';

        li.innerHTML = `
          <span class="idx">#${i+1}</span>
          <span class="lbl">
            <span class="date">${date}</span>
            ${place ? `<br><span class="place">${place}</span>` : ''}
          </span>`;
      } else {
        li.innerHTML = `
          <span class="idx">#${i+1}</span>
          <span class="lbl">${m.lat.toFixed(5)}, ${m.lng.toFixed(5)}</span>`;
      }

      pointsList.appendChild(li);
    });
  }


  function clearOverlay(){
    if (heatLayer){ map.removeLayer(heatLayer); heatLayer = null; }
    kpiGrid.textContent = '–'; kpiTime.textContent = '–';
  }

  // --- Math helpers ---
  const R_EARTH_KM = 6371.0;
  const toRad = (x) => x * Math.PI / 180;
  const haversineKm = (lat1, lon1, lat2, lon2) => {
    const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    const la1 = toRad(lat1), la2 = toRad(lat2);
    const a = Math.sin(dLat/2)**2 + Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
    return 2 * R_EARTH_KM * Math.asin(Math.sqrt(a));
  };
  const metersToDegLat = (m) => m / 111320;
  const metersToDegLng = (m, lat) => m / (111320 * Math.cos(toRad(lat)));
  const boundsFromPoints = (pts) => {
    const lats = pts.map(p=>p.lat), lngs = pts.map(p=>p.lng);
    return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
  };
  const padBounds = (b, padM) => {
    const centerLat = (b.minLat + b.maxLat)/2;
    const dLat = metersToDegLat(padM), dLng = metersToDegLng(padM, centerLat);
    return { minLat:b.minLat-dLat, maxLat:b.maxLat+dLat, minLng:b.minLng-dLng, maxLng:b.maxLng+dLng };
  };
  function generateGrid(bounds, stepM){
    const centerLat = (bounds.minLat + bounds.maxLat)/2;
    const dLat = metersToDegLat(stepM), dLng = metersToDegLng(stepM, centerLat);
    const grid = [];
    for (let lat=bounds.minLat; lat<=bounds.maxLat; lat+=dLat){
      for (let lng=bounds.minLng; lng<=bounds.maxLng; lng+=dLng){
        grid.push({lat, lng, value:0});
      }
    }
    return grid;
  }
  function normalizeValues(grid){
    let min=Infinity, max=-Infinity;
    for (const c of grid){ if (c.value < min) min=c.value; if (c.value > max) max=c.value; }
    const span = max-min || 1;
    for (const c of grid){ c.value = (c.value - min) / span; }
  }

  // --- Algorithms ---
  function runRossmo(grid, points, B_km, f, g){
    for (const cell of grid){
      let s = 0;
      for (const p of points){
        const d = haversineKm(cell.lat, cell.lng, p.lat, p.lng);
        const term2 = Math.pow(B_km, g) / Math.pow(d + B_km, g);
        s += (d <= B_km) ? term2 : Math.pow(d, -f) + term2;
      }
      cell.value = s;
    }
    normalizeValues(grid);
  }
  function runKDE(grid, points, sigma_km){
    const twoSigma2 = 2 * sigma_km * sigma_km;
    for (const cell of grid){
      let dens = 0;
      for (const p of points){
        const d = haversineKm(cell.lat, cell.lng, p.lat, p.lng);
        dens += Math.exp(-(d*d)/twoSigma2);
      }
      cell.value = dens;
    }
    normalizeValues(grid);
  }
  function runMeanCenter(grid, points, scale){
    const meanLat = points.reduce((a,p)=>a+p.lat,0)/points.length;
    const meanLng = points.reduce((a,p)=>a+p.lng,0)/points.length;
    const ds = points.map(p => haversineKm(meanLat, meanLng, p.lat, p.lng));
    let sigma = Math.sqrt(ds.reduce((a,x)=>a+x*x,0)/points.length) || 0.5; // km
    sigma *= Math.max(0.1, scale);
    const twoSigma2 = 2 * sigma * sigma;
    for (const cell of grid){
      const d = haversineKm(cell.lat, cell.lng, meanLat, meanLng);
      cell.value = Math.exp(-(d*d)/twoSigma2);
    }
    normalizeValues(grid);
  }
  function runJourney(grid, points, lambda){
    for (const cell of grid){
      let sumD = 0;
      for (const p of points){ sumD += haversineKm(cell.lat, cell.lng, p.lat, p.lng); }
      cell.value = Math.exp(-lambda * sumD);
    }
    normalizeValues(grid);
  }

  // --- Runner ---
  function runAnalysis(){
    clearOverlay();
    if (markers.length < 1){ alert('Aggiungi almeno un punto.'); return; }

    const pts = markers.map(m=>({lat:m.lat, lng:m.lng}));
    const base = boundsFromPoints(pts);
    const stepM = Math.max(50, Number(gridStepEl.value) || 300);
    const bounds = padBounds(base, stepM * 6);

    let grid = generateGrid(bounds, stepM);
    const MAX_CELLS = 12000;
    if (grid.length > MAX_CELLS){
      const factor = Math.sqrt(grid.length / MAX_CELLS);
      grid = generateGrid(bounds, stepM * Math.ceil(factor));
    }

    const t0 = performance.now();
    switch (methodSelect.value){
      case 'rossmo':    runRossmo(grid, pts, Math.max(0.05, +rossmoBEl.value||1.0), Math.max(0.5, +rossmoFEl.value||1.2), Math.max(0.5, +rossmoGEl.value||1.8)); break;
      case 'kde':       runKDE(grid, pts, Math.max(0.05, +kdeSigmaEl.value||1.2)); break;
      case 'meanCenter':runMeanCenter(grid, pts, Math.max(0.1, +mcScaleEl.value||1.0)); break;
      case 'journey':   runJourney(grid, pts, Math.max(0.05, +journeyLambdaEl.value||0.7)); break;
    }
    const t1 = performance.now();

    heatLayer = L.heatLayer(grid.map(c => [c.lat, c.lng, c.value]), {
      radius: Math.max(10, +heatRadiusEl.value||18), blur: 18, maxZoom: 17
    }).addTo(map);

    map.fitBounds([[bounds.minLat, bounds.minLng],[bounds.maxLat, bounds.maxLng]], {padding:[20,20]});
    kpiGrid.textContent = `${grid.length} celle (~${Math.round(Math.sqrt(grid.length))}×${Math.round(Math.sqrt(grid.length))})`;
    kpiTime.textContent = `${(t1 - t0).toFixed(0)} ms`;
  }

  // --- Sidebar resizer (desktop only) ---
  (function(){
    const resizer = document.getElementById('resizer');
    if (!resizer) return;
    let dragging = false;
    const MIN = 260, MAX = 640;
    resizer.addEventListener('mousedown', (e)=>{ if (isMobile()) return;
      dragging = true; document.body.classList.add('resizing'); e.preventDefault(); });
    window.addEventListener('mousemove', (e)=>{ if (!dragging) return;
      const w = Math.min(MAX, Math.max(MIN, e.clientX));
      document.documentElement.style.setProperty('--sidebar-w', w + 'px'); map.invalidateSize({animate:false}); });
    window.addEventListener('mouseup', ()=>{ dragging = false; document.body.classList.remove('resizing'); });
  })();

  
  // --- Dataset & presets ---
  // DOPO: etichette con data + luogo (tabella fornita)
  const MOSTRO_ALL = [
    { label: '21 ago 1968 — Castelletti di Signa',                         lat: 43.794588, lng: 11.082310 },
    { label: '14 set 1974 — Fontanine di Rabatta (Sagginale, Borgo San Lorenzo)', lat: 43.939006, lng: 11.416401 },
    { label: '6 giu 1981 — Mosciano (Scandicci)',                          lat: 43.733137, lng: 11.168896 },
    { label: '22 ott 1981 — Le Bartoline (Travalle, Calenzano)',           lat: 43.871624, lng: 11.159006 },
    { label: '19 giu 1982 — Baccaiano (Montespertoli)',                    lat: 43.654490, lng: 11.090818 },
    { label: '9 set 1983 — Giogoli (Galluzzo, Firenze)',                   lat: 43.732229, lng: 11.206382 },
    { label: '29 lug 1984 — La Boschetta (Vicchio)',                       lat: 43.918821, lng: 11.497872 },
    { label: '7 8 set 1985 — Scopeti (San Casciano in Val di Pesa)',       lat: 43.694574, lng: 11.202129 }
  ];

  const CLUSTER_SW = [
    { label: '6 giu 1981 — Mosciano (Scandicci)',                          lat: 43.733137, lng: 11.168896 },
    { label: '9 set 1983 — Giogoli (Galluzzo, Firenze)',                   lat: 43.732229, lng: 11.206382 },
    { label: '7-8 set 1985 — Scopeti (San Casciano in Val di Pesa)',       lat: 43.694574, lng: 11.202129 },
    { label: '19 giu 1982 — Baccaiano (Montespertoli)',                    lat: 43.654490, lng: 11.090818 }
  ];

  const CLUSTER_N = [
    { label: '22 ott 1981 — Le Bartoline (Travalle, Calenzano)',           lat: 43.871624, lng: 11.159006 },
    { label: '14 set 1974 — Fontanine di Rabatta (Sagginale, Borgo San Lorenzo)', lat: 43.939006, lng: 11.416401 },
    { label: '29 lug 1984 — La Boschetta (Vicchio)',                       lat: 43.918821, lng: 11.497872 }
  ];
  function removeAllMarkers(){ markers.forEach(m => map.removeLayer(m.marker)); markers = []; refreshList(); }
  function loadPoints(arr, clearBefore){
    if (clearBefore) removeAllMarkers();
    arr.forEach(p => addPoint(p.lat, p.lng, p.label));
    const b = boundsFromPoints(arr.map(p=>({lat:p.lat,lng:p.lng})));
    const bb = padBounds(b, 2000);
    map.fitBounds([[bb.minLat, bb.minLng],[bb.maxLat, bb.maxLng]], {padding:[20,20]});
  }
  document.getElementById('btnLoadAll')?.addEventListener('click', ()=>loadPoints(MOSTRO_ALL, true));
  document.getElementById('btnLoadSW')?.addEventListener('click', ()=>loadPoints(CLUSTER_SW, true));
  document.getElementById('btnLoadN')?.addEventListener('click', ()=>loadPoints(CLUSTER_N, true));
  document.getElementById('btnClearAll')?.addEventListener('click', removeAllMarkers);

  // Presets (applica ai pannelli)
  const RECS = {
    provinciale: { gridStep:700, heatRadius:24, rossmo:{B:2.5,f:1.2,g:1.6}, kde:{sigma:2.8}, meanCenter:{scale:1.1}, journey:{lambda:0.25} },
    clusterSW:   { gridStep:325, heatRadius:18, rossmo:{B:1.0,f:1.4,g:1.8}, kde:{sigma:0.9}, meanCenter:{scale:0.9}, journey:{lambda:0.60} },
    clusterN:    { gridStep:400, heatRadius:18, rossmo:{B:1.2,f:1.3,g:1.7}, kde:{sigma:1.2}, meanCenter:{scale:1.0}, journey:{lambda:0.50} }
  };
  function applyRec(key, method){
    const cfg = RECS[key]; if (!cfg) return;
    gridStepEl.value = cfg.gridStep; heatRadiusEl.value = cfg.heatRadius;
    const showOnly = (id) => ['params-rossmo','params-kde','params-meanCenter','params-journey'].forEach(pid => {
      const el = document.getElementById(pid); if (el) el.style.display = (pid===id?'block':'none');
    });
    if (method==='rossmo'){ methodSelect.value='rossmo'; updateDescription(); showOnly('params-rossmo'); rossmoBEl.value=cfg.rossmo.B; rossmoFEl.value=cfg.rossmo.f; rossmoGEl.value=cfg.rossmo.g; }
    if (method==='kde'){ methodSelect.value='kde'; updateDescription(); showOnly('params-kde'); kdeSigmaEl.value=cfg.kde.sigma; }
    if (method==='meanCenter'){ methodSelect.value='meanCenter'; updateDescription(); showOnly('params-meanCenter'); mcScaleEl.value=cfg.meanCenter.scale; }
    if (method==='journey'){ methodSelect.value='journey'; updateDescription(); showOnly('params-journey'); journeyLambdaEl.value=cfg.journey.lambda; }
  }
  const bindApply = (id,k,m)=>document.getElementById(id)?.addEventListener('click', ()=>applyRec(k,m));
  bindApply('applyProvRossmo','provinciale','rossmo');
  bindApply('applyProvKDE','provinciale','kde');
  bindApply('applyProvMC','provinciale','meanCenter');
  bindApply('applyProvJourney','provinciale','journey');
  bindApply('applySWRossmo','clusterSW','rossmo');
  bindApply('applySWKDE','clusterSW','kde');
  bindApply('applySWMC','clusterSW','meanCenter');
  bindApply('applySWJourney','clusterSW','journey');
  bindApply('applyNRossmo','clusterN','rossmo');
  bindApply('applyNKDE','clusterN','kde');
  bindApply('applyNMC','clusterN','meanCenter');
  bindApply('applyNJourney','clusterN','journey');

  // --- Tutorial modal: open/close robust ---
  function openModal(){ modal.removeAttribute('hidden'); }
  function closeModal(){ modal.setAttribute('hidden',''); }
  // Apri una volta all’avvio
  openModal();
  openTut?.addEventListener('click', openModal);
  closeTut?.addEventListener('click', closeModal);
  startApp?.addEventListener('click', closeModal);
  modal?.addEventListener('click', (e)=>{ if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && !modal.hasAttribute('hidden')) closeModal(); });

  // --- Mobile drawer handlers ---
  const isMobile = () => window.matchMedia('(max-width: 860px)').matches;
  function openSidebar(){ document.body.classList.add('sidebar-open'); scrim?.removeAttribute('hidden'); setTimeout(()=>map.invalidateSize(), 220); }
  function closeSidebar(){ document.body.classList.remove('sidebar-open'); scrim?.setAttribute('hidden',''); setTimeout(()=>map.invalidateSize(), 50); }
  toggleSidebarBtn?.addEventListener('click', ()=> document.body.classList.contains('sidebar-open') ? closeSidebar() : openSidebar());
  closeSidebarBtn?.addEventListener('click', closeSidebar);
  scrim?.addEventListener('click', closeSidebar);
  window.addEventListener('resize', ()=>{ if (!isMobile()){ closeSidebar(); } });

})();

// About modal
const openAbout  = document.getElementById('openAbout');
const aboutModal = document.getElementById('aboutModal');
const closeAbout = document.getElementById('closeAbout');
const aboutOk    = document.getElementById('aboutOk');

function openAboutModal(){ aboutModal?.removeAttribute('hidden'); }
function closeAboutModal(){ aboutModal?.setAttribute('hidden',''); }

openAbout?.addEventListener('click', openAboutModal);
closeAbout?.addEventListener('click', closeAboutModal);
aboutOk?.addEventListener('click', closeAboutModal);
aboutModal?.addEventListener('click', (e)=>{ if (e.target === aboutModal) closeAboutModal(); });
window.addEventListener('keydown', (e)=>{ if (e.key === 'Escape' && !aboutModal?.hasAttribute('hidden')) closeAboutModal(); });