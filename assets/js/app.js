import * as maplibregl from '../../vendor/maplibre-gl/maplibre-gl.mjs';
import { buildStyle, BRAND } from './map-style.js';
import { CATEGORIES, CATEGORY_STYLE, catVars, TYPES, TYPE_ORDER, CUSTOM_ICONS, EMERGENCY_NUMBERS, WALK, WALK_RINGS } from './config.js';
import { LUCIDE } from './icons.js';

/* ==========================================================================
   Utilitaires
   ========================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const mqMobile = window.matchMedia('(max-width: 760px)');
const isMobile = () => mqMobile.matches;

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

function svgIcon(name) {
  const inner = LUCIDE[name] || CUSTOM_ICONS[name] || LUCIDE['map-pin'];
  return `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${inner}</svg>`;
}
const ico = (name, extra = '') => `<span class="ico ${extra}">${svgIcon(name)}</span>`;

function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => { el.innerHTML = svgIcon(el.dataset.icon); });
}

const walkMinutes = (m) => Math.max(1, Math.round((m * WALK.detour) / WALK.metersPerMinute));
const fmtDist = (m) => (m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`);
const fmtWalk = (m) => {
  const min = walkMinutes(m);
  return min < 60 ? `${min} min` : `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
};

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function textOn(hex) {
  if (!hex) return BRAND.ink;
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.35 ? BRAND.ink : '#ffffff';
}

function lineBadges(lines = [], { withMode = false } = {}) {
  if (!lines.length) return '';
  const byMode = { metro: [], rer: [], tram: [], bus: [] };
  lines.forEach((l) => (byMode[l.mode] || byMode.bus).push(l));
  const out = [];
  for (const [mode, ls] of Object.entries(byMode)) {
    if (!ls.length) continue;
    const prefix = withMode && mode !== 'metro' ? `<span class="line__mode">${mode === 'rer' ? 'RER' : mode === 'tram' ? '' : 'Bus'}</span>` : '';
    const badges = ls.map((l) => {
      if (mode === 'bus') {
        const night = /^N\d/.test(l.ref);
        return `<span class="line line--bus${night ? ' line--night' : ''}" title="${night ? 'Noctilien' : 'Bus'} ${esc(l.ref)}">${esc(l.ref)}</span>`;
      }
      const label = mode === 'metro' ? `Métro ${l.ref}` : mode === 'rer' ? `RER ${l.ref}` : `Tram ${l.ref}`;
      const style = l.color ? `background:${l.color};color:${textOn(l.color)}` : `background:${BRAND.prune};color:#fff`;
      return `<span class="line line--${mode}" style="${style}" title="${label}">${esc(l.ref)}</span>`;
    }).join('');
    out.push(`<span class="lines">${prefix}${badges}</span>`);
  }
  return out.join(' ');
}

function addressText(a) {
  if (!a) return '';
  const city = [a.postcode, a.city].filter(Boolean).join(' ');
  const street = a.street ? esc(a.street) : '';
  if (!street) return esc(city);
  return `${street}${city ? `, ${esc(city)}` : ''}${a.precise ? '' : ' <small>(adresse approximative)</small>'}`;
}

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2400);
}

/* ==========================================================================
   Liens d'itinéraire
   ========================================================================== */
const ll = (p) => `${p.lat},${p.lon}`;
const links = {
  gmapsTo: (p) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(ll(p))}`,
  gmapsWalk: (from, to) => `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(ll(from))}&destination=${encodeURIComponent(ll(to))}&travelmode=walking`,
  gmapsSearch: (p) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([p.name, p.address?.street, p.address?.city].filter(Boolean).join(', '))}`,
  appleTo: (p, name) => `https://maps.apple.com/?daddr=${ll(p)}&q=${encodeURIComponent(name)}`,
  appleWalk: (from, to, name) => `https://maps.apple.com/?saddr=${ll(from)}&daddr=${ll(to)}&dirflg=w&q=${encodeURIComponent(name)}`,
  citymapperTo: (p, name, address = '') => `https://citymapper.com/directions?endcoord=${encodeURIComponent(ll(p))}&endname=${encodeURIComponent(name)}&endaddress=${encodeURIComponent(address)}`,
  citymapperFrom: (from, to, name) => `https://citymapper.com/directions?startcoord=${encodeURIComponent(ll(from))}&endcoord=${encodeURIComponent(ll(to))}&endname=${encodeURIComponent(name)}`,
  waze: (p) => `https://waze.com/ul?ll=${encodeURIComponent(ll(p))}&navigate=yes`,
  osm: (p) => (p.osm ? `https://www.openstreetmap.org/${p.osm.type}/${p.osm.id}` : null),
};

/* ==========================================================================
   État
   ========================================================================== */
const state = {
  data: null,
  office: null,
  places: [],
  byId: new Map(),
  activeCats: new Set(CATEGORIES.map((c) => c.id)),
  activeTypes: Object.fromEntries(CATEGORIES.map((c) => [c.id, null])), // null = tous
  query: '',
  proOnly: false,
  selectedId: null,
  hoverId: null,
  velib: new Map(),
  velibAt: null,
};

const typeLabel = (p) => p.subLabel || TYPES[p.sub]?.label || p.sub;
const typeIcon = (p) => TYPES[p.sub]?.icon || 'map-pin';

