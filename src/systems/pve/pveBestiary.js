// @ts-check
// FIXED-PVE STAGE 5 (bible/05-Combat/Fixed-PvE.md section 7): WHERE A SPECIES LIVES. One record a species: how it
// stands in each province (the nine of world/tamriel/tamrielGeography.js) or one of the game's regions, the climates
// it lives in outdoors (formats/mapsTables.js CLIMATES), the dungeons it lives in (formats/mapsFile.js DUNGEON_TYPES),
// and what it needs (a faction's presence, an event). A species with no record spawns nowhere; one with no art in the
// game spawns nowhere whatever its record says. Each record says how it stands in lore. Pure and seeded by nothing:
// the same place gives every player the same list. The spawn stage reads it. Ledger A (FIXED-PVE).
import { SPECIES_BY_KEY, SPECIES_BY_BODY, CANDIDATE_SPECIES, DEX_SPECIES } from './pveSpecies.js';
import { tamrielBiomeAt } from '../../world/tamriel/tamrielBiomes.js';   // REGIONAL-PVE: Latty's zones past the Bay
import { ROSTERS, faunaRoster } from '../tamrielFauna.js';   // ... and what each one's wild holds
import { dexLoaded } from '../enemyExpansion/dexSwitches.js';
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
  // REGIONAL-PVE: Daggerfall Enemy Expansion's creatures live past the Bay through their zone's roster alone - no
  // province of PvE's own list holds them, so the Bay stays as it was (zoneRosterAt above)
  ...DEX_SPECIES.map((dexSpecies) => R({ species: dexSpecies.key, provinces: {}, lore: 'established', note: 'past the Bay, by its zone roster' })),
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
  else if (SPECIES_BY_KEY.get(r.species)?.aquatic && climate !== CLIMATES.Ocean) return 'unavailable';   // REGIONAL-PVE: a water body never moves on land (AUDIT TESA-BIOME F1)
  const metSet = new Set(met), held = new Set(factions);
  if (r.needs?.length && !r.needs.every((n) => metSet.has(n))) return 'unavailable';
  if (r.factions?.length && !r.factions.some((f) => held.has(f))) return 'unavailable';
  return cat;
}

// REGIONAL-PVE (2026-10-31; bible/03-World/Tamriel-Biomes.md "The rosters"): PAST THE BAY, OUTDOORS, THE ZONE'S ROSTER
// DECIDES. Latty's 44 zones each name what their wild holds by day and by night, at a rarity; PvE takes that list for
// which species stand at a place and how often, and keeps its own law for everything else - its fixed level bands, its
// templates, its factions (a people's record still asks its faction), its dungeons (a dungeon keeps PvE's own list, as
// the encounter law keeps DFU's dungeon tables). On the Bay, at sea and inside, nothing changes.
/** A roster rarity's share of a spawn table: common as primary, uncommon as secondary, rare below it, very rare as the
 *  exceptional (so the rare population draws it). */
export const ROSTER_SHARE = Object.freeze({ C: DISTRIBUTION.primary, U: DISTRIBUTION.secondary, R: 0.15, V: DISTRIBUTION.exceptional });
const ROSTER_STANDING = Object.freeze({ C: 'primary', U: 'secondary', R: 'rare', V: 'exceptional' });

/** The zone roster at world pixel (`px`, `py`) - [species key, rarity] pairs, by day or by night, the bodies the game
 *  loaded (faunaRoster: Enemy Expansion's, else each one's classic stand-in) - or null: no pixel, the Bay, the sea.
 *  @param {number|undefined} px @param {number|undefined} py @param {boolean} night */
export function zoneRosterAt(px, py, night, dex = dexLoaded()) {
  if (!Number.isFinite(px) || !Number.isFinite(py)) return null;
  const biome = tamrielBiomeAt(Math.floor(/** @type {number} */ (px)), Math.floor(/** @type {number} */ (py)));
  const roster = biome && ROSTERS[biome.key];
  if (!roster) return null;
  const out = [];
  for (const [id, rarity] of faunaRoster(night ? roster.night : roster.day, dex)) {
    const species = SPECIES_BY_BODY.get(id);
    if (species && !species.aquatic) out.push([species.key, rarity]);
  }
  return { zone: biome.key, entries: out };
}

/** The species a place may hold and each one's share, by key - the same list for every player. Past the Bay outdoors,
 *  the zone's roster (REGIONAL-PVE). @param {Parameters<typeof speciesStandingAt>[1] & { px?: number, py?: number }} at */
export function regionalSpecies(at) {
  const indoors = at.dungeon != null && at.dungeon !== DUNGEON_TYPES.NoDungeon;
  const roster = indoors ? null : zoneRosterAt(at.px, at.py, [...(at.met ?? [])].includes('night'));
  if (roster) {
    // the roster sets the creatures; people (the outlaws, the orc clans' and the mages') keep PvE's own law, so a road's
    // bands and a camp's groups stand past the Bay as on it
    const beasts = roster.entries.filter(([k]) => SPECIES_BY_KEY.get(k)?.kind === 'monster' && !ORC_SPECIES.has(k))
      .map(([species, rarity]) => ({ species, standing: ROSTER_STANDING[rarity], weight: ROSTER_SHARE[rarity] }));
    const people = ownSpecies(at).filter((x) => SPECIES_BY_KEY.get(x.species)?.kind === 'class' || ORC_SPECIES.has(x.species));
    return [...beasts, ...people].sort((a, b) => a.species.localeCompare(b.species));
  }
  return ownSpecies(at);
}
/** The orcs are a people here (their clans, their strongholds), whatever body they wear. */
const ORC_SPECIES = new Set(['orc', 'orc-sergeant', 'orc-shaman', 'orc-warlord']);
/** PvE's own list at a place (the bestiary's records). @param {Parameters<typeof speciesStandingAt>[1]} at */
function ownSpecies(at) {
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
