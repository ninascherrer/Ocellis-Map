#!/usr/bin/env node
/**
 * Génère data/quartier.json : la sélection des lieux autour des bureaux Ocellis.
 *
 * Sources (toutes ouvertes) :
 *  - Base Adresse Nationale (BAN, IGN)       → position des bureaux + adresses des lieux
 *  - OpenStreetMap via les tuiles OpenFreeMap → commerces, restaurants, santé, sport, parcs, parkings
 *  - Île-de-France Mobilités (open data)      → arrêts, lignes et tracés officiels métro/RER/tram/bus
 *  - Vélib' Métropole (open data GBFS)        → stations Vélib' (la disponibilité est lue en direct par la carte)
 *  - data/curation.json                        → corrections et ajouts faits à la main par l'équipe
 *
 * Usage :  npm run data
 * Derrière un proxy d'entreprise (Node ≥ 22.21) : NODE_USE_ENV_PROXY=1 npm run data
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Pbf from 'pbf';
import { VectorTile } from '@mapbox/vector-tile';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'quartier.json');
const CURATION = path.join(ROOT, 'data', 'curation.json');

const OFFICE_QUERY = '96 avenue Charles de Gaulle 92200 Neuilly-sur-Seine';

/* Rayons de recherche (mètres, à vol d'oiseau depuis les bureaux). */
const RADIUS = {
  restaurant: 800, cafe: 800, boulangerie: 900, 'sur-le-pouce': 800, glacier: 900,
  supermarche: 1000, superette: 800, primeur: 900, boucherie: 900, 'epicerie-fine': 900,
  marche: 1200, fromagerie: 900, poissonnerie: 900, caviste: 900, patisserie: 900, chocolatier: 900, surgeles: 1000,
  sport: 1500, piscine: 2500, parc: 1300, jardin: 1000,
  pharmacie: 1000, hopital: 2500, clinique: 1500, 'centre-medical': 1000,
  metro: 1800, rer: 1900, tram: 1500, bus: 700, parking: 1300, 'parking-velo': 350, velib: 1000,
};

/* Grands espaces verts : leur point « centre » est loin, on les garde jusqu'à 3 km. */
const BIG_PARKS = /bois de boulogne|parc de bagatelle/;

/*
 * Sélection éditoriale : la carte ne montre que l'essentiel.
 * Quotas par catégorie puis par type (« a+b » = types mis en commun).
 * Dans chaque groupe, on garde les lieux les plus proches à pied, pondérés par leur utilité
 * (voir usefulness()), avec une seule adresse par enseigne.
 * Un lieu « epingler: true » dans data/curation.json est toujours conservé.
 */
const SELECTION = {
  restaurants: { restaurant: 4, cafe: 2, boulangerie: 1, 'sur-le-pouce': 1 },
  courses: { 'supermarche+superette': 3 },
  'bien-etre': { sport: 1, piscine: 1, 'parc+jardin': 3 },
  sante: { pharmacie: 2, hopital: 1 },
  transports: { metro: 2, rer: 1, bus: 2, velib: 2, parking: 1, 'parking-velo': 1 },
};

/* --------------------------------------------------------------------------------------------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchRetry(url, { as = 'json', tries = 12 } = {}) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'ocellis-carte-quartier/1.0' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return as === 'json' ? await res.json() : Buffer.from(await res.arrayBuffer());
    } catch (e) {
      last = e;
      await sleep(Math.min(800 * 1.6 ** i, 8000));
    }
  }
  throw new Error(`Échec de téléchargement : ${url}\n  ${last}`);
}

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000, r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 +
    Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lon2 - lon1) * r) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

const norm = (s = '') => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const slug = (s = '') => norm(s).replace(/ /g, '-');
const round = (n, d = 6) => Math.round(n * 10 ** d) / 10 ** d;

/* --------------------------------------------------------------------------------------------- */
/* 1. Les bureaux                                                                                */