function isVisible(p) {
  if (!state.activeCats.has(p.cat)) return false;
  const types = state.activeTypes[p.cat];
  if (types && !types.has(p.sub)) return false;
  if (state.proOnly && p.cat === 'restaurants' && !p.businessLunch) return false;
  if (state.query) {
    const hay = norm([p.name, typeLabel(p), TYPES[p.sub]?.label, CATEGORIES.find((c) => c.id === p.cat)?.label,
      p.address?.street, p.address?.city, ...(p.lines || []).map((l) => `${l.mode} ${l.ref} ligne ${l.ref}`)].join(' '));
    if (!state.query.split(' ').every((t) => hay.includes(t))) return false;
  }
  return true;
}
const visiblePlaces = () => state.places.filter(isVisible);

/* ==========================================================================
   Carte
   ========================================================================== */
let map, ocellisMarker, popup, hoverTip;
let mapReady = false;
const INITIAL_ZOOM = () => (isMobile() ? 15.2 : 15.8);

function circleRing(center, radius, steps = 160) {
  const coords = [];
  const dLat = radius / 111320;
  const dLon = radius / (111320 * Math.cos((center.lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    coords.push([center.lon + dLon * Math.sin(a), center.lat + dLat * Math.cos(a)]);
  }
  return coords;
}

function ringsGeoJSON(office) {
  const features = [];
  for (const min of WALK_RINGS) {
    const r = (min * WALK.metersPerMinute) / WALK.detour;
    features.push({ type: 'Feature', properties: { min }, geometry: { type: 'LineString', coordinates: circleRing(office, r) } });
    features.push({
      type: 'Feature',
      properties: { min, label: `${min} min à pied` },
      geometry: { type: 'Point', coordinates: [office.lon, office.lat + r / 111320] },
    });
  }
  return { type: 'FeatureCollection', features };
}

function placesGeoJSON() {
  return {
    type: 'FeatureCollection',
    features: visiblePlaces().map((p) => ({
      type: 'Feature',
      properties: { id: p.id, name: p.name, icon: markerId(p), d: p.distance, fav: p.favorite ? 1 : 0 },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })),
  };
}

function focusGeoJSON() {
  const features = [];
  for (const [id, kind] of [[state.hoverId, 'hover'], [state.selectedId, 'selected']]) {
    const p = id && state.byId.get(id);
    if (!p || (kind === 'hover' && id === state.selectedId)) continue;
    features.push({
      type: 'Feature',
      properties: { id, kind, icon: `${markerId(p)}-active` },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    });
  }
  return { type: 'FeatureCollection', features };
}

/* Les images de la carte sont générées à la résolution réelle de l'écran (×2 ou ×3) pour rester nettes. */
const DPR = Math.min(3, Math.max(2, Math.ceil(window.devicePixelRatio || 1)));
const px = (size) => size * (DPR / 2); // les dimensions ci-dessous sont exprimées en unités @2x

const markerId = (p) => `poi-${p.cat}-${typeIcon(p)}`;

/**
 * Pastille de lieu : disque à la couleur de la catégorie, pictogramme contrasté, liseré blanc.
 * 40 px à l'écran (52 px quand le lieu est sélectionné ou survolé, avec un anneau aubergine).
 */
function markerSvg(glyph, color, glyphColor, edge, active) {
  const size = active ? 128 : 96; // unités @2x, marge comprise pour l'ombre
  const c = size / 2;
  const r = active ? 46 : 36; // rayon du disque
  const gs = active ? 46 : 36; // taille du pictogramme
  const s = gs / 24;
  const t = c - gs / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px(size)}" height="${px(size)}" viewBox="0 0 ${size} ${size}">
    <defs><filter id="sh" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="0" dy="${active ? 5 : 3}" stdDeviation="${active ? 5 : 3.5}" flood-color="#26282d" flood-opacity="${active ? 0.3 : 0.2}"/>
    </filter></defs>
    ${active ? `<circle cx="${c}" cy="${c}" r="${r + 9}" fill="none" stroke="${BRAND.prune}" stroke-width="4"/>` : ''}
    <circle cx="${c}" cy="${c}" r="${r}" fill="${color}" stroke="#ffffff" stroke-width="${active ? 6 : 5}" filter="url(#sh)"/>
    ${edge && !active ? `<circle cx="${c}" cy="${c}" r="${r + 3.2}" fill="none" stroke="${edge}" stroke-width="1.4"/>` : ''}
    <g transform="translate(${t} ${t}) scale(${s})" fill="none" stroke="${glyphColor}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
  </svg>`;
}

function loadImage(svg) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

/** Zone invisible couvrant le marqueur Ocellis : les noms de rues ne passent pas dessous. */
function officeShieldSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${px(132)}" height="${px(210)}" viewBox="0 0 132 210"><rect width="132" height="210" fill="none"/></svg>`;
}

async function registerIcons() {
  if (!map.hasImage('office-shield')) map.addImage('office-shield', await loadImage(officeShieldSvg()), { pixelRatio: DPR });
  const combos = new Set();
  for (const c of CATEGORIES) {
    for (const t of TYPE_ORDER[c.id]) combos.add(`${c.id}|${TYPES[t].icon}`);
    combos.add(`${c.id}|map-pin`);
  }
  await Promise.all([...combos].flatMap((combo) => {
    const [cat, name] = combo.split('|');
    const glyph = LUCIDE[name] || CUSTOM_ICONS[name];
    return [false, true].map(async (active) => {
      const id = `poi-${cat}-${name}${active ? '-active' : ''}`;
      if (map.hasImage(id)) return;
      const st = CATEGORY_STYLE[cat];
      const img = await loadImage(markerSvg(glyph, st.color, st.glyph, st.edge, active));
      if (!map.hasImage(id)) map.addImage(id, img, { pixelRatio: DPR });
    });
  }));
}

function createOcellisMarker() {
  const el = document.createElement('button');
  el.type = 'button';
  el.className = 'ocellis-marker';
  el.setAttribute('aria-label', 'Ocellis — nos nouveaux bureaux. Afficher la fiche');
  el.innerHTML = `
    <span class="ocellis-marker__tag">Ocellis</span>
    <span class="ocellis-marker__pin"><img src="assets/brand/ocellis-symbol-white.svg" alt=""></span>
    <span class="ocellis-marker__pulse" aria-hidden="true"></span>`;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    select('ocellis', { fly: false });
  });
  ocellisMarker = new maplibregl.Marker({ element: el, anchor: 'bottom', offset: [0, -12] })
    .setLngLat([state.office.lon, state.office.lat])
    .addTo(map);
}

