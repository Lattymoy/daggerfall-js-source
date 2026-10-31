// @ts-check
// FIXED-PVE STAGE 5 (bible/05-Combat/Fixed-PvE.md section 7): WHERE A SPECIES LIVES. One record a species: how it
// stands in each province (the nine of world/tamriel/tamrielGeography.js) or one of the game's regions, the climates
// it lives in outdoors (formats/mapsTables.js CLIMATES), the dungeons it lives in (formats/mapsFile.js DUNGEON_TYPES),
// and what it needs (a faction's presence, an event). A species with no record spawns nowhere; one with no art in the
// game spawns nowhere whatever its record says. Each record says how it stands in lore. Pure and seeded by nothing:
// the same place gives every player the same list. The spawn stage reads it. Ledger A (FIXED-PVE).
import { SPECIES_BY_KEY, CANDIDATE_SPECIES } from './pveSpecies.js';
import { MOB_TEMPLATES } from './pveTemplates.js';
import { PROVINCES } from '../../world/tamriel/tamrielGeography.js';
import { CLIMATES } from '../../formats/mapsTables.js';
import { DUNGEON_TYPES } from '../../formats/mapsFile.js';

/** How a species stands in a place, and what that makes its share of a spawn table. */
export const DISTRIBUTION = Object.freeze({ primary: 1, secondary: 0.4, localized: 0.6, conditional: 0.3, exceptional: 0.02, unavailable: 0 });
/** How a record stands in lore (spec 8.3): only an established or inferred one may be primary or secondary. */
export const LORE = Object.freeze(['established', 'inferred', 'proposed', 'requiresReview']);
/** @type {ReadonlyArray<string>} */
export const PROVINCE_KEYS = Object.freeze(PROVINCES.map((p) => p.key));
/** Every province. */
const ALL = '*';
/** Daggerfall's Orsinium Area, the orcs' Wrothgar: region index 26. FACTION.TXT counts regions from 1 (#358 says 27,
 *  as Daggerfall's #201 says 18 for region 17). */
export const ORSINIUM_REGION = 26;

const C = CLIMATES, D = DUNGEON_TYPES;
const WOODS = [C.Woodlands, C.MountainWoods, C.HauntedWoodlands, C.Rainforest, C.Subtropical];
const LAND = Object.values(C).filter((c) => c !== C.Ocean);
const R = (o) => Object.freeze({ climates: null, dungeons: [], needs: [], factions: [], regions: {}, note: '', ...o });

/** @typedef {{ species: string, provinces: Record<string, string>, regions?: Record<number, string>, climates?: number[]|null,
 *  dungeons?: number[], needs?: string[], factions?: string[], lore: string, note?: string }} Distribution */

