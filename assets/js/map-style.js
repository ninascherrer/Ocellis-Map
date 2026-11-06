/**
 * Fond de carte Ocellis — plan de quartier « dessiné sur mesure ».
 *
 * Principes :
 *  - palette réduite de la charte : blanc cassé #F1EFEB, anthracite #26282D (textes),
 *    vert doux #B0D6AA atténué (espaces verts), blanc (rues) ; l'aubergine #2B041A est
 *    réservée au marqueur Ocellis et aux interactions (elle n'apparaît pas dans le fond) ;
 *  - fond légèrement plus soutenu que le blanc cassé pour des rues blanches bien nettes ;
 *  - bâti en aplats très clairs, bords nets, sans contour ni ombre, affiché seulement de près ;
 *  - rues en blanc, sans bordure, sur trois niveaux de largeur ; seule l'avenue Charles de Gaulle
 *    reçoit un double filet fin pour rester repérable ;
 *  - libellés sobres et peu répétés : grands axes en petites capitales, petites rues de près.
 *
 * Tuiles vectorielles OpenFreeMap (données © OpenStreetMap, schéma OpenMapTiles) — gratuites,
 * sans clé d'API, y compris pour un usage professionnel. La géométrie (positions des rues,
 * bâtiments, parcs) n'est jamais modifiée : seul le rendu l'est.
 */
export const BRAND = {
  prune: '#2b041a', // aubergine Ocellis (charte)
  pruneSoft: '#5b2a44',
  rose: '#f9d7f6',
  paper: '#f1efeb',
  ink: '#26282d', // anthracite (charte)
};

const C = {
  land: '#ebe7e0', // variation chaude du blanc cassé #F1EFEB : les rues blanches ressortent nettement
  building: '#e3ded6', // bâti à peine plus soutenu que le fond, visible seulement de près
  green: '#cadec2', // #B0D6AA adouci
  water: '#d1dbdf',
  street: '#ffffff',
  axisEdge: 'rgba(38, 40, 45, 0.24)', // filets de l'avenue Charles de Gaulle
  labelAxis: 'rgba(38, 40, 45, 0.86)',
  labelMajor: 'rgba(38, 40, 45, 0.66)',
  labelMinor: 'rgba(38, 40, 45, 0.48)',
  labelPlace: 'rgba(38, 40, 45, 0.4)',
  labelWater: '#7c8d95',
  halo: '#ffffff',
  haloLand: 'rgba(235, 231, 224, 0.95)',
};

const FONT = ['Noto Sans Regular'];
const FONT_BOLD = ['Noto Sans Bold'];
const FONT_ITALIC = ['Noto Sans Italic'];
const NAME = ['coalesce', ['get', 'name:fr'], ['get', 'name'], ['get', 'name:latin'], ''];
const AXIS_NAME = 'Avenue Charles de Gaulle';

const cls = (...v) => ['match', ['get', 'class'], v, true, false];
const sub = (...v) => ['match', ['get', 'subclass'], v, true, false];
const notTunnel = ['!=', ['get', 'brunnel'], 'tunnel'];
const isAxis = ['all', ['==', ['get', 'name'], AXIS_NAME], cls('primary', 'trunk')];
const zw = (...stops) => ['interpolate', ['exponential', 1.5], ['zoom'], ...stops.flat()];

