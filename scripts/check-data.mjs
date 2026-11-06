#!/usr/bin/env node
/** Contrôle rapide de data/quartier.json : npm run check */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, TYPES } from '../assets/js/config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const d = JSON.parse(await fs.readFile(path.join(ROOT, 'data/quartier.json'), 'utf8'));
const cats = new Set(CATEGORIES.map((c) => c.id));
const errors = [];
const ids = new Set();

if (!(d.office?.lat > 48.8 && d.office?.lat < 48.95 && d.office?.lon > 2.2 && d.office?.lon < 2.35)) errors.push('Position des bureaux incohérente');
for (const p of d.places) {
  const where = `${p.id} (${p.name})`;
  if (ids.has(p.id)) errors.push(`Identifiant en double : ${where}`);
  ids.add(p.id);
  if (!p.name) errors.push(`Nom manquant : ${p.id}`);
  if (!cats.has(p.cat)) errors.push(`Catégorie inconnue « ${p.cat} » : ${where}`);
  if (!TYPES[p.sub]) errors.push(`Type inconnu « ${p.sub} » : ${where}`);
  if (!(Math.abs(p.lat - d.office.lat) < 0.05 && Math.abs(p.lon - d.office.lon) < 0.07)) errors.push(`Coordonnées hors du quartier : ${where}`);
}
const missing = CATEGORIES.filter((c) => !d.places.some((p) => p.cat === c.id)).map((c) => c.label);
if (missing.length) errors.push(`Catégories vides : ${missing.join(', ')}`);

if (errors.length) {
  console.error(`✗ ${errors.length} problème(s) :\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
const counts = Object.fromEntries(CATEGORIES.map((c) => [c.label, d.places.filter((p) => p.cat === c.id).length]));
console.log(`✓ ${d.places.length} lieux valides, ${d.lines.features.length} tronçons de lignes, données du ${d.generatedAt.slice(0, 10)}`);
console.table(counts);
