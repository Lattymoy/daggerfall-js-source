// @ts-check
// FOE-BOUNDS (2026-10-19, Mac: a hand-off spec, "LATTY: REJECT AND REMOVE INVALID ENEMY HANDOFFS; DO NOT RESCALE", then
// "Spec + B + A" and "The game's own code"; bible/11-Multiplayer/Spawn-Grants.md section 19): THE MOST HEALTH A STREAMED
// FOE CAN LEGALLY HAVE. Every stage that builds a foe's maximum rounds once and never lowers it (`Math.max(1,
// Math.round(prev * mult))`), so the highest base and every highest multiplier, in the builders' own order and with their
// rounding, is the exact legal maximum - for the inputs a reader cannot see taken at their worst: the owner's dice, its
// combat standing and hero level, a revenant's rank, wrath and the Dread, the wild ring, a Rite's Summoner. What the
// record says of itself only ever RAISES the bound (`z` an elite, `cp` a champion's trait, `nm` a revenant's name, `gg` a
// Greater Giant), so a record claiming none of them is held to the ordinary chain. A record over its bound is PROVABLY
// impossible: it is refused, never rescaled (the spec's own word). Pure, and the relay's too (GRANT9's strip).
//
// THE TWO CHAINS (the hand-off map, 2026-10-19):
//   - a street's or a building's foe (scenes/exteriorFoes.js spawnFoe): its base - an elite x5 (`z`) - progression
//     (systems/skillSoftcap.js progressionScaling, the wilderness by night at its worst, the hero at its worst) - a
//     champion's 2 x its trait (`cp`, never with `z`) - a revenant's rank, wrath and the Dread (`nm`) - the wild zone's 4 x
//     its heart ring - a Greater Giant x10 (`gg`) - a Rite's Summoner x3 (a class foe in a camp - the rite's faithful are
//     one, the frame's `cz` - scenes/riteHost.js riteFoe), or a fallen star's coven x2 (any foe in a camp - a star's are
//     one - scenes/starfall/starfallHost.js toughen; STAR-TUNE); and
//     the City Watch's own (scenes/cityGuards.js: its class roll, the open zone's x10);
//   - a dungeon's foe (scenes/dungeonContext.js buildFoeAt): its base - a Super dungeon's x4 and a Stalwart champion's x3
//     (more than any elite's x9) - progression at a Dragon's Den's worst - the wild dungeon's 4 x 2. The record carries no
//     `z`, `cp` or `nm` there (dungeonContext.js roomRecord), so the worst is taken; a revenant's lair stand is under it
//     (_spawnEncounter's record has no tier and no champion - dungeonContext.js marks the layout's alone - so its rank,
//     wrath and the Dread, x5.85 after the same progression and zone, never reach the layout's x12).
// A class foe's base is DFU's roll at its worst: 10 + its level x the most hit points a level any class gives
// (CreateCharCustomClass.cs's slider, systems/customClass.js HP_MAX). A monster's is the most of its row over the
// profiles a game can build with (vanilla, Meaner Monsters, Meaner Monsters with PCAAO's edit - online forces the last,
// systems/online/onlineLane.js ONLINE_ROOM_MOD_KEYS - and, DEX1, each of the three under Daggerfall Enemy Expansion's
// classic lines, a room's switch; and, MUDEX1, the mod's lines with MUDEX's after them - Meaner Monsters beside the mod,
// its own rows standing aside; the most of the seven, so a game that somehow built with them off is never refused).
// UNVERIFIED - no bound, never refused: a type with no row (the horse, 39; an unknown id; DEX1, a mod's own kind, 256 and
// up, whose career the relay does not hold), an ally, a companion or a crewman (the frame's own lists, which the caller
// leaves out), a boss's relay-kept body (not on this stream). The constants each builder owns are copied here, as net/grantLaw.js copies the elite's and the champion's -
// the relay cannot import the modules that hold them - and test/net/foebounds_law.test.js holds each equal to its home.
import { progressionScaling, foeShare, wildernessShare, placeVeteran, wildernessThreat, DUNGEON_SHARE } from '../systems/skillSoftcap.js';