function initMap() {
  const { office } = state;
  map = new maplibregl.Map({
    container: 'map',
    style: buildStyle(),
    center: [office.lon, office.lat],
    zoom: INITIAL_ZOOM(),
    minZoom: 12.5,
    maxZoom: 19,
    maxBounds: [[office.lon - 0.09, office.lat - 0.06], [office.lon + 0.09, office.lat + 0.06]],
    attributionControl: false,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    cooperativeGestures: false,
    locale: {
      'NavigationControl.ZoomIn': 'Zoomer',
      'NavigationControl.ZoomOut': 'Dézoomer',
      'NavigationControl.ResetBearing': 'Remettre le nord en haut',
      'AttributionControl.ToggleAttribution': 'Afficher les crédits',
      'AttributionControl.MapFeedback': 'Signaler une erreur de carte',
      'ScaleControl.Meters': 'm',
      'ScaleControl.Kilometers': 'km',
    },
  });
  map.touchZoomRotate.disableRotation();
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right');
  map.addControl(new maplibregl.ScaleControl({ unit: 'metric', maxWidth: 90 }), 'bottom-right');
  map.addControl(new maplibregl.AttributionControl({
    compact: true,
    customAttribution: "IDFM · Vélib' Métropole · BAN",
  }), 'bottom-right');

  let loaded = false;
  const failTimer = setTimeout(() => { if (!loaded) $('#map-error').hidden = false; }, 15000);

  map.on('load', async () => {
    loaded = true;
    // Sur mobile, crédits repliés derrière le bouton « i » pour libérer la carte.
    if (isMobile()) document.querySelector('.maplibregl-ctrl-attrib')?.classList.remove('maplibregl-compact-show');
    clearTimeout(failTimer);
    $('#map-error').hidden = true;
    await registerIcons();

    map.addSource('rings', { type: 'geojson', data: ringsGeoJSON(office) });
    map.addSource('lines', { type: 'geojson', data: state.data.lines });
    map.addSource('places', { type: 'geojson', data: placesGeoJSON() });
    map.addSource('focus', { type: 'geojson', data: focusGeoJSON() });

    map.addLayer({
      id: 'rings', type: 'line', source: 'rings', filter: ['==', ['geometry-type'], 'LineString'],
      paint: { 'line-color': BRAND.prune, 'line-opacity': 0.4, 'line-width': 1.4, 'line-dasharray': [3, 3] },
    });
    map.addLayer({
      id: 'rings-label', type: 'symbol', source: 'rings', filter: ['==', ['geometry-type'], 'Point'],
      layout: { 'text-field': ['get', 'label'], 'text-font': ['Noto Sans Bold'], 'text-size': 11.5, 'text-letter-spacing': 0.03, 'text-padding': 4 },
      paint: {
        'text-color': BRAND.prune, 'text-halo-color': 'rgba(241,239,235,0.95)', 'text-halo-width': 2,
        // De loin, le libellé du petit cercle passerait sous le marqueur Ocellis : on le masque.
        'text-opacity': ['step', ['zoom'], ['case', ['==', ['get', 'min'], 5], 0, 1], 14.8, 1],
      },
    });
    map.addLayer({
      id: 'transit-casing', type: 'line', source: 'lines',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3.5, 18, 8], 'line-opacity': 0.7 },
    });
    map.addLayer({
      id: 'transit', type: 'line', source: 'lines',
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 1.4, 18, 3.5], 'line-opacity': 0.45 },
    });
    // Une sélection courte de lieux : pastilles colorées toujours visibles, noms affichés là où il y a la place.
    // Deux couches : les pastilles (au-dessus) sont placées en premier, les noms (dessous) évitent ensuite
    // toutes les pastilles, si bien qu'aucun nom ne passe sous un marqueur.
    map.addLayer({
      id: 'places-label', type: 'symbol', source: 'places', minzoom: 15,
      layout: {
        'text-field': ['get', 'name'],
        'text-font': ['Noto Sans Bold'],
        'text-size': ['interpolate', ['linear'], ['zoom'], 15, 11, 18, 12.5],
        'text-anchor': 'left',
        // Décalage au-delà de l'emprise de la pastille (ombre comprise), pour ne pas la chevaucher.
        'text-offset': ['interpolate', ['linear'], ['zoom'], 15, ['literal', [2.35, 0]], 18, ['literal', [2.3, 0]]],
        'text-max-width': 9,
        'text-padding': 1,
        'symbol-sort-key': ['get', 'd'],
      },
      paint: { 'text-color': BRAND.ink, 'text-halo-color': 'rgba(255,255,255,0.95)', 'text-halo-width': 1.8 },
    });
    map.addLayer({
      id: 'places', type: 'symbol', source: 'places',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 13, 0.62, 15, 0.88, 16, 1, 18, 1.08],
        'icon-allow-overlap': true,
        'icon-padding': 0,
        'symbol-sort-key': ['-', 0, ['get', 'd']], // les plus proches dessinés au-dessus
      },
    });
    map.addSource('office', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [office.lon, office.lat] } } });
    map.addLayer({
      id: 'office-shield', type: 'symbol', source: 'office',
      layout: { 'icon-image': 'office-shield', 'icon-anchor': 'bottom', 'icon-allow-overlap': true },
    });
    map.addLayer({
      id: 'focus', type: 'symbol', source: 'focus',
      layout: {
        'icon-image': ['get', 'icon'],
        'icon-size': ['case', ['==', ['get', 'kind'], 'selected'], 1, 0.9],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    });

    updateTransitVisibility();
    createOcellisMarker();
    bindMapEvents();
    mapReady = true;
    openFromHash();
  });

  map.on('error', (e) => {
    if (!loaded && e?.error?.status >= 400) $('#map-error').hidden = false;
  });
}