async function geocodeOffice() {
  const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(OFFICE_QUERY)}&limit=1`;
  const d = await fetchRetry(url);
  const f = d.features?.[0];
  if (!f || f.properties.score < 0.8) throw new Error('Adresse des bureaux introuvable dans la BAN');
  const [lon, lat] = f.geometry.coordinates;
  return {
    name: 'Ocellis',
    tagline: 'Nos nouveaux bureaux',
    address: { street: f.properties.name, postcode: f.properties.postcode, city: f.properties.city },
    label: f.properties.label,
    lat, lon,
  };
}

/* --------------------------------------------------------------------------------------------- */
/* 2. Points d'intérêt OpenStreetMap (tuiles vectorielles OpenFreeMap, schéma OpenMapTiles)      */

function osmRef(id) {
  // Planetiler/OpenMapTiles : id = osm_id * 10 + type (1 = node, 2 = way, 3 = relation)
  if (!id) return null;
  const n = BigInt(id);
  const type = { 1n: 'node', 2n: 'way', 3n: 'relation' }[n % 10n];
  return type ? { type, id: String(n / 10n) } : null;
}

async function fetchTilePois(office) {
  const tj = await fetchRetry('https://tiles.openfreemap.org/planet');
  const tmpl = tj.tiles[0];
  const Z = 14, n = 2 ** Z;
  const xt = Math.floor(((office.lon + 180) / 360) * n);
  const yt = Math.floor(((1 - Math.log(Math.tan((office.lat * Math.PI) / 180) + 1 / Math.cos((office.lat * Math.PI) / 180)) / Math.PI) / 2) * n);
  const pois = [];
  let woodEdge = null; // point boisé (grande surface) le plus proche des bureaux → lisière du Bois
  for (let dx = -2; dx <= 2; dx++) {
    for (let dy = -2; dy <= 2; dy++) {
      const x = xt + dx, y = yt + dy;
      const buf = await fetchRetry(tmpl.replace('{z}', Z).replace('{x}', x).replace('{y}', y), { as: 'buffer' });
      const vt = new VectorTile(new Pbf(buf));
      const lc = vt.layers.landcover;
      for (let i = 0; lc && i < lc.length; i++) {
        const ft = lc.feature(i);
        if (ft.properties.class !== 'wood') continue;
        const g = ft.toGeoJSON(x, y, Z).geometry;
        for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
          if (ringArea(poly[0]) < 20000) continue;
          for (const [lon, lat] of poly[0]) {
            if (lat > office.lat) continue; // le Bois de Boulogne est au sud des bureaux
            const d = haversine(office.lat, office.lon, lat, lon);
            if (!woodEdge || d < woodEdge.d) woodEdge = { d, lat, lon };
          }
        }
      }
      const layer = vt.layers.poi;
      if (!layer) continue;
      for (let i = 0; i < layer.length; i++) {
        const ft = layer.feature(i);
        const g = ft.toGeoJSON(x, y, Z).geometry;
        if (g.type !== 'Point') continue;
        const [lon, lat] = g.coordinates;
        pois.push({ ...ft.properties, osm: osmRef(ft.id), lon, lat });
      }
    }
  }
  // Les tuiles se chevauchent (tampon) : on dédoublonne.
  const seen = new Map();
  for (const p of pois) {
    const k = p.osm ? `${p.osm.type}/${p.osm.id}` : `${p.class}|${p.subclass}|${p.name}|${p.lon.toFixed(5)}|${p.lat.toFixed(5)}`;
    if (!seen.has(k)) seen.set(k, p);
  }
  return { pois: [...seen.values()], woodEdge };
}

/** Aire approximative (m²) d'un anneau [lon, lat]. */
function ringArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  const lat = ring[0][1] * (Math.PI / 180);
  return Math.abs(s / 2) * 111320 * Math.cos(lat) * 110540;
}

/** Classe un POI OpenMapTiles dans nos catégories. Retourne null si hors sujet. */
function classify(p) {
  const c = p.class, s = p.subclass, name = p.name || '';
  const n = norm(name);
  // Restaurants & cafés
  if (c === 'restaurant') return ['restaurants', 'restaurant'];
  if (c === 'fast_food') return ['restaurants', 'sur-le-pouce'];
  if (c === 'cafe') return ['restaurants', 'cafe'];
  if (c === 'bakery' || s === 'bakery') return ['restaurants', 'boulangerie'];
  if (c === 'ice_cream') return ['restaurants', 'glacier'];
  // Courses
  if (s === 'supermarket') return ['courses', 'supermarche'];
  if (s === 'convenience') return ['courses', 'superette'];
  if (s === 'greengrocer') return ['courses', 'primeur'];
  if (s === 'butcher' || c === 'butcher') return ['courses', 'boucherie'];
  if (s === 'deli') return ['courses', 'epicerie-fine'];
  if (s === 'marketplace') return ['courses', 'marche'];
  if (s === 'cheese') return ['courses', 'fromagerie'];
  if (s === 'seafood') return ['courses', 'poissonnerie'];
  if (c === 'alcohol_shop' || s === 'wine') return ['courses', 'caviste'];
  if (s === 'pastry' || s === 'confectionery') return ['courses', 'patisserie'];
  if (s === 'chocolate') return ['courses', 'chocolatier'];
  if (s === 'frozen_food') return ['courses', 'surgeles'];
  // Santé
  if (c === 'pharmacy') return ['sante', 'pharmacie'];
  if (s === 'hospital' && /protection civile/.test(n)) return null;
  if (s === 'hospital') return ['sante', /clinique/.test(n) ? 'clinique' : 'hopital'];
  if (s === 'clinic') return ['sante', 'clinique'];
  if (s === 'doctors' && name) return ['sante', 'centre-medical'];
  if (s === 'dentist' && /centre|cabinet/.test(n)) return ['sante', 'centre-medical'];
  // Bien-être
  if (s === 'swimming_pool' && name) return ['bien-etre', 'piscine'];
  if (c === 'sports_centre' && name) {
    if (/piscine|aquatique/.test(n)) return ['bien-etre', 'piscine'];
    return ['bien-etre', 'sport'];
  }
  if ((s === 'fitness_centre' || s === 'fitness') && name) return ['bien-etre', 'sport'];
  if (c === 'park' && name) return ['bien-etre', 'parc'];
  if (s === 'garden' && name) return ['bien-etre', 'jardin'];
  if (s === 'theme_park' && /jardin/.test(n)) return ['bien-etre', 'parc'];
  // Mobilité
  if (s === 'parking' && name) return ['transports', 'parking'];
  if (s === 'bicycle_parking') return ['transports', 'parking-velo'];
  return null;
}

/* Sous-type de salle de sport selon le nom (pour un libellé plus juste). */
function sportLabel(name) {
  const n = norm(name);
  if (/escalade|climbing|bloc/.test(n)) return 'Escalade';
  if (/tennis|padel|squash/.test(n)) return 'Tennis & raquettes';
  if (/nautique|aviron|voile/.test(n)) return 'Club nautique';
  if (/danse|yoga|pilates/.test(n)) return 'Danse & yoga';
  if (/stade|gymnase|complexe|espace sportif|centre sportif/.test(n)) return 'Équipement sportif';
  return 'Salle de sport & club';
}

/* --------------------------------------------------------------------------------------------- */
/* 3. Transports — open data Île-de-France Mobilités                                             */

const IDFM = 'https://data.iledefrance-mobilites.fr/api/explore/v2.1/catalog/datasets';

async function idfmAll(dataset, where, select) {
  const out = [];
  for (let offset = 0; ; offset += 100) {
    const q = new URLSearchParams({ limit: '100', offset: String(offset), where });
    if (select) q.set('select', select);
    const d = await fetchRetry(`${IDFM}/${dataset}/records?${q}`, { tries: 30 });
    out.push(...d.results);
    if (offset + 100 >= d.total_count) break;
  }
  return out;
}

const MODE = { Metro: 'metro', RapidTransit: 'rer', Tramway: 'tram', Bus: 'bus', LocalTrain: 'rer' };

async function fetchTransit(office) {
  const pt = `geom'POINT(${office.lon} ${office.lat})'`;
  const stops = await idfmAll('arrets-lignes', `within_distance(pointgeo, ${pt}, 2000m)`);
  const traces = await idfmAll('traces-du-reseau-ferre-idf', `within_distance(geo_shape, ${pt}, 2500m)`);

  // Couleurs officielles des lignes ferrées.
  // Les tracés notent le tram « 3bis » quand les arrêts disent « T3b » : on harmonise.
  const traceRef = (t) => (t.tramway ? `T${String(t.indice_lig).replace(/^T/i, '').replace(/bis$/i, 'b')}` : String(t.indice_lig));
  const traceMode = (t) => (t.metro ? 'metro' : t.rer ? 'rer' : t.tramway ? 'tram' : 'train');
  const colors = {};
  for (const t of traces) colors[`${traceMode(t)}:${traceRef(t)}`] = `#${t.colourweb_hexa}`;

  // Regroupement des quais/arrêts par nom de station et par mode.
  const groups = new Map();
  for (const s of stops) {
    const mode = MODE[s.mode];
    if (!mode) continue;
    const key = `${mode}|${norm(s.stop_name)}`;
    const lat = Number(s.stop_lat), lon = Number(s.stop_lon);
    const g = groups.get(key) || { mode, name: s.stop_name, pts: [], lines: new Map(), commune: s.nom_commune };
    g.pts.push([lat, lon]);
    g.lines.set(s.shortname, { mode, ref: s.shortname, color: colors[`${mode}:${s.shortname}`] || null });
    groups.set(key, g);
  }
  const places = [];
  for (const g of groups.values()) {
    const lat = g.pts.reduce((a, p) => a + p[0], 0) / g.pts.length;
    const lon = g.pts.reduce((a, p) => a + p[1], 0) / g.pts.length;
    const sub = g.mode;
    const d = haversine(office.lat, office.lon, lat, lon);
    if (d > RADIUS[sub]) continue;
    const lines = [...g.lines.values()].sort((a, b) => a.ref.localeCompare(b.ref, 'fr', { numeric: true }));
    places.push({
      id: `idfm-${sub}-${slug(g.name)}`,
      name: g.name, cat: 'transports', sub, lat, lon, lines,
      commune: g.commune, source: 'idfm',
    });
  }

  // Tracés : seulement les lignes qui desservent les stations retenues, avec leur couleur officielle.
  const served = new Set(places.flatMap((p) => p.lines.filter((l) => l.mode !== 'bus').map((l) => `${l.mode}:${l.ref}`)));
  const lines = traces.filter((t) => served.has(`${traceMode(t)}:${traceRef(t)}`)).map((t) => ({
    type: 'Feature',
    properties: { mode: traceMode(t), ref: traceRef(t), name: t.res_com, color: `#${t.colourweb_hexa}` },
    geometry: {
      type: t.geo_shape.geometry.type,
      coordinates: roundCoords(t.geo_shape.geometry.coordinates),
    },
  }));
  return { places, lines };
}

