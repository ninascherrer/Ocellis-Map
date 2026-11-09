/**
 * Catégories, types de lieux et pictogrammes.
 *
 * Une couleur par catégorie, tirée de la charte graphique Ocellis (couleurs du site ocellis.fr),
 * chaque teinte étant associée à sa couleur « partenaire » de la charte pour le pictogramme :
 *  - rose #F9D7F6 + prune #2B041A, jaune #F2E29C + bleu nuit #010D2D,
 *  - vert clair #B0D6AA + vert foncé #032A02 (et l'inverse pour la santé, façon croix de pharmacie),
 *  - bleu nuit #010D2D + blanc Ocellis #F1EFEB.
 * Champs :
 *  - color : fond de la pastille ;
 *  - glyph : pictogramme sur la pastille ;
 *  - edge  : filet extérieur fin des pastilles claires, pour qu'elles se détachent du fond de carte ;
 *  - ink   : pictogrammes de la liste et des filtres (variation foncée de la teinte, lisible sur fond clair).
 * L'aubergine pleine reste réservée au marqueur Ocellis et aux interactions.
 */
export const CATEGORIES = [
  { id: 'bien-etre', label: 'Bien-être', short: 'Bien-être', icon: 'leaf', color: '#b0d6aa', glyph: '#032a02', edge: 'rgba(3,42,2,0.32)', ink: '#498440', blurb: 'Sport, piscine, parcs et jardins' },
  { id: 'restaurants', label: 'Restaurants', short: 'Restos', icon: 'utensils', color: '#f9d7f6', glyph: '#2b041a', edge: 'rgba(43,4,26,0.32)', ink: '#2b041a', blurb: 'Déjeuners, brasseries, cafés, boulangeries' },
  { id: 'courses', label: 'Courses', short: 'Courses', icon: 'shopping-basket', color: '#f2e29c', glyph: '#010d2d', edge: 'rgba(1,13,45,0.32)', ink: '#897312', blurb: 'Supermarchés et supérettes' },
  { id: 'sante', label: 'Urgences & santé', short: 'Santé', icon: 'heart-pulse', color: '#032a02', glyph: '#b0d6aa', ink: '#032a02', blurb: 'Pharmacies et hôpital' },
  { id: 'transports', label: 'Transports', short: 'Transports', icon: 'tram-front', color: '#010d2d', glyph: '#f1efeb', ink: '#010d2d', blurb: "Métro, RER, bus, Vélib', parkings" },
];
export const CATEGORY_COLOR = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.color]));
export const CATEGORY_STYLE = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));
/** Variables CSS d'une catégorie, pour la liste, les filtres et les fiches. */
export const catVars = (id) => {
  const c = CATEGORY_STYLE[id];
  return c ? `--cat:${c.color};--cat-ink:${c.ink};--cat-glyph:${c.glyph}` : '';
};

/** Types de lieux : libellé + pictogramme (Lucide, ou « metro » dessiné à la main). */
export const TYPES = {
  // Bien-être
  sport: { label: 'Sport', icon: 'dumbbell' },
  piscine: { label: 'Piscine', icon: 'waves-ladder' },
  parc: { label: 'Parc', icon: 'trees' },
  jardin: { label: 'Jardin & square', icon: 'trees' },
  // Restaurants
  restaurant: { label: 'Restaurant', icon: 'utensils' },
  brasserie: { label: 'Brasserie', icon: 'beer' },
  'sur-le-pouce': { label: 'Sur le pouce', icon: 'sandwich' },
  cafe: { label: 'Café', icon: 'coffee' },
  boulangerie: { label: 'Boulangerie', icon: 'croissant' },
  glacier: { label: 'Glacier', icon: 'ice-cream-cone' },
  // Courses
  supermarche: { label: 'Supermarché', icon: 'shopping-cart' },
  superette: { label: 'Supérette', icon: 'shopping-basket' },
  primeur: { label: 'Primeur', icon: 'apple' },
  boucherie: { label: 'Boucherie', icon: 'beef' },
  'epicerie-fine': { label: 'Épicerie fine', icon: 'store' },
  marche: { label: 'Marché', icon: 'store' },
  fromagerie: { label: 'Fromagerie', icon: 'milk' },
  poissonnerie: { label: 'Poissonnerie', icon: 'fish' },
  caviste: { label: 'Caviste', icon: 'wine' },
  patisserie: { label: 'Pâtisserie', icon: 'cake-slice' },
  chocolatier: { label: 'Chocolatier', icon: 'candy' },
  surgeles: { label: 'Surgelés', icon: 'snowflake' },
  // Santé
  pharmacie: { label: 'Pharmacie', icon: 'cross' },
  hopital: { label: 'Hôpital', icon: 'hospital' },
  clinique: { label: 'Clinique', icon: 'hospital' },
  'centre-medical': { label: 'Centre médical', icon: 'stethoscope' },
  // Transports
  metro: { label: 'Métro', icon: 'metro' },
  rer: { label: 'RER', icon: 'train-front' },
  tram: { label: 'Tramway', icon: 'tram-front' },
  bus: { label: 'Bus', icon: 'bus-front' },
  velib: { label: "Vélib'", icon: 'bike' },
  'parking-velo': { label: 'Parking vélos', icon: 'lock-keyhole' },
  parking: { label: 'Parking', icon: 'square-parking' },
};

/** Ordre d'affichage des sous-filtres par catégorie. */
export const TYPE_ORDER = {
  'bien-etre': ['sport', 'piscine', 'parc', 'jardin'],
  restaurants: ['restaurant', 'brasserie', 'sur-le-pouce', 'cafe', 'boulangerie', 'glacier'],
  courses: ['supermarche', 'superette', 'primeur', 'boucherie', 'fromagerie', 'poissonnerie', 'epicerie-fine', 'marche', 'caviste', 'patisserie', 'chocolatier', 'surgeles'],
  sante: ['pharmacie', 'hopital', 'clinique', 'centre-medical'],
  transports: ['metro', 'rer', 'tram', 'bus', 'velib', 'parking-velo', 'parking'],
};

/** Pictogramme « M » du métro, même grille et même trait que Lucide. */
export const CUSTOM_ICONS = {
  metro: '<path d="M5.5 18.5V6.2c0-.5.6-.7.9-.3L12 13l5.6-7.1c.3-.4.9-.2.9.3v12.3" />',
};

/** Numéros d'urgence (France). */
export const EMERGENCY_NUMBERS = [
  { num: '15', label: 'SAMU', hint: 'Urgence médicale' },
  { num: '18', label: 'Pompiers', hint: 'Incendie, accident' },
  { num: '17', label: 'Police secours', hint: '' },
  { num: '112', label: 'Urgence européenne', hint: 'Depuis tout téléphone' },
  { num: '114', label: 'Urgences par SMS', hint: 'Personnes sourdes ou malentendantes' },
  { num: '3237', label: 'Pharmacie de garde', hint: 'Service payant' },
];

/** Vitesse de marche et détour moyen pour estimer les temps à pied. */
export const WALK = { metersPerMinute: 75, detour: 1.25 };

/** Cercles « temps à pied » autour des bureaux. */
export const WALK_RINGS = [5, 10, 15];