/* Largeurs des voies (px), par niveau hiérarchique. */
const W_MINOR = zw([13.5, 0.6], [16, 3.4], [18, 10]);
const W_MEDIUM = zw([12, 0.9], [16, 5.5], [18, 15]);
const W_MAJOR = zw([11, 1.2], [16, 9], [18, 24]);

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

      /* Espaces verts : une seule teinte, surfaces homogènes.
         Les jardins privés et massifs de fleurs (petites taches) ne sont pas dessinés. */
      { id: 'green-wood', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: cls('wood'), paint: { 'fill-color': C.green, 'fill-outline-color': C.green } },
      { id: 'green-grass', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
        filter: ['all', cls('grass'), ['!', sub('garden', 'flowerbed', 'allotments')]],
        paint: { 'fill-color': C.green, 'fill-outline-color': C.green } },
      { id: 'green-landuse', type: 'fill', source: 'openmaptiles', 'source-layer': 'landuse',
        filter: cls('cemetery'), paint: { 'fill-color': C.green, 'fill-outline-color': C.green } },
      { id: 'green-park', type: 'fill', source: 'openmaptiles', 'source-layer': 'park',
        paint: { 'fill-color': C.green, 'fill-outline-color': C.green } },

      /* Eau */
      { id: 'water', type: 'fill', source: 'openmaptiles', 'source-layer': 'water',
        filter: notTunnel, paint: { 'fill-color': C.water, 'fill-outline-color': C.water } },
      { id: 'waterway', type: 'line', source: 'openmaptiles', 'source-layer': 'waterway',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.water, 'line-width': zw([12, 0.8], [18, 4]) } },

      /* Bâti : aplats très clairs, bords nets (antialiasing + contour de la même couleur),
         en fondu à l'apparition pour garder une lecture d'îlots à petite échelle. */
      { id: 'building', type: 'fill', source: 'openmaptiles', 'source-layer': 'building', minzoom: 15.6,
        paint: {
          'fill-color': C.building,
          'fill-outline-color': C.building,
          'fill-antialias': true,
          'fill-opacity': ['interpolate', ['linear'], ['zoom'], 15.6, 0, 16.6, 1],
        } },

      /* Voirie : trois niveaux, en blanc, sans bordure. Ni chemins, ni tunnels, ni voies de service isolées. */
      { id: 'street-minor', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation', minzoom: 13.5,
        filter: ['all', notTunnel, cls('minor', 'service')],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.street, 'line-width': W_MINOR } },
      { id: 'street-medium', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['all', notTunnel, cls('secondary', 'tertiary')],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.street, 'line-width': W_MEDIUM } },
      { id: 'street-major', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation',
        filter: ['all', notTunnel, cls('primary', 'trunk', 'motorway')],
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': C.street, 'line-width': W_MAJOR } },

      /* Avenue Charles de Gaulle : double filet fin de part et d'autre de la chaussée. */
      { id: 'axis-cdg-edges', type: 'line', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 13,
        filter: isAxis,
        layout: { 'line-cap': 'butt', 'line-join': 'round' },
        paint: {
          'line-color': C.axisEdge,
          'line-width': ['interpolate', ['linear'], ['zoom'], 13, 0.6, 17, 1],
          'line-gap-width': zw([11, 1.2], [16, 10], [18, 25]),
        } },

      /* Libellés */
      { id: 'water-name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'water_name',
        layout: {
          'text-field': NAME, 'text-font': FONT_ITALIC, 'text-size': 12.5, 'text-letter-spacing': 0.14,
          'symbol-placement': ['step', ['zoom'], 'point', 13, 'line'], 'symbol-spacing': 600,
        },
        paint: { 'text-color': C.labelWater, 'text-halo-color': C.haloLand, 'text-halo-width': 1 } },
      { id: 'axis-cdg-name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 13,
        filter: isAxis,
        layout: {
          'text-field': ['upcase', NAME], 'text-font': FONT_BOLD,
          'text-size': zw([13, 10], [18, 13]), 'text-letter-spacing': 0.2,
          'symbol-placement': 'line', 'symbol-spacing': 520, 'text-max-angle': 20, 'text-padding': 6,
        },
        paint: { 'text-color': C.labelAxis, 'text-halo-color': C.halo, 'text-halo-width': 1.4 } },
      { id: 'street-name-major', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 14,
        filter: ['all', cls('trunk', 'primary', 'secondary'), ['!', isAxis]],
        layout: {
          'text-field': ['upcase', NAME], 'text-font': FONT,
          'text-size': zw([14, 9], [18, 11.5]), 'text-letter-spacing': 0.16,
          'symbol-placement': 'line', 'symbol-spacing': 700, 'text-max-angle': 20, 'text-padding': 6,
        },
        paint: { 'text-color': C.labelMajor, 'text-halo-color': C.halo, 'text-halo-width': 1.3 } },
      { id: 'street-name-medium', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 16,
        filter: cls('tertiary'),
        layout: {
          'text-field': ['upcase', NAME], 'text-font': FONT,
          'text-size': zw([15, 9], [18, 11]), 'text-letter-spacing': 0.14,
          'symbol-placement': 'line', 'symbol-spacing': 700, 'text-max-angle': 20, 'text-padding': 6,
        },
        paint: { 'text-color': C.labelMajor, 'text-halo-color': C.halo, 'text-halo-width': 1.3 } },
      { id: 'street-name-minor', type: 'symbol', source: 'openmaptiles', 'source-layer': 'transportation_name', minzoom: 17,
        filter: cls('minor'),
        layout: {
          'text-field': NAME, 'text-font': FONT, 'text-size': 10.5, 'text-letter-spacing': 0.03,
          'symbol-placement': 'line', 'symbol-spacing': 520, 'text-max-angle': 20, 'text-padding': 6,
        },
        paint: { 'text-color': C.labelMinor, 'text-halo-color': C.halo, 'text-halo-width': 1.3 } },
      { id: 'place-name', type: 'symbol', source: 'openmaptiles', 'source-layer': 'place', maxzoom: 15.2,
        filter: cls('city', 'town', 'village', 'suburb'),
        layout: {
          'text-field': ['upcase', NAME], 'text-font': FONT_BOLD,
          'text-size': ['interpolate', ['linear'], ['zoom'], 11, 10.5, 15, 12.5], 'text-letter-spacing': 0.3,
          'text-max-width': 9,
        },
        paint: { 'text-color': C.labelPlace, 'text-halo-color': C.haloLand, 'text-halo-width': 1.4 } },
    ],
  };
}