/** The builders' multipliers, each from its home (held equal by the test). */
export const FOE_BOUND = Object.freeze({
  classBase: 10,            // characters/enemy/enemyEntity.js rollEnemyClassMaxHealth's `let maxHealth = baseHealth` (10)
  classHpPerLevel: 30,      // systems/customClass.js HP_MAX (CreateCharCustomClass.cs maxHpPerLevel)
  elite: 5,                 // systems/eliteFoes.js ELITE_FOE_HEALTH_MULT
  superFoe: 4,              // world/superDungeon/sdDungeon.js SUPER_HEALTH_SCALE
  champion: 2,              // systems/champions.js CHAMPION_HEALTH
  championTraits: Object.freeze([1, 1.5, 1, 1, 1]),   // systems/champions.js CHAMPION_TRAITS' `health` (1 where none), in the wire's order
  championMinLevel: 3,      // systems/champions.js CHAMPION_MIN_LEVEL
  revenantPerRank: 0.4,     // systems/revenant/revenant.js REVENANT_HEALTH_PER_RANK
  revenantRankMax: 5,       // systems/revenant/revenant.js REVENANT_MAX_RANK
  festerHealth: 0.1,        // systems/revenant/revenantFeud.js FESTER.HEALTH
  wrathMax: 3,              // systems/revenant/revenantFeud.js WRATH_MAX
  dread: 1.5,               // systems/revenant/revenantUnquiet.js DREAD.HEALTH
  wild: 4,                  // systems/wild/wildZone.js WILD_FOE_HEALTH_MULT
  wildRingTop: 2,           // systems/wild/wildZone.js WILD_RING_LOOT's heart
  giant: 10,                // systems/wild/wildZone.js WILD_GIANT_HEALTH_MULT
  giantType: 16,            // systems/wild/wildZone.js WILD_GIANT
  zoneWatch: 10,            // systems/wild/wildZone.js ZONE_WATCH_SCALE (scenes/world.js guardScale)
  rite: 3,                  // net/gate/gateRite.js RITE_SUMMONER_HEALTH
  star: 2,                  // net/starfall/starfallLaw.js STAR_FOE_HEALTH
  watch: 146,               // characters/mobile/mobileTypes.js KNIGHT_CITY_WATCH
  hero: Object.freeze({     // systems/heroThreat.js HERO_THREAT's health
    level: Object.freeze({ from: 10, to: 30, health: 1.04 }),
    renown: Object.freeze({ from: 15, to: 50, health: 1.005 }),
  }),
});

/** The hero's worst health factor: every level and every Renown that pays (systems/heroThreat.js heroThreat's top). */
export const FOE_HERO_HEALTH_MAX = FOE_BOUND.hero.level.health ** (FOE_BOUND.hero.level.to - FOE_BOUND.hero.level.from)
  * FOE_BOUND.hero.renown.health ** (FOE_BOUND.hero.renown.to - FOE_BOUND.hero.renown.from);

/** Each monster's row at its most over the seven profiles - [type, max health, level, share level] - held equal by the
 *  test to enemyBasics.js, the Meaner Monsters folds (characters/meanerMonsters.js applyMeanerMonsters, combat/
 *  pcaaoMeanerMonsters.js meanerMonstersRow) and DEX1's Daggerfall Enemy Expansion lines over each of the three
 *  (systems/enemyExpansion/dexInstall.js dexClassicRow: the mod writes its classic rows at its Start, after their Init -
 *  the Dragonling's 42 health its 146, the Werewolf's level 6 its 9), and MUDEX1's, the mod's lines with MUDEX's after
 *  them (`dexClassicRow(t, row, { mudex: true })` - the Flesh Atronach's 300 health, the Ice Atronach's level 21, both
 *  written into the table and so share levels too). The SHARE LEVEL is the level the builders' progression
 *  share reads (`foeShare(basics.level)`: the table's row, vanilla or the mod's - never a mint's fold), at its most; the
 *  relay reads it here, not the table, so the bound is the same on every machine whatever it has loaded. The horse (39)
 *  has none. */
export const FOE_BOUND_ROWS = Object.freeze(new Map([
  [0, [35, 1, 1]], [1, [20, 2, 2]], [2, [40, 3, 3]], [3, [26, 3, 3]], [4, [110, 4, 4]], [5, [80, 4, 4]],
  [6, [50, 4, 4]], [7, [70, 6, 6]], [8, [65, 5, 5]], [9, [66, 9, 9]], [10, [50, 6, 6]], [11, [50, 7, 7]],
  [12, [100, 9, 9]], [13, [85, 8, 8]], [14, [120, 11, 11]], [15, [66, 9, 9]], [16, [200, 10, 10]], [17, [125, 10, 10]],
  [18, [66, 11, 11]], [19, [190, 15, 15]], [20, [74, 12, 12]], [21, [110, 15, 15]], [22, [100, 14, 14]],
  [23, [90, 15, 15]], [24, [150, 19, 19]], [25, [160, 17, 17]], [26, [138, 17, 17]], [27, [146, 18, 18]],
  [28, [154, 19, 19]], [29, [146, 19, 19]], [30, [200, 20, 20]], [31, [285, 21, 21]], [32, [200, 20, 20]],
  [33, [210, 21, 21]], [34, [146, 18, 18]], [35, [130, 21, 16]], [36, [155, 21, 16]], [37, [300, 16, 16]],
  [38, [130, 21, 21]], [40, [250, 21, 16]], [41, [90, 16, 16]], [42, [74, 16, 16]],
]));

const isClass = (t) => t >= 128 && t <= 146;
/** One builder's stage: its multiplier, rounded once, never under 1. */
const stage = (v, m) => Math.max(1, Math.round(v * m));
/** A stage of progression at its worst for this foe, the place's worst handed in (pure: skillSoftcap's own formula). */
const worstProgression = (t, dShare, place) => progressionScaling({ veteran: 1, edge: Number.MAX_SAFE_INTEGER }, dShare, foeShare(FOE_BOUND_ROWS.get(t)?.[2], isClass(t)), place, { health: FOE_HERO_HEALTH_MAX, damage: 1 })?.healthMult ?? 1;
const revenantStages = (v) => stage(stage(stage(v, 1 + FOE_BOUND.revenantPerRank * FOE_BOUND.revenantRankMax), 1 + FOE_BOUND.festerHealth * FOE_BOUND.wrathMax), FOE_BOUND.dread);