function roundCoords(c) {
  return typeof c[0] === 'number' ? [round(c[0]), round(c[1])] : c.map(roundCoords);
}

/* --------------------------------------------------------------------------------------------- */
/* 4. Vélib'                                                                                     */

async function fetchVelib(office) {
  const d = await fetchRetry('https://velib-metropole-opendata.smovengo.cloud/opendata/Velib_Metropole/station_information.json');
  return d.data.stations
    .map((s) => ({ s, d: haversine(office.lat, office.lon, s.lat, s.lon) }))
    .filter((x) => x.d <= RADIUS.velib)
    .map(({ s }) => ({
      id: `velib-${s.stationCode}`,
      name: s.name, cat: 'transports', sub: 'velib', lat: s.lat, lon: s.lon,
      velib: { code: s.stationCode, capacity: s.capacity }, source: 'velib',
    }));
}

/* --------------------------------------------------------------------------------------------- */
/* 5. Adresses (géocodage inverse BAN)                                                           */

async function reverseAddress(lat, lon) {
  const url = `https://api-adresse.data.gouv.fr/reverse/?lon=${lon}&lat=${lat}&limit=1`;
  try {
    const d = await fetchRetry(url, { tries: 6 });
    const f = d.features?.[0];
    if (!f) return null;
    const p = f.properties;
    // Au-delà de 40 m, le numéro le plus proche n'est plus fiable : on ne garde que la rue.
    const precise = p.type === 'housenumber' && (p.distance ?? 999) <= 40;
    return {
      street: precise ? p.name : (p.street || p.name),
      postcode: p.postcode, city: p.city, precise,
    };
  } catch {
    return null;
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k], k);
    }
  }));
  return out;
}

