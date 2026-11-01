// THE TABLES a designer edits - rocks, soils, biomes, plants and the
// provinces' profiles, each a JSON file under data/. The generator reads them through here and nowhere else, and
// `tableProblems` names a broken reference before a bake can read it.
import ROCKS_JSON from './data/rocks.json' with { type: 'json' };
import SOILS_JSON from './data/soils.json' with { type: 'json' };
import BIOMES_JSON from './data/biomes.json' with { type: 'json' };
import SPECIES_JSON from './data/species.json' with { type: 'json' };
import PROVINCES_JSON from './data/provinces.json' with { type: 'json' };
import { CLIMATES } from '../../formats/mapsTables.js';

/** @typedef {{ id: number, key: string, name: string, k: number, talus: number, hardness: number, soil: string, terrace: boolean, color: number[], ores: Record<string, number> }} Rock */
/** @typedef {{ id: number, key: string, name: string, depth: number, retention: number, fertility: number, drainage: number, erodibility: number, rock: number, color: number[] }} Soil */
/** @typedef {{ id: number, key: string, name: string, climate: number, color: number[], materials: Record<string, number>, species: string[] }} Biome */
/** @typedef {{ key: string, name: string, kind: string, temp: number[], precip: number[], soils: string[], slope: number, elev: number, water: string, reach?: number, sun: string, density: number, cluster: number, spacing: number }} Species */
/** @typedef {{ theatre: number, key: string, temp: number, precip: number, wind: number[], southWet: number, season: number, rugged: number, range: number, wet: number, style: string, rocks: Record<string, Record<string, number>> }} Province */

export const ROCKS = /** @type {readonly Rock[]} */ (Object.freeze(ROCKS_JSON.rocks));
export const SOILS = /** @type {readonly Soil[]} */ (Object.freeze(SOILS_JSON.soils));
export const BIOME_TABLE = /** @type {readonly Biome[]} */ (Object.freeze(BIOMES_JSON.biomes));
export const SPECIES = /** @type {readonly Species[]} */ (Object.freeze(SPECIES_JSON.species));
export const PROFILES = /** @type {readonly Province[]} */ (Object.freeze(PROVINCES_JSON.provinces));

const byKey = (rows) => new Map(rows.map((r) => [r.key, r]));
const ROCK_BY_KEY = byKey(ROCKS), SOIL_BY_KEY = byKey(SOILS), BIOME_BY_KEY = byKey(BIOME_TABLE), SPECIES_BY_KEY = byKey(SPECIES);
/** @param {string} k @returns {Rock} */ export const rock = (k) => /** @type {Rock} */ (ROCK_BY_KEY.get(k));
/** @param {string} k @returns {Soil} */ export const soil = (k) => /** @type {Soil} */ (SOIL_BY_KEY.get(k));
/** @param {string} k @returns {Biome} */ export const biome = (k) => /** @type {Biome} */ (BIOME_BY_KEY.get(k));
/** @param {string} k @returns {Species} */ export const species = (k) => /** @type {Species} */ (SPECIES_BY_KEY.get(k));
/** A theatre's profile; the Bay's for a theatre past the nine. @param {number} t @returns {Province} */
export const provinceProfile = (t) => PROFILES[t] ?? PROFILES[0];

/** Every broken reference among the tables, as words; none when they hold together. */
export function tableProblems() {
  const out = [];
  const ids = (rows, name) => rows.forEach((r, i) => { if (r.id !== i) out.push(`${name} ${r.key}: id ${r.id} at ${i}`); });
  ids(ROCKS, 'rock'); ids(SOILS, 'soil'); ids(BIOME_TABLE, 'biome');
  const climates = new Set(Object.values(CLIMATES));
  for (const r of ROCKS) if (!SOIL_BY_KEY.has(r.soil)) out.push(`rock ${r.key}: soil ${r.soil}`);
  for (const b of BIOME_TABLE) {
    if (!climates.has(b.climate)) out.push(`biome ${b.key}: climate ${b.climate}`);
    for (const s of b.species) if (!SPECIES_BY_KEY.has(s)) out.push(`biome ${b.key}: species ${s}`);
  }
  for (const s of SPECIES) {
    for (const k of s.soils) if (!SOIL_BY_KEY.has(k)) out.push(`species ${s.key}: soil ${k}`);
    if (!(s.temp[0] < s.temp[1] && s.precip[0] < s.precip[1])) out.push(`species ${s.key}: ranges`);
    if (!['needs', 'likes', 'any'].includes(s.water) || (s.water === 'needs' && !(s.reach > 0))) out.push(`species ${s.key}: water`);
  }
  PROFILES.forEach((p, i) => {
    if (p.theatre !== i) out.push(`province ${p.key}: theatre ${p.theatre} at ${i}`);
    for (const set of ['lowland', 'upland', 'range']) for (const k of Object.keys(p.rocks[set] ?? {})) if (!ROCK_BY_KEY.has(k)) out.push(`province ${p.key}: rock ${k}`);
  });
  return out;
}