/** A record's base: a class foe's roll at its level's worst, a monster's row - or null (no row: unverified). */
function baseOf(r) {
  if (isClass(r.t)) return Number.isInteger(r.l) && r.l >= 0 ? FOE_BOUND.classBase + r.l * FOE_BOUND.classHpPerLevel : null;
  return FOE_BOUND_ROWS.get(r.t)?.[0] ?? null;
}

/** The street's chain (spawnFoe's order) for record `r`; `wild` whether the open zone may be about it, `camp` whether it
 *  stands in a camp (a Rite's faithful do). */
function streetBound(r, base, wild, camp) {
  let v = base;
  if (r.z === 1) v = stage(v, FOE_BOUND.elite);
  v = stage(v, worstProgression(r.t, wildernessShare(true), placeVeteran(wildernessThreat(true))));
  if (r.z !== 1 && Number.isInteger(r.cp)) v = stage(v, FOE_BOUND.champion * (FOE_BOUND.championTraits[r.cp] ?? 1));
  if (typeof r.nm === 'string' && r.nm) v = revenantStages(v);
  if (wild) v = stage(v, FOE_BOUND.wild * FOE_BOUND.wildRingTop);
  if (Number.isInteger(r.gg) && r.t === FOE_BOUND.giantType) v = stage(v, FOE_BOUND.giant);
  if (camp) v = stage(v, isClass(r.t) ? Math.max(FOE_BOUND.rite, FOE_BOUND.star) : FOE_BOUND.star);   // STAR-TUNE: a fallen star's coven, any kind
  return r.t === FOE_BOUND.watch ? Math.max(v, wild ? stage(base, FOE_BOUND.zoneWatch) : base) : v;
}

/** The dungeon's chain (buildFoeAt's order): a layout foe's worst, which a revenant's lair stand never reaches. */
function dungeonBound(r, base, wild) {
  const v = stage(stage(stage(base, FOE_BOUND.superFoe), FOE_BOUND.champion * Math.max(...FOE_BOUND.championTraits)), worstProgression(r.t, Math.max(...DUNGEON_SHARE), 1));
  return wild ? stage(v, FOE_BOUND.wild * FOE_BOUND.wildRingTop) : v;
}

/**
 * THE MOST HEALTH record `r` can legally stand with - its lane's chain (`street`: a cell's or a building's pool;
 * `dungeon`: a dungeon's host or own lane; `any`: the larger, the relay's word for a world room's own lane), `wild`
 * whether the open zone may be about it, `camp` whether its frame tags it a camp's (unknown: true, each) - or null where
 * it is unverified. Pure.
 * @param {any} r a foe record (net/wire.js validFoeRecord's shape)
 * @param {{ lane?: 'street'|'dungeon'|'any', wild?: boolean, camp?: boolean }} [o]
 * @returns {number|null}
 */
export function foeHealthBound(r, { lane = 'street', wild = true, camp = true } = {}) {
  if (!r || !Number.isInteger(r.t)) return null;
  const base = baseOf(r);
  if (base == null) return null;
  if (lane === 'dungeon') return dungeonBound(r, base, wild);
  if (lane === 'any') return Math.max(streetBound(r, base, wild, camp), dungeonBound(r, base, wild));
  return streetBound(r, base, wild, camp);
}

/**
 * IS RECORD `r` PROVABLY IMPOSSIBLE? Its health or its maximum past foeHealthBound, or a mark no builder gives its kind
 * (the City Watch never an elite or a champion; a champion never under CHAMPION_MIN_LEVEL - systems/eliteFoes.js
 * eliteEligible, systems/champions.js applyChampion). Null when it stands; else what it claimed against what it may
 * (`{ t, k, mx }`: its type, its claimed maximum or health, the bound) - the evidence a case keeps. Pure.
 * @param {any} r @param {{ lane?: 'street'|'dungeon'|'any', wild?: boolean, camp?: boolean }} [o]
 * @returns {{ t: number, k: number, mx: number }|null}
 */
export function foeStatsRefusal(r, o = {}) {
  if (!r || !Number.isInteger(r.t)) return null;
  const level = isClass(r.t) ? r.l : FOE_BOUND_ROWS.get(r.t)?.[1];
  if (r.t === FOE_BOUND.watch && (r.z === 1 || Number.isInteger(r.cp))) return { t: r.t, k: r.k ?? r.h ?? 0, mx: 0 };
  if (Number.isInteger(r.cp) && Number.isInteger(level) && level < FOE_BOUND.championMinLevel) return { t: r.t, k: r.k ?? r.h ?? 0, mx: 0 };
  const mx = foeHealthBound(r, o);
  if (mx == null) return null;
  const k = Math.max(Number.isFinite(r.k) ? r.k : 0, Number.isFinite(r.h) ? r.h : 0);
  return k > mx ? { t: r.t, k, mx } : null;
}