/* --------------------------------------------------------------------------------------------- */

const SUB_LABEL = {
  restaurant: 'Restaurant', 'sur-le-pouce': 'Sur le pouce', cafe: 'Café', boulangerie: 'Boulangerie', glacier: 'Glacier',
  supermarche: 'Supermarché', superette: 'Supérette', primeur: 'Primeur', boucherie: 'Boucherie', 'epicerie-fine': 'Épicerie fine',
  marche: 'Marché', fromagerie: 'Fromagerie', poissonnerie: 'Poissonnerie', caviste: 'Caviste', patisserie: 'Pâtisserie',
  chocolatier: 'Chocolatier', surgeles: 'Surgelés',
  sport: 'Salle de sport & club', piscine: 'Piscine', parc: 'Parc', jardin: 'Jardin & square',
  pharmacie: 'Pharmacie', hopital: 'Hôpital', clinique: 'Clinique', 'centre-medical': 'Centre médical',
  metro: 'Métro', rer: 'RER', tram: 'Tramway', bus: 'Bus', parking: 'Parking', 'parking-velo': 'Parking vélos', velib: "Station Vélib'",
};

function genericName(sub) {
  return { 'parking-velo': 'Parking vélos' }[sub] || SUB_LABEL[sub];
}

/* --------------------------------------------------------------------------------------------- */
/* 6. Sélection éditoriale                                                                       */