function bindMapEvents() {
  hoverTip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: 'hover-tip', offset: 26, maxWidth: '260px' });

  for (const layer of ['places']) {
    map.on('mouseenter', layer, () => { map.getCanvas().style.cursor = 'pointer'; });
    map.on('mousemove', layer, (e) => {
      const p = state.byId.get(e.features[0].properties.id);
      if (!p || isMobile()) return;
      if (state.hoverId !== p.id) setHover(p.id, { fromMap: true });
      if (state.selectedId !== p.id) {
        hoverTip.setLngLat([p.lon, p.lat]).setHTML(`${esc(p.name)} <span>· ${esc(typeLabel(p))} · ${fmtWalk(p.distance)}</span>`).addTo(map);
      }
    });
    map.on('mouseleave', layer, () => {
      map.getCanvas().style.cursor = '';
      hoverTip.remove();
      setHover(null);
    });
    map.on('click', layer, (e) => {
      hoverTip.remove();
      select(e.features[0].properties.id, { fly: isMobile() });
    });
  }
  map.on('click', (e) => {
    const hit = map.queryRenderedFeatures(e.point, { layers: ['places', 'focus'] });
    if (!hit.length) deselect();
  });
}

function refreshPlacesSource() {
  if (!map?.getSource('places')) return;
  map.getSource('places').setData(placesGeoJSON());
}
function refreshFocus() {
  map?.getSource('focus')?.setData(focusGeoJSON());
}
function updateTransitVisibility() {
  if (!map?.getLayer('transit')) return;
  const v = state.activeCats.has('transports') ? 'visible' : 'none';
  map.setLayoutProperty('transit', 'visibility', v);
  map.setLayoutProperty('transit-casing', 'visibility', v);
}

/* ==========================================================================
   Sélection et fiches
   ========================================================================== */
function setHover(id, { fromMap = false } = {}) {
  state.hoverId = id;
  refreshFocus();
  document.querySelectorAll('.result.is-hover').forEach((el) => el.classList.remove('is-hover'));
  if (id && fromMap) document.querySelector(`.result[data-id="${CSS.escape(id)}"]`)?.classList.add('is-hover');
}

function select(id, { fly = true } = {}) {
  const isOffice = id === 'ocellis';
  const p = isOffice ? state.office : state.byId.get(id);
  if (!p) return;
  state.selectedId = isOffice ? null : id;
  refreshFocus();
  markActiveResult();

  const html = isOffice ? officeCard() : placeCard(p);
  if (isMobile()) {
    popup?.remove();
    const sheet = $('#sheet-card');
    sheet.innerHTML = html;
    sheet.hidden = false;
    sheet.scrollTop = 0;
    document.body.classList.add('has-card');
    setPanel('peek');
    bindCard(sheet, p);
  } else {
    popup?.remove();
    popup = new maplibregl.Popup({
      className: `place-popup${isOffice ? ' is-ocellis' : ''}`,
      offset: isOffice ? { bottom: [0, -82], top: [0, 0], left: [32, -40], right: [-32, -40] } : 30,
      maxWidth: '340px',
      closeButton: false,
      focusAfterOpen: false,
    }).setLngLat([p.lon, p.lat]).setHTML(html).addTo(map);
    popup.on('close', () => { if (popup?._ocellisCurrent === id) clearSelection(); });
    popup._ocellisCurrent = id;
    bindCard(popup.getElement(), p);
  }

  if (fly) {
    const zoom = Math.max(map.getZoom(), isOffice ? INITIAL_ZOOM() : 16.4);
    map.easeTo({
      center: [p.lon, p.lat],
      zoom,
      duration: 650,
      offset: isMobile() ? [0, -Math.round(window.innerHeight * 0.2)] : [0, 120],
    });
  }
  if (!isOffice && p.sub === 'velib') refreshVelib();
  history.replaceState(null, '', `#lieu=${encodeURIComponent(id)}`);
}

function clearSelection() {
  state.selectedId = null;
  refreshFocus();
  markActiveResult();
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
}

function deselect() {
  popup?.remove();
  popup = null;
  const sheet = $('#sheet-card');
  sheet.hidden = true;
  sheet.innerHTML = '';
  document.body.classList.remove('has-card');
  clearSelection();
}