/** @type {ReadonlyArray<Distribution>} */
export const BESTIARY = Object.freeze([
  // the orcs: Wrothgar first, a stronghold where a clan holds one, elsewhere through the clans alone (spec 11.2)
  R({ species: 'orc', provinces: { HighRock: 'secondary', Skyrim: 'secondary', Hammerfell: 'conditional', Valenwood: 'conditional', Imperial: 'conditional', Morrowind: 'conditional' },
    regions: { [ORSINIUM_REGION]: 'primary' }, climates: LAND, dungeons: [D.OrcStronghold], factions: ['orc-clans'], lore: 'established' }),
  R({ species: 'orc-sergeant', provinces: { HighRock: 'secondary', Skyrim: 'secondary' }, regions: { [ORSINIUM_REGION]: 'primary' }, climates: LAND, dungeons: [D.OrcStronghold], factions: ['orc-clans'], lore: 'established' }),
  R({ species: 'orc-shaman', provinces: { HighRock: 'secondary', Skyrim: 'secondary' }, regions: { [ORSINIUM_REGION]: 'primary' }, climates: LAND, dungeons: [D.OrcStronghold], factions: ['orc-clans'], lore: 'established' }),
  R({ species: 'orc-warlord', provinces: { HighRock: 'localized', Skyrim: 'localized' }, regions: { [ORSINIUM_REGION]: 'localized' }, climates: LAND, dungeons: [D.OrcStronghold], factions: ['orc-clans'], lore: 'established' }),
  // wildlife: a first pass by the climates each body suits - inferred unless Daggerfall names a dungeon for it
  R({ species: 'rat', provinces: { [ALL]: 'primary' }, climates: LAND, dungeons: [D.Crypt, D.Prison, D.Mine, D.NaturalCave, D.RuinedCastle, D.Cemetery], lore: 'established' }),
  R({ species: 'giant-bat', provinces: { [ALL]: 'secondary' }, dungeons: [D.NaturalCave, D.Mine, D.VampireHaunt, D.RuinedCastle], lore: 'inferred' }),
  R({ species: 'grizzly-bear', provinces: { HighRock: 'primary', Skyrim: 'primary', Valenwood: 'secondary', Imperial: 'secondary' }, climates: [C.Woodlands, C.MountainWoods, C.Mountain], dungeons: [D.NaturalCave], lore: 'inferred' }),
  R({ species: 'sabretooth-tiger', provinces: { Skyrim: 'primary', HighRock: 'secondary', Valenwood: 'secondary', Elsweyr: 'secondary' }, climates: [C.Mountain, C.MountainWoods, C.Woodlands, C.Rainforest], dungeons: [D.NaturalCave], lore: 'inferred' }),
  R({ species: 'spider', provinces: { [ALL]: 'secondary', Valenwood: 'primary', BlackMarsh: 'primary' }, climates: [...WOODS, C.Swamp], dungeons: [D.SpiderNest, D.NaturalCave], lore: 'established' }),
  R({ species: 'giant-scorpion', provinces: { Hammerfell: 'primary', Elsweyr: 'secondary' }, climates: [C.Desert, C.Desert2], dungeons: [D.ScorpionNest], lore: 'established' }),
  R({ species: 'slaughterfish', provinces: { [ALL]: 'secondary', BlackMarsh: 'primary' }, climates: [C.Ocean, C.Swamp], lore: 'established', note: 'water only' }),
  R({ species: 'dreugh', provinces: { [ALL]: 'localized', BlackMarsh: 'secondary', Sumurset: 'secondary' }, climates: [C.Ocean, C.Swamp], lore: 'established', note: 'coasts' }),
  R({ species: 'lamia', provinces: { BlackMarsh: 'primary', Elsweyr: 'secondary', Hammerfell: 'secondary' }, climates: [C.Swamp, C.Ocean, C.Subtropical], lore: 'inferred' }),
  // the wilds' people
  R({ species: 'spriggan', provinces: { [ALL]: 'secondary', Valenwood: 'primary' }, climates: WOODS, lore: 'inferred' }),
  R({ species: 'centaur', provinces: { HighRock: 'secondary', Hammerfell: 'secondary', Imperial: 'secondary' }, climates: [C.Woodlands, C.MountainWoods, C.Desert], lore: 'inferred' }),
  R({ species: 'nymph', provinces: { HighRock: 'localized', Valenwood: 'localized', Sumurset: 'localized' }, climates: WOODS, dungeons: [D.Coven], lore: 'inferred' }),
  R({ species: 'harpy', provinces: { HighRock: 'primary', Hammerfell: 'secondary', Elsweyr: 'secondary' }, climates: [C.Mountain, C.MountainWoods, C.Desert, C.Desert2], dungeons: [D.HarpyNest], lore: 'established' }),
  R({ species: 'giant', provinces: { Skyrim: 'primary', HighRock: 'secondary', Hammerfell: 'secondary' }, climates: [C.Mountain, C.MountainWoods], dungeons: [D.GiantStronghold], lore: 'established' }),
  R({ species: 'gargoyle', provinces: { HighRock: 'localized', Hammerfell: 'localized', Imperial: 'localized' }, dungeons: [D.RuinedCastle, D.DesecratedTemple, D.Laboratory], lore: 'inferred' }),
  R({ species: 'imp', provinces: { [ALL]: 'secondary' }, dungeons: [D.Laboratory, D.Coven, D.DesecratedTemple], lore: 'inferred' }),
  R({ species: 'dragonling', provinces: { [ALL]: 'exceptional', Hammerfell: 'localized' }, dungeons: [D.DragonsDen, D.VolcanicCaves], lore: 'inferred', note: 'a den' }),
  // the cursed: where a curse's lair is, or by night
  R({ species: 'werewolf', provinces: { [ALL]: 'conditional', HighRock: 'secondary', Skyrim: 'secondary' }, climates: [C.Woodlands, C.MountainWoods, C.HauntedWoodlands], needs: ['night'], lore: 'established' }),
  R({ species: 'wereboar', provinces: { [ALL]: 'conditional', HighRock: 'secondary' }, climates: [C.Woodlands, C.HauntedWoodlands], needs: ['night'], lore: 'established' }),
  // the dead, everywhere the dead lie (spec 10.3)
  R({ species: 'skeletal-warrior', provinces: { [ALL]: 'primary' }, dungeons: [D.Crypt, D.Cemetery, D.RuinedCastle, D.DesecratedTemple, D.Prison], lore: 'established' }),
  R({ species: 'zombie', provinces: { [ALL]: 'primary' }, dungeons: [D.Crypt, D.Cemetery, D.Laboratory], lore: 'established' }),
  R({ species: 'ghost', provinces: { [ALL]: 'secondary' }, climates: [C.HauntedWoodlands], dungeons: [D.Crypt, D.Cemetery, D.RuinedCastle], lore: 'established' }),
  R({ species: 'mummy', provinces: { [ALL]: 'localized', Hammerfell: 'secondary', Elsweyr: 'secondary' }, dungeons: [D.Crypt, D.DesecratedTemple], lore: 'established' }),
  R({ species: 'wraith', provinces: { [ALL]: 'secondary' }, dungeons: [D.Crypt, D.Cemetery, D.RuinedCastle], lore: 'established' }),
  R({ species: 'vampire', provinces: { [ALL]: 'localized' }, dungeons: [D.VampireHaunt, D.Crypt], lore: 'established' }),
  R({ species: 'ancient-vampire', provinces: { [ALL]: 'localized' }, dungeons: [D.VampireHaunt], lore: 'established' }),
  R({ species: 'lich', provinces: { [ALL]: 'localized' }, dungeons: [D.Crypt, D.Laboratory, D.DesecratedTemple], lore: 'established' }),
  R({ species: 'ancient-lich', provinces: { [ALL]: 'exceptional' }, dungeons: [D.Crypt, D.Laboratory], lore: 'established', note: 'the deepest crypts' }),
  // the Daedra and the summoned: a summoning site, or an incursion (spec 10.3, conditional everywhere)
  ...['frost-daedra', 'fire-daedra', 'daedroth', 'daedra-seducer', 'daedra-lord'].map((species) =>
    R({ species, provinces: { [ALL]: 'conditional' }, dungeons: [D.DesecratedTemple, D.Coven], needs: ['incursion'], lore: 'established' })),
  ...['fire-atronach', 'iron-atronach', 'flesh-atronach', 'ice-atronach'].map((species) =>
    R({ species, provinces: { [ALL]: 'localized' }, dungeons: [D.Laboratory, D.DesecratedTemple], lore: 'inferred', note: 'a conjurer\'s' })),
  // people: by faction and settlement, never as wildlife (spec 11.1) - bandits on every road
  ...['rogue', 'archer', 'healer', 'barbarian', 'thief', 'assassin', 'burglar', 'nightblade', 'warrior', 'ranger', 'knight'].map((species) =>
    R({ species, provinces: { [ALL]: 'secondary' }, climates: LAND, dungeons: [D.HumanStronghold, D.Prison, D.RuinedCastle, D.BarbarianStronghold], factions: ['bandits'], lore: 'inferred' })),
  ...['mage', 'sorcerer', 'battlemage', 'spellsword'].map((species) =>
    R({ species, provinces: { [ALL]: 'localized' }, dungeons: [D.Laboratory, D.Coven, D.Crypt], lore: 'inferred', note: 'necromancers and conjurers' })),
  // a species the spec names with no art: a record, never a spawn
  ...CANDIDATE_SPECIES.map((c) => R({ species: c.key, provinces: {}, lore: 'proposed', note: 'no art yet' })),
]);