/** Coefficient appliqué à la distance : < 1 favorise un lieu, > 1 le pénalise. */
function usefulness(p) {
  const n = norm(p.name);
  switch (p.sub) {
    case 'sur-le-pouce':
      return /mcdonald|burger king|kfc|quick|five guys|domino/.test(n) ? 4 : 1; // restauration rapide « de qualité »
    case 'sport':
      if (/fitness|gym|climbing|escalade|forme|sports? club|crossfit|yoga|pilates|boxe/.test(n)) return 1;
      if (/stade|gymnase|complexe|espace sportif|centre sportif|tennis|nautique|aviron|danse/.test(n)) return 5;
      return 2.5;
    case 'parc':
    case 'jardin':
      if (/^place\b/.test(n)) return 6; // une place arborée n'est pas un parc
      if (/acclimatation/.test(n)) return 3; // parc de loisirs payant
      return 1;
    case 'supermarche':
    case 'superette':
      return /^(superette|alimentation|epicerie|minimarche)/.test(n) ? 3 : 1; // enseignes identifiées d'abord
    default:
      return p.name === genericName(p.sub) && p.sub !== 'parking-velo' ? 5 : 1;
  }
}

/** Enseigne approximative, pour éviter deux Monoprix ou deux Paul (mots génériques ignorés). */
const GENERIC_WORDS = new Set(['le', 'la', 'les', 'l', 'au', 'aux', 'chez', 'de', 'du', 'des', 'cafe', 'restaurant', 'boulangerie', 'patisserie', 'brasserie', 'bistrot', 'maison']);
function brand(p) {
  const words = norm(p.name).split(' ');
  return words.find((w) => !GENERIC_WORDS.has(w)) || norm(p.name);
}
const BRAND_DEDUP = new Set(['restaurants', 'courses']); // les chaînes n'existent que là

/** Arrêts de bus : on retient ceux qui, ensemble, desservent le plus de lignes différentes. */
function pickBusStops(stops, n) {
  const chosen = [];
  const covered = new Set();
  const weight = (ref) => (/^N\d/.test(ref) ? 0.3 : 1); // Noctilien : utile, mais secondaire
  while (chosen.length < n) {
    let best = null;
    for (const s of stops) {
      if (chosen.includes(s)) continue;
      const gain = s.lines.filter((l) => !covered.has(l.ref)).reduce((a, l) => a + weight(l.ref), 0);
      const score = gain / (1 + s._d / 300);
      if (gain > 0 && (!best || score > best.score)) best = { s, score };
    }
    if (!best) break;
    chosen.push(best.s);
    best.s.lines.forEach((l) => covered.add(l.ref));
  }
  return chosen;
}