function bindCard(root, p) {
  root.querySelector('[data-action="close"]')?.addEventListener('click', deselect);
  root.querySelector('[data-action="share"]')?.addEventListener('click', async () => {
    const url = `${location.origin}${location.pathname}#lieu=${encodeURIComponent(p === state.office ? 'ocellis' : p.id)}`;
    try {
      if (navigator.share && isMobile()) await navigator.share({ title: p.name, url });
      else { await navigator.clipboard.writeText(url); toast('Lien copié dans le presse-papiers'); }
    } catch { /* partage annulé */ }
  });
}

function nearestStation() {
  return state.places.filter((p) => p.sub === 'metro').sort((a, b) => a.distance - b.distance)[0];
}

function officeCard() {
  const o = state.office;
  const m = nearestStation();
  const rer = state.places.filter((p) => p.sub === 'rer').sort((a, b) => a.distance - b.distance)[0];
  const addr = `${o.address.street}, ${o.address.postcode} ${o.address.city}`;
  return `
  <article class="card card--ocellis">
    <div class="card__hero">
      <button class="card__close" type="button" data-action="close" aria-label="Fermer">${ico('x')}</button>
      <img class="card__hero-logo" src="assets/brand/ocellis-logo.svg" alt="Ocellis">
      <p class="card__tagline">${esc(o.tagline)}</p>
      <h2 class="card__title">${esc(o.name)}</h2>
      <p class="card__address">${esc(o.address.street)}<br>${esc(o.address.postcode)} ${esc(o.address.city)}</p>
    </div>
    <div class="card__section">
      <p class="card__section-title">Pour venir</p>
      <ul class="card__facts">
        ${m ? `<li class="fact">${lineBadges(m.lines)} ${esc(m.name)} · ${fmtWalk(m.distance)}</li>` : ''}
        ${rer ? `<li class="fact">${lineBadges(rer.lines, { withMode: true })} ${esc(rer.name)} · ${fmtWalk(rer.distance)}</li>` : ''}
      </ul>
    </div>
    <div class="card__actions">
      <a class="btn btn--primary" href="${links.gmapsTo(o)}" target="_blank" rel="noopener">${ico('navigation')} Lancer l'itinéraire</a>
      <button class="btn btn--icon" type="button" data-action="share" aria-label="Partager le lien" title="Partager">${ico('share-2')}</button>
      <div class="card__links">
        <a href="${links.citymapperTo(o, 'Ocellis', addr)}" target="_blank" rel="noopener">Citymapper ${ico('external-link')}</a>
        <a href="${links.appleTo(o, 'Ocellis')}" target="_blank" rel="noopener">Plans (Apple) ${ico('external-link')}</a>
        <a href="${links.waze(o)}" target="_blank" rel="noopener">Waze ${ico('external-link')}</a>
      </div>
    </div>
  </article>`;
}

function placeCard(p) {
  const cat = CATEGORIES.find((c) => c.id === p.cat);
  const o = state.office;
  const far = p.distance > 2200;
  const facts = [
    `<li class="fact fact--rose">${ico('footprints')} ${far ? '≈ ' : ''}${fmtWalk(p.distance)} à pied</li>`,
    `<li class="fact">${ico('route')} ${fmtDist(p.distance)} des bureaux</li>`,
  ];
  if (p.businessLunch) facts.push(`<li class="fact">${ico('briefcase')} Idéal déjeuner pro</li>`);
  if (p.favorite) facts.push(`<li class="fact">${ico('heart')} Coup de cœur de l'équipe</li>`);

  let extra = '';
  if (p.lines?.length) {
    extra += `<div class="card__section"><p class="card__section-title">Lignes</p>${lineBadges(p.lines, { withMode: true })}</div>`;
  }
  if (p.sub === 'velib') extra += `<div class="card__section" data-velib="${esc(p.velib.code)}">${velibBlock(p)}</div>`;
  if (p.hours) extra += `<div class="card__section"><p class="card__section-title">Horaires</p><p class="card__address">${esc(p.hours)}</p></div>`;
  if (p.note) extra += `<p class="card__note">${esc(p.note)}</p>`;

  const extLinks = [
    p.website ? `<a href="${esc(p.website)}" target="_blank" rel="noopener">Site web ${ico('external-link')}</a>` : '',
    p.phone ? `<a href="tel:${esc(p.phone.replace(/\s/g, ''))}">${esc(p.phone)}</a>` : '',
    p.source === 'osm' ? `<a href="${links.gmapsSearch(p)}" target="_blank" rel="noopener">Horaires & avis (Google Maps) ${ico('external-link')}</a>` : '',
    links.osm(p) ? `<a href="${links.osm(p)}" target="_blank" rel="noopener">OpenStreetMap ${ico('external-link')}</a>` : '',
    `<a href="${links.citymapperFrom(o, p, p.name)}" target="_blank" rel="noopener">Citymapper ${ico('external-link')}</a>`,
    `<a href="${links.appleWalk(o, p, p.name)}" target="_blank" rel="noopener">Plans (Apple) ${ico('external-link')}</a>`,
  ].filter(Boolean).join('');

  return `
  <article class="card">
    <button class="card__close" type="button" data-action="close" aria-label="Fermer">${ico('x')}</button>
    <div class="card__head">
      <p class="card__kicker"><span class="card__kicker-icon" style="${catVars(p.cat)}">${ico(typeIcon(p))}</span>${esc(cat?.label || '')} · ${esc(typeLabel(p))}</p>
      <h2 class="card__title">${esc(p.name)}</h2>
      ${p.address ? `<p class="card__address">${addressText(p.address)}</p>` : ''}
      <ul class="card__facts">${facts.join('')}</ul>
    </div>
    ${extra}
    <div class="card__actions">
      <a class="btn btn--primary" href="${links.gmapsWalk(o, p)}" target="_blank" rel="noopener">${ico('navigation')} Itinéraire depuis Ocellis</a>
      <button class="btn btn--icon" type="button" data-action="share" aria-label="Partager le lien" title="Partager">${ico('share-2')}</button>
      <div class="card__links">${extLinks}</div>
    </div>
  </article>`;
}