export const BESTIARY_BY_SPECIES = new Map(BESTIARY.map((r) => [r.species, r]));

/** Whether `key` has a body the game can draw. */
const hasArt = (key) => SPECIES_BY_KEY.has(key);

/** Every reason `r` cannot stand (empty when it can). @param {Distribution} r */
export function distributionProblems(r) {
  const out = [];
  const cats = [...Object.values(r?.provinces ?? {}), ...Object.values(r?.regions ?? {})];
  if (!SPECIES_BY_KEY.has(r?.species) && !CANDIDATE_SPECIES.some((c) => c.key === r?.species)) out.push(`unknown species ${r?.species}`);
  for (const p of Object.keys(r?.provinces ?? {})) if (p !== ALL && !PROVINCE_KEYS.includes(p)) out.push(`unknown province ${p}`);
  for (const c of cats) if (!(c in DISTRIBUTION)) out.push(`unknown category ${c}`);
  if (!LORE.includes(r?.lore)) out.push(`no lore standing ${r?.lore}`);
  if (!hasArt(r?.species) && cats.some((c) => c !== 'unavailable')) out.push(`${r?.species} has no art and cannot spawn`);
  if ((r?.lore === 'proposed' || r?.lore === 'requiresReview') && cats.some((c) => c === 'primary' || c === 'secondary')) out.push(`a ${r.lore} record may not be primary or secondary`);
  if (cats.includes('conditional') && !(r?.needs?.length || r?.factions?.length)) out.push('a conditional record names no condition');
  if (cats.includes('localized') && !(r?.dungeons?.length || r?.climates?.length)) out.push('a localized record names no place');
  if (cats.includes('exceptional') && !r?.note) out.push('an exceptional record says no reason');
  const climates = new Set(/** @type {number[]} */ (Object.values(CLIMATES))), dungeons = new Set(/** @type {number[]} */ (Object.values(DUNGEON_TYPES)));
  for (const c of r?.climates ?? []) if (!climates.has(c)) out.push(`unknown climate ${c}`);
  for (const d of r?.dungeons ?? []) if (!dungeons.has(d)) out.push(`unknown dungeon type ${d}`);
  return out;
}