function selectEssentials(places, office, pinned) {
  for (const p of places) p._d = haversine(office.lat, office.lon, p.lat, p.lon);
  const kept = new Set(places.filter((p) => pinned.has(p.id) || p.source === 'curation'));
  for (const [cat, groups] of Object.entries(SELECTION)) {
    for (const [group, quota] of Object.entries(groups)) {
      const types = group.split('+');
      let pool = places.filter((p) => p.cat === cat && types.includes(p.sub));
      let room = quota - pool.filter((p) => kept.has(p)).length;
      if (room <= 0) continue;
      pool = pool.filter((p) => !kept.has(p));
      if (group === 'bus') {
        pickBusStops(pool, room).forEach((p) => kept.add(p));
        continue;
      }
      if (group === 'parc+jardin') {
        // Le Bois de Boulogne, à quelques minutes, figure toujours dans la sélection.
        const bois = pool.find((p) => /bois de boulogne/.test(norm(p.name)));
        if (bois) { kept.add(bois); room--; pool = pool.filter((p) => p !== bois); }
      }
      const dedup = BRAND_DEDUP.has(cat);
      const brands = new Set([...kept].filter((p) => p.cat === cat).map(brand));
      for (const p of pool.sort((a, b) => a._d * usefulness(a) - b._d * usefulness(b))) {
        if (room <= 0) break;
        if (dedup && brands.has(brand(p))) continue;
        kept.add(p);
        brands.add(brand(p));
        room--;
      }
    }
  }
  return places.filter((p) => kept.has(p)).map(({ _d, ...p }) => p);
}