/* ==========================================================================
   Vélib' en temps réel (open data Ville de Paris)
   ========================================================================== */
function velibBlock(p) {
  const s = state.velib.get(p.velib.code);
  if (!s) {
    const status = state.velibError ? 'disponibilité en temps réel momentanément indisponible' : 'disponibilité en cours de chargement…';
    return `<p class="card__section-title">Disponibilité</p><p class="velib__time">Capacité : ${p.velib.capacity} bornes · ${status}</p>`;
  }
  if (s.is_renting !== 'OUI') {
    return `<p class="card__section-title">Disponibilité</p><p class="card__address">Station momentanément hors service.</p>`;
  }
  const t = new Date(s.duedate);
  const time = isNaN(t) ? '' : t.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  return `
    <p class="card__section-title">Disponible maintenant</p>
    <div class="velib">
      <div class="velib__cell"><strong>${s.mechanical}</strong><span>mécaniques</span></div>
      <div class="velib__cell"><strong>${s.ebike}</strong><span>électriques</span></div>
      <div class="velib__cell"><strong>${s.numdocksavailable}</strong><span>places libres</span></div>
    </div>
    <p class="velib__time">Données Vélib' Métropole${time ? `, mises à jour à ${time}` : ''}.</p>`;
}

let velibLoading = null;
async function refreshVelib(force = false) {
  if (velibLoading) return velibLoading;
  if (!force && state.velibAt && Date.now() - state.velibAt < 60000) return;
  const codes = state.places.filter((p) => p.sub === 'velib').map((p) => p.velib.code);
  if (!codes.length) return;
  const where = `stationcode in (${codes.map((c) => `"${c}"`).join(',')})`;
  const url = 'https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/velib-disponibilite-en-temps-reel/records?' +
    new URLSearchParams({ where, limit: '100', select: 'stationcode,numbikesavailable,mechanical,ebike,numdocksavailable,is_renting,duedate' });
  const get = (attempt = 0) => fetch(url)
    .then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))))
    .catch((e) => (attempt < 2 ? new Promise((ok) => setTimeout(ok, 1500 * (attempt + 1))).then(() => get(attempt + 1)) : Promise.reject(e)));
  velibLoading = get()
    .then((d) => {
      for (const s of d.results || []) state.velib.set(s.stationcode, s);
      state.velibAt = Date.now();
      state.velibError = false;
      document.querySelectorAll('[data-velib]').forEach((el) => {
        const p = state.places.find((x) => x.velib?.code === el.dataset.velib);
        if (p) el.innerHTML = velibBlock(p);
      });
      renderResults();
    })
    .catch(() => {
      // Hors ligne ou service indisponible : on affiche la capacité seule.
      state.velibError = true;
      document.querySelectorAll('[data-velib]').forEach((el) => {
        const p = state.places.find((x) => x.velib?.code === el.dataset.velib);
        if (p) el.innerHTML = velibBlock(p);
      });
    })
    .finally(() => { velibLoading = null; });
  return velibLoading;
}

/* ==========================================================================
   Panneau : chiffres clés, filtres, liste
   ========================================================================== */
function renderHighlights() {
  const within = (m, min) => walkMinutes(m) <= min;
  const m = nearestStation();
  const restos = state.places.filter((p) => p.cat === 'restaurants' && within(p.distance, 10)).length;
  const greens = state.places.filter((p) => ['parc', 'jardin'].includes(p.sub) && within(p.distance, 10)).length;
  const tiles = [];
  if (m) {
    tiles.push({ value: `${walkMinutes(m.distance)}<small>min</small>`, label: `jusqu'au métro ${m.lines.map((l) => l.ref).join(', ')} · ${m.name}`, action: () => select(m.id) });
  }
  tiles.push({ value: restos, label: 'restos, cafés et boulangeries à 10 min', action: () => soloCategory('restaurants') });
  tiles.push({ value: greens, label: 'parcs et jardins à 10 min à pied', action: () => soloCategory('bien-etre', ['parc', 'jardin']) });
  const root = $('#highlights');
  root.innerHTML = tiles.map((t, i) => `
    <button class="highlight" type="button" data-i="${i}">
      <span class="highlight__value">${t.value}</span>
      <span class="highlight__label">${esc(t.label)}</span>
    </button>`).join('');
  root.querySelectorAll('.highlight').forEach((b) => b.addEventListener('click', () => tiles[b.dataset.i].action()));
}

function soloCategory(cat, types = null) {
  state.activeCats = new Set([cat]);
  for (const c of CATEGORIES) state.activeTypes[c.id] = null;
  if (types) state.activeTypes[cat] = new Set(types);
  state.proOnly = false;
  applyFilters();
  fitToVisible();
  if (isMobile()) setPanel('open');
}

