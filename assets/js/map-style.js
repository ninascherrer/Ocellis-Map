/**
 * Fond de carte Ocellis — style « plan d'architecte », volontairement épuré.
 *  - bâtiments en aplats sans contour, rues en négatif (blanc), aucune bordure de voie ;
 *  - ni numéros, ni chemins, ni limites administratives, ni pictogrammes du fond ;
 *  - seuls les grands axes sont nommés, en petites capitales espacées.
 * Tuiles vectorielles OpenFreeMap (données © OpenStreetMap, schéma OpenMapTiles) — gratuites,
 * sans clé d'API, y compris pour un usage professionnel.
 */
export const BRAND = {
  prune: '#2b0018',
  pruneSoft: '#5b2a44',
  rose: '#f9d7f6',
  paper: '#f1efeb',
  ink: '#1f2028',
};

const C = {
  land: '#f1efeb', // blanc Ocellis
  block: '#e3dedb', // bâti : blanc teinté d'aubergine
  green: '#dfe7d6',
  wood: '#d6e2cc',
  water: '#d4dfe4',
  waterLabel: '#7b929e',
  street: '#ffffff',
  label: 'rgba(43, 0, 24, 0.55)',
  labelSoft: 'rgba(43, 0, 24, 0.38)',
  halo: 'rgba(241, 239, 235, 0.95)',
};

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const FONT_ITALIC = ['Noto Sans Italic'];
const NAME = ['coalesce', ['get', 'name:fr'], ['get', 'name'], ['get', 'name:latin'], ''];

const cls = (...v) => ['match', ['get', 'class'], v, true, false];
const notTunnel = ['!=', ['get', 'brunnel'], 'tunnel'];
const zw = (pairs) => ['interpolate', ['exponential', 1.5], ['zoom'], ...pairs];

export function buildStyle() {
  return {
    version: 8,
    name: 'Ocellis — plan du quartier',
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
        attribution:
          '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> · ' +
          '<a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">© OpenMapTiles</a> · ' +
          '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© contributeurs OpenStreetMap</a>',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': C.land } },

      // Végétation et eau, en aplats doux
      { id: 'landcover-grass', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: cls('grass'), paint: { 'fill-color': C.green } },
      { id: 'landcover-wood', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: cls('wood'), paint: { 'fill-color': C.wood } },
      { id: 'landuse-green', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: cls('cemetery', 'stadium', 'pitch', 'playground'), paint: { 'fill-color': C.green } },
      { id: 'park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park',
        paint: { 'fill-color': C.green, 'fill-opacity': 0.7 } },
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
        filter: notTunnel, paint: { 'fill-color': C.water } },

      // Bâti : aplats sans contour (« plan masse »)
      { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 13,
        paint: {
          'fill-color': C.block,
          'fill-antialias': false,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 13, 0, 14.5, 1],
        } },

      // Rues en négatif, sans bordure
      { id: 'street-minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 13,
        filter: ['all', notTunnel, cls('minor', 'service')],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.street, 'line-width': zw([13, 0.6, 18, 12]) } },
      { id: 'street-major', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['all', notTunnel, cls('motorway', 'trunk', 'primary', 'secondary', 'tertiary')],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.street, 'line-width': zw([11, 1.2, 18, 28]) } },

      // Libellés : grands axes en petites capitales, petites rues seulement de très près
      { id: 'water-name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name',
        layout: {
          'text-field': NAME, 'text-font': FONT_ITALIC, 'text-size': 13, 'text-letter-spacing': 0.12,
          'symbol-placement': ['step', ['zoom'], 'point', 13, 'line'],
        },
        paint: { 'text-color': C.waterLabel, 'text-halo-color': C.halo, 'text-halo-width': 1 } },
      { id: 'street-name-major', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 14,
        filter: cls('trunk', 'primary', 'secondary'),
        layout: {
          'text-field': ['upcase', NAME], 'text-font': FONT_BOLD,
          'text-size': zw([14, 9, 18, 11.5]), 'text-letter-spacing': 0.16,
          'symbol-placement': 'line', 'symbol-spacing': 420, 'text-max-angle': 25,
        },
        paint: { 'text-color': C.label, 'text-halo-color': C.street, 'text-halo-width': 1.2 } },
      { id: 'street-name-minor', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 16.8,
        filter: cls('tertiary', 'minor'),
        layout: {
          'text-field': NAME, 'text-font': FONT, 'text-size': 11,
          'symbol-placement': 'line', 'symbol-spacing': 360, 'text-max-angle': 25,
        },
        paint: { 'text-color': C.labelSoft, 'text-halo-color': C.street, 'text-halo-width': 1.2 } },
      { id: 'place-city', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', maxzoom: 15.5,
        filter: cls('city', 'town', 'village', 'suburb'),
        layout: {
          'text-field': ['upcase', NAME], 'text-font': FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 11, 15, 13], 'text-letter-spacing': 0.24,
          'text-max-width': 9,
        },
        paint: { 'text-color': C.labelSoft, 'text-halo-color': C.halo, 'text-halo-width': 1.4 } },
    ],
  };
}