async function main() {
  const t0 = Date.now();
  console.log('→ Géocodage des bureaux (BAN)…');
  const office = await geocodeOffice();
  console.log(`  ${office.label} → ${office.lat}, ${office.lon}`);

  console.log('→ Points d\'intérêt OpenStreetMap (tuiles OpenFreeMap)…');
  const { pois: raw, woodEdge } = await fetchTilePois(office);
  console.log(`  ${raw.length} points bruts`);

  let osmPlaces = [];
  for (const p of raw) {
    const cls = classify(p);
    if (!cls) continue;
    const [cat, sub] = cls;
    const name = p.name || genericName(sub);
    const big = sub === 'parc' && BIG_PARKS.test(norm(name));
    if (big && /bois de boulogne/.test(norm(name)) && woodEdge && woodEdge.d < 1500) {
      // Le centre du Bois est à plus de 2 km : on place le repère sur sa lisière la plus proche.
      p.lat = woodEdge.lat; p.lon = woodEdge.lon; p.edge = true;
    }
    const d = haversine(office.lat, office.lon, p.lat, p.lon);
    if (d > (big ? 3000 : RADIUS[sub])) continue;
    osmPlaces.push({
      id: p.osm ? `osm-${p.osm.type}-${p.osm.id}` : `osm-${sub}-${slug(name)}-${p.lat.toFixed(5)}`,
      name, cat, sub, lat: p.lat, lon: p.lon,
      label: sub === 'sport' ? sportLabel(name) : p.edge ? 'Bois · lisière la plus proche' : undefined,
      osm: p.osm, source: 'osm',
    });
  }

  // Fusion des doublons proches (ex. un commerce saisi à la fois comme point et comme bâtiment).
  osmPlaces.sort((a, b) => (a.osm?.type === 'node' ? -1 : 1) - (b.osm?.type === 'node' ? -1 : 1));
  const kept = [];
  for (const p of osmPlaces) {
    const dupe = kept.find((k) => k.sub === p.sub && norm(k.name) === norm(p.name) &&
      haversine(k.lat, k.lon, p.lat, p.lon) < (p.sub === 'parc' ? 600 : 80));
    if (!dupe) kept.push(p);
  }
  osmPlaces = kept;

  console.log('→ Transports (Île-de-France Mobilités)…');
  const transit = await fetchTransit(office);
  console.log(`  ${transit.places.length} stations/arrêts, ${transit.lines.length} tronçons de lignes`);

  console.log('→ Stations Vélib\'…');
  const velib = await fetchVelib(office);
  console.log(`  ${velib.length} stations`);

  let places = [...osmPlaces, ...transit.places, ...velib];

  // Curation manuelle.
  const curation = JSON.parse(await fs.readFile(CURATION, 'utf8'));
  const mods = curation.modifications || {};
  places = places.filter((p) => !mods[p.id]?.masquer);
  for (const p of places) {
    const m = mods[p.id];
    if (!m) continue;
    if (m.nom) p.name = m.nom;
    if (m.note) p.note = m.note;
    if (m.coupDeCoeur) p.favorite = true;
    if (m.dejeunerPro) p.businessLunch = true;
    if (m.siteWeb) p.website = m.siteWeb;
    if (m.telephone) p.phone = m.telephone;
    if (m.horaires) p.hours = m.horaires;
    if (m.adresse) p.addressOverride = m.adresse;
  }
  for (const a of curation.ajouts || []) {
    places.push({
      id: a.id || `ajout-${slug(a.nom)}`, name: a.nom, cat: a.categorie, sub: a.type, lat: a.lat, lon: a.lon,
      note: a.note, favorite: !!a.coupDeCoeur, businessLunch: !!a.dejeunerPro, website: a.siteWeb, phone: a.telephone,
      hours: a.horaires, addressOverride: a.adresse, source: 'curation',
    });
  }

  // Sélection éditoriale : quelques lieux essentiels par catégorie.
  const candidates = places.length;
  const pinned = new Set(Object.entries(mods).filter(([, m]) => m.epingler).map(([id]) => id));
  places = selectEssentials(places, office, pinned);
  console.log(`→ Sélection : ${places.length} lieux retenus sur ${candidates} candidats`);

  // Tracés : uniquement les lignes ferrées qui desservent les stations retenues.
  const served = new Set(places.flatMap((p) => (p.lines || []).filter((l) => l.mode !== 'bus').map((l) => `${l.mode}:${l.ref}`)));
  transit.lines = transit.lines.filter((f) => served.has(`${f.properties.mode}:${f.properties.ref}`));

  console.log(`→ Adresses (BAN, géocodage inverse) pour ${places.length} lieux…`);
  await mapLimit(places, 6, async (p) => {
    if (p.addressOverride) {
      p.address = { street: p.addressOverride, precise: true };
      delete p.addressOverride;
      return;
    }
    if (['metro', 'rer', 'tram', 'bus'].includes(p.sub) && p.commune) {
      p.address = { city: p.commune, precise: false };
    }
    const a = await reverseAddress(p.lat, p.lon);
    if (a) p.address = a;
  });

  for (const p of places) {
    p.distance = Math.round(haversine(office.lat, office.lon, p.lat, p.lon));
    p.lat = round(p.lat); p.lon = round(p.lon);
    p.subLabel = p.label || SUB_LABEL[p.sub] || p.sub;
    delete p.label; delete p.commune;
  }
  places.sort((a, b) => a.distance - b.distance);

  const counts = {};
  for (const p of places) counts[p.cat] = (counts[p.cat] || 0) + 1;

  const out = {
    generatedAt: new Date().toISOString(),
    office,
    radius: RADIUS,
    selection: SELECTION,
    counts,
    sources: [
      { name: 'OpenStreetMap', url: 'https://www.openstreetmap.org/copyright', licence: 'ODbL' },
      { name: 'Île-de-France Mobilités', url: 'https://data.iledefrance-mobilites.fr' },
      { name: "Vélib' Métropole", url: 'https://www.velib-metropole.fr/donnees-open-data-gbfs-du-service-velib-metropole' },
      { name: 'Base Adresse Nationale', url: 'https://adresse.data.gouv.fr', licence: 'Licence Ouverte 2.0' },
    ],
    places,
    lines: { type: 'FeatureCollection', features: transit.lines },
  };
  await fs.writeFile(OUT, JSON.stringify(out));
  console.log(`✓ ${places.length} lieux écrits dans ${path.relative(ROOT, OUT)} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  console.log('  ', counts);
}

main().catch((e) => {
  console.error('✗', e.message);
  process.exit(1);
});
