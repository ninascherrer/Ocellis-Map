#!/usr/bin/env node
/**
 * Copie les dépendances front (MapLibre, polices de la charte) dans vendor/ et génère
 * assets/js/icons.js à partir des pictogrammes Lucide. Le site n'a ainsi besoin d'aucun CDN
 * ni d'étape de build : vendor/ et assets/ sont versionnés.
 *
 * Usage : npm install && npm run vendor
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NM = path.join(ROOT, 'node_modules');
const cp = async (from, to) => {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
};

// MapLibre GL JS (ESM : le worker est résolu à côté du module principal)
for (const f of ['maplibre-gl.mjs', 'maplibre-gl-worker.mjs', 'maplibre-gl.css']) {
  await cp(path.join(NM, 'maplibre-gl/dist', f), path.join(ROOT, 'vendor/maplibre-gl', f));
}
await cp(path.join(NM, 'maplibre-gl/LICENSE.txt'), path.join(ROOT, 'vendor/maplibre-gl/LICENSE.txt'));

// Polices de la charte Ocellis : Poppins (titres) et Roboto (texte)
const fonts = [
  ['@fontsource/poppins/files/poppins-latin-500-normal.woff2', 'poppins-500.woff2'],
  ['@fontsource/poppins/files/poppins-latin-600-normal.woff2', 'poppins-600.woff2'],
  ['@fontsource/roboto/files/roboto-latin-400-normal.woff2', 'roboto-400.woff2'],
  ['@fontsource/roboto/files/roboto-latin-500-normal.woff2', 'roboto-500.woff2'],
  ['@fontsource/roboto/files/roboto-latin-700-normal.woff2', 'roboto-700.woff2'],
];
for (const [from, to] of fonts) await cp(path.join(NM, from), path.join(ROOT, 'vendor/fonts', to));
await cp(path.join(NM, '@fontsource/poppins/LICENSE'), path.join(ROOT, 'vendor/fonts/POPPINS-LICENSE.txt'));
await cp(path.join(NM, '@fontsource/roboto/LICENSE'), path.join(ROOT, 'vendor/fonts/ROBOTO-LICENSE.txt'));

// Pictogrammes Lucide (licence ISC) → module JS { nom: '<contenu SVG>' }
const ICONS = [
  // catégories
  'leaf', 'utensils', 'shopping-basket', 'cross', 'tram-front',
  // bien-être
  'dumbbell', 'waves-ladder', 'trees', 'mountain', 'trophy',
  // restaurants
  'coffee', 'croissant', 'sandwich', 'ice-cream-cone',
  // courses
  'shopping-cart', 'store', 'apple', 'beef', 'wine', 'fish', 'cake-slice', 'candy', 'snowflake', 'milk',
  // santé
  'hospital', 'stethoscope', 'pill', 'heart-pulse', 'siren', 'phone',
  // transports
  'train-front', 'bus-front', 'square-parking', 'bike', 'lock-keyhole', 'landmark',
  // interface
  'search', 'x', 'navigation', 'footprints', 'external-link', 'map-pin', 'locate-fixed', 'share-2',
  'chevron-up', 'chevron-down', 'sparkles', 'briefcase', 'heart', 'clock', 'info', 'route', 'check', 'list', 'map',
];
const out = {};
for (const name of ICONS) {
  const svg = await fs.readFile(path.join(NM, 'lucide-static/icons', `${name}.svg`), 'utf8');
  const inner = svg.replace(/<!--[\s\S]*?-->/, '').replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')
    .replace(/\s*\n\s*/g, '').trim();
  out[name] = inner;
}
const header = `// Généré par scripts/build-vendor.mjs — pictogrammes Lucide (https://lucide.dev), licence ISC.\n// Ne pas modifier à la main.\n`;
await fs.writeFile(path.join(ROOT, 'assets/js/icons.js'), `${header}export const LUCIDE = ${JSON.stringify(out, null, 0).replace(/","/g, '",\n  "')};\n`);
await cp(path.join(NM, 'lucide-static/LICENSE'), path.join(ROOT, 'vendor/LUCIDE-LICENSE.txt'));
console.log(`✓ vendor/ et assets/js/icons.js à jour (${ICONS.length} pictogrammes)`);