/** Cadre la carte sur les bureaux et les lieux visibles les plus proches. */
function fitToVisible(max = 24) {
  if (!map) return;
  const list = visiblePlaces().slice(0, max);
  if (!list.length || state.activeCats.size === CATEGORIES.length) return;
  const b = new maplibregl.LngLatBounds([state.office.lon, state.office.lat], [state.office.lon, state.office.lat]);
  list.forEach((p) => b.extend([p.lon, p.lat]));
  const pad = isMobile() ? { top: 80, bottom: 200, left: 40, right: 40 } : { top: 90, bottom: 70, left: 70, right: 70 };
  map.fitBounds(b, { padding: pad, maxZoom: 16.2, duration: 800 });
}

function renderFilters() {
  const counts = {};
  state.places.forEach((p) => { counts[p.cat] = (counts[p.cat] || 0) + 1; });
  const all = state.activeCats.size === CATEGORIES.length;
  const root = $('#filters');
  root.innerHTML = `
    <button class="chip chip--all" type="button" data-cat="*" aria-pressed="${all}">Tout voir</button>
    ${CATEGORIES.map((c) => `
      <button class="chip" type="button" data-cat="${c.id}" style="${catVars(c.id)}" aria-pressed="${!all && state.activeCats.has(c.id)}" title="${esc(c.blurb)}">
        ${ico(c.icon)}<span>${esc(isMobile() ? c.short : c.label)}</span><span class="chip__count">${counts[c.id] || 0}</span>
      </button>`).join('')}`;
  root.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
    const cat = b.dataset.cat;
    const everything = state.activeCats.size === CATEGORIES.length;
    if (cat === '*') {
      state.activeCats = new Set(CATEGORIES.map((c) => c.id));
    } else if (everything) {
      state.activeCats = new Set([cat]); // depuis « Tout voir », un clic isole la catégorie
    } else if (state.activeCats.has(cat)) {
      state.activeCats.delete(cat);
      if (!state.activeCats.size) state.activeCats = new Set(CATEGORIES.map((c) => c.id));
    } else {
      state.activeCats.add(cat);
    }
    for (const c of CATEGORIES) state.activeTypes[c.id] = null;
    state.proOnly = false;
    applyFilters();
    fitToVisible();
  }));
}

function renderSubfilters() {
  const root = $('#subfilters');
  if (state.activeCats.size !== 1) { root.innerHTML = ''; return; }
  const [cat] = state.activeCats;
  const present = new Set(state.places.filter((p) => p.cat === cat).map((p) => p.sub));
  const types = TYPE_ORDER[cat].filter((t) => present.has(t));
  const active = state.activeTypes[cat];
  // « Déjeuner pro » : restaurants recommandés par l'équipe (data/curation.json → dejeunerPro).
  const hasPro = cat === 'restaurants' && state.places.some((p) => p.businessLunch);
  root.innerHTML = (hasPro ? `
    <button class="subchip" type="button" data-pro aria-pressed="${state.proOnly}">${ico('briefcase')}Déjeuner pro</button>` : '') +
    types.map((t) => `
    <button class="subchip" type="button" data-type="${t}" aria-pressed="${!active || active.has(t)}">${ico(TYPES[t].icon)}${esc(TYPES[t].label)}</button>`).join('');
  root.querySelector('[data-pro]')?.addEventListener('click', () => {
    state.proOnly = !state.proOnly;
    applyFilters();
  });
  root.querySelectorAll('.subchip[data-type]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.type;
    let set = state.activeTypes[cat];
    if (!set) set = new Set([t]); // premier clic : on isole ce type
    else if (set.has(t)) { set.delete(t); if (!set.size) set = null; } else set.add(t);
    if (set && set.size === types.length) set = null;
    state.activeTypes[cat] = set;
    applyFilters();
    fitToVisible();
  }));
}

function resultItem(p) {
  let meta = esc(typeLabel(p));
  if (p.lines?.length) meta = `${lineBadges(p.lines)}`;
  if (p.sub === 'velib') {
    const s = state.velib.get(p.velib.code);
    meta = s && s.is_renting === 'OUI' ? `Vélib' · ${s.numbikesavailable} vélo${s.numbikesavailable > 1 ? 's' : ''} dispo` : `Vélib' · ${p.velib.capacity} bornes`;
  }
  const fav = p.favorite ? `<span class="result__fav" title="Coup de cœur">${ico('heart')}</span>` : '';
  return `
    <button class="result${p.id === state.selectedId ? ' is-active' : ''}" type="button" role="listitem" data-id="${esc(p.id)}"
      aria-label="${esc(`${p.name}, ${typeLabel(p)}, ${fmtWalk(p.distance)} à pied`)}">
      <span class="result__icon" style="${catVars(p.cat)}">${ico(typeIcon(p))}</span>
      <span class="result__body">
        <span class="result__name">${esc(p.name)} ${fav}</span>
        <span class="result__meta">${meta}</span>
      </span>
      <span class="result__dist"><strong>${fmtWalk(p.distance)}</strong>${fmtDist(p.distance)}</span>
    </button>`;
}

function emergencyBlock() {
  return `
    <section class="emergency" aria-label="Numéros d'urgence">
      <p class="emergency__title">${ico('siren')} Numéros d'urgence</p>
      <div class="emergency__grid">
        ${EMERGENCY_NUMBERS.map((n) => `<a href="tel:${n.num}" title="${esc(n.hint)}"><strong>${n.num}</strong><span>${esc(n.label)}</span></a>`).join('')}
      </div>
      <p class="emergency__note">En cas d'urgence vitale, appelez le 15 ou le 112.</p>
    </section>`;
}