/**
 * How `r`'s species stands at a place: a region's word over its province's over every province's, then the place's
 * own rules - in a dungeon only its dungeon types; outdoors only its climates, and never a localized one there unless its
 * climates name the place; a need or a faction met.
 * @param {Distribution} r
 * @param {{ province?: string, region?: number|null, climate?: number|null, dungeon?: number|null, met?: Iterable<string>, factions?: Iterable<string> }} at
 */
export function speciesStandingAt(r, { province, region = null, climate = null, dungeon = null, met = [], factions = [] } = {}) {
  if (!hasArt(r.species)) return 'unavailable';
  const cat = (region != null ? r.regions?.[region] : undefined) ?? r.provinces[province ?? ''] ?? r.provinces[ALL] ?? 'unavailable';
  if (cat === 'unavailable') return cat;
  if (dungeon != null && dungeon !== DUNGEON_TYPES.NoDungeon) { if (!r.dungeons?.includes(dungeon)) return 'unavailable'; }
  else if (!r.climates || (climate != null && !r.climates.includes(climate))) return 'unavailable';
  const metSet = new Set(met), held = new Set(factions);
  if (r.needs?.length && !r.needs.every((n) => metSet.has(n))) return 'unavailable';
  if (r.factions?.length && !r.factions.some((f) => held.has(f))) return 'unavailable';
  return cat;
}

/** The species a place may hold and each one's share, by key - the same list for every player. @param {Parameters<typeof speciesStandingAt>[1]} at */
export function regionalSpecies(at) {
  return BESTIARY.map((r) => ({ species: r.species, standing: speciesStandingAt(r, at) }))
    .filter((x) => DISTRIBUTION[x.standing] > 0)
    .map((x) => ({ ...x, weight: DISTRIBUTION[x.standing] }))
    .sort((a, b) => a.species.localeCompare(b.species));
}

/** The templates a place may hold: those whose species it holds, at that species' share; one held to an area (a raid
 *  boss, RAID-AREAS) only in that area. @param {Parameters<typeof speciesStandingAt>[1] & { area?: string|null }} at */
export function regionalTemplates(at) {
  const w = new Map(regionalSpecies(at).map((x) => [x.species, x.weight]));
  return MOB_TEMPLATES.filter((t) => w.has(t.species) && (!t.area || t.area === at.area))
    .map((t) => ({ template: t.key, weight: /** @type {number} */ (w.get(t.species)) }));
}
