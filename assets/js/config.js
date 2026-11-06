/**
 * Catégories, types de lieux et pictogrammes.
 * Une seule couleur (l'aubergine Ocellis) pour toutes les catégories : on les distingue par le pictogramme.
 */
/*
 * Une couleur sourde par catégorie (pastilles de la carte, pictogrammes de la liste et des filtres).
 * Tons choisis pour rester doux à côté de l'aubergine Ocellis, et contrastés avec un pictogramme blanc.
 */
export const CATEGORIES = [
  { id: 'bien-etre', label: 'Bien-être', short: 'Bien-être', icon: 'leaf', color: '#5f8f5a', blurb: 'Sport, piscine, parcs et jardins' },
  { id: 'restaurants', label: 'Restaurants', short: 'Restos', icon: 'utensils', color: '#a35f78', blurb: 'Déjeuners, cafés, boulangeries' },
  { id: 'courses', label: 'Courses', short: 'Courses', icon: 'shopping-basket', color: '#9e7b33', blurb: 'Supermarchés et supérettes' },
  { id: 'sante', label: 'Urgences & santé', short: 'Santé', icon: 'heart-pulse', color: '#b35a4c', blurb: 'Pharmacies et hôpital' },
  { id: 'transports', label: 'Transports', short: 'Transports', icon: 'tram-front', color: '#5b6f80', blurb: "Métro, RER, bus, Vélib', parkings" },
];
export const CATEGORY_COLOR = Object.fromEntries(CATEGORIES.map((c) => [c.id, c.color]));

/** Types de lieux : libellé + pictogramme (Lucide, ou « metro » dessiné à la main). */
export const TYPES = {
  // Bien-être
  sport: { label: 'Sport', icon: 'dumbbell' },
  piscine: { label: 'Piscine', icon: 'waves-ladder' },
  parc: { label: 'Parc', icon: 'trees' },
  jardin: { label: 'Jardin & square', icon: 'trees' },
  // Restaurants
  restaurant: { label: 'Restaurant', icon: 'utensils' },
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
  restaurants: ['restaurant', 'sur-le-pouce', 'cafe', 'boulangerie', 'glacier'],
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