function renderResults() {
  const list = visiblePlaces();
  const root = $('#results');
  const onlyHealth = state.activeCats.size === 1 && state.activeCats.has('sante') && !state.query;
  $('#results-count').textContent = `${list.length} lieu${list.length > 1 ? 'x' : ''}`;
  $('#panel-handle-label').textContent = `${list.length} lieu${list.length > 1 ? 'x' : ''} à découvrir`;
  root.innerHTML = (onlyHealth ? emergencyBlock() : '') + (list.length
    ? list.map(resultItem).join('')
    : `<p class="empty">Aucun lieu ne correspond à « ${esc($('#search').value)} ».<br>Essayez un autre mot ou affichez toutes les catégories.</p>`);
  root.querySelectorAll('.result').forEach((el) => {
    el.addEventListener('click', () => select(el.dataset.id));
    el.addEventListener('mouseenter', () => { if (!isMobile()) setHover(el.dataset.id); });
    el.addEventListener('mouseleave', () => { if (!isMobile()) setHover(null); });
  });
}

function markActiveResult() {
  document.querySelectorAll('.result.is-active').forEach((el) => el.classList.remove('is-active'));
  if (!state.selectedId) return;
  const el = document.querySelector(`.result[data-id="${CSS.escape(state.selectedId)}"]`);
  if (el) {
    el.classList.add('is-active');
    if (!isMobile()) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function applyFilters() {
  renderFilters();
  renderSubfilters();
  renderResults();
  refreshPlacesSource();
  updateTransitVisibility();
  if (state.selectedId && !isVisible(state.byId.get(state.selectedId))) deselect();
}

function renderSources() {
  const d = new Date(state.data.generatedAt);
  const date = d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  $('#sources').innerHTML = `
    Sources : ${state.data.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(', ')}.
    Fond de carte <a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a>.
    Données mises à jour le ${date}. Temps à pied estimés à environ 4,5 km/h.`;
}

/* Tiroir mobile */
function setPanel(st) {
  const panel = $('#panel');
  panel.dataset.state = st;
  $('#panel-handle').setAttribute('aria-expanded', String(st === 'open'));
  document.body.classList.toggle('sheet-open', st === 'open');
  if (st !== 'open') panel.scrollTop = 0;
}

function bindUI() {
  hydrateIcons();
  const search = $('#search');
  const clear = $('#search-clear');
  let t;
  search.addEventListener('input', () => {
    clearTimeout(t);
    clear.hidden = !search.value;
    t = setTimeout(() => { state.query = norm(search.value); applyFilters(); }, 120);
  });
  search.addEventListener('focus', () => { if (isMobile()) setPanel('open'); });
  clear.addEventListener('click', () => {
    search.value = '';
    clear.hidden = true;
    state.query = '';
    applyFilters();
    search.focus();
  });

  $('#recenter').addEventListener('click', recenter);

  // Logo Ocellis : toujours visible, un clic ramène en haut du panneau.
  const panel = $('#panel');
  const toTop = () => panel.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  $('#logo-top').addEventListener('click', toTop);
  $('#to-top').addEventListener('click', toTop);
  panel.addEventListener('scroll', () => panel.classList.toggle('is-scrolled', panel.scrollTop > 24), { passive: true });
  // Sur mobile, le logo flotte sur la carte : il remonte la liste si elle est ouverte, sinon recentre sur les bureaux.
  $('#logo-map').addEventListener('click', () => (panel.dataset.state === 'open' && panel.scrollTop > 0 ? toTop() : recenter()));
  $('#brand-address').addEventListener('click', () => select('ocellis'));
  $('#panel-handle').addEventListener('click', () => setPanel($('#panel').dataset.state === 'open' ? 'peek' : 'open'));

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (!$('#sheet-card').hidden || popup) deselect();
      else if (isMobile()) setPanel('peek');
    }
  });
  mqMobile.addEventListener('change', () => { deselect(); setPanel('peek'); renderFilters(); });
  window.addEventListener('hashchange', openFromHash);
}

function recenter() {
  map.flyTo({ center: [state.office.lon, state.office.lat], zoom: INITIAL_ZOOM(), bearing: 0, pitch: 0, duration: 900, essential: true });
  const el = ocellisMarker?.getElement();
  if (el) {
    el.classList.remove('is-bump');
    void el.offsetWidth;
    el.classList.add('is-bump');
  }
}

function openFromHash() {
  const m = location.hash.match(/lieu=([^&]+)/);
  if (!m || !mapReady) return;
  const id = decodeURIComponent(m[1]);
  if (id === 'ocellis' || state.byId.has(id)) select(id);
}

/* ==========================================================================
   Démarrage
   ========================================================================== */
async function main() {
  bindUI();
  let data;
  try {
    const res = await fetch('data/quartier.json');
    data = await res.json();
  } catch {
    $('#results').innerHTML = '<p class="empty">Impossible de charger les données du quartier. Ouvrez la carte via un serveur web (voir README).</p>';
    return;
  }
  state.data = data;
  state.office = data.office;
  state.places = data.places.map((p) => ({ ...p, distance: p.distance ?? Math.round(haversine(data.office.lat, data.office.lon, p.lat, p.lon)) }));
  state.byId = new Map(state.places.map((p) => [p.id, p]));

  renderHighlights();
  renderSources();
  applyFilters();
  initMap();
  refreshVelib(true);
  setInterval(() => refreshVelib(true), 120000);
}

main();
