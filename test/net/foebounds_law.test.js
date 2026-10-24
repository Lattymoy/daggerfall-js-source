// FOE-BOUNDS (2026-10-19, Mac: the hand-off spec "LATTY: REJECT AND REMOVE INVALID ENEMY HANDOFFS; DO NOT RESCALE", then
// "Spec + B + A" and "The game's own code"; bible/11-Multiplayer/Spawn-Grants.md section 19): THE MOST HEALTH A STREAMED
// FOE CAN LEGALLY HAVE (net/foeBounds.js), held to the builders it copies - each constant equal to its home, each row to
// the three profiles' most, and each bound EQUAL to what the game's own builders make of a foe at its worst (the spec's
// "exact legal max and max+1": the maximum stands, one more is refused).
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FOE_BOUND, FOE_BOUND_ROWS, FOE_HERO_HEALTH_MAX, foeHealthBound, foeStatsRefusal } from '../../src/net/foeBounds.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { rollEnemyClassMaxHealth, applyProgressionScaling } from '../../src/characters/enemy/enemyEntity.js';
import { applyMeanerMonsters } from '../../src/characters/meanerMonsters.js';
import { meanerMonstersRow } from '../../src/combat/pcaaoMeanerMonsters.js';
import { dexClassicRow } from '../../src/systems/enemyExpansion/dexInstall.js';   // DEX1: the enemy mod's classic lines, its switch aside
import { HP_MAX } from '../../src/systems/customClass.js';
import { ELITE_FOE_HEALTH_MULT, promoteEliteFoe } from '../../src/systems/eliteFoes.js';
import { SUPER_HEALTH_SCALE, scaleSuperFoe } from '../../src/world/superDungeon/sdDungeon.js';
import { CHAMPION_HEALTH, CHAMPION_TRAITS, CHAMPION_MIN_LEVEL, applyChampion, _resetStreetChampionsForTests } from '../../src/systems/champions.js';
import { REVENANT_HEALTH_PER_RANK, REVENANT_MAX_RANK, applyRevenant } from '../../src/systems/revenant/revenant.js';
import { FESTER, WRATH_MAX } from '../../src/systems/revenant/revenantFeud.js';
import { DREAD } from '../../src/systems/revenant/revenantUnquiet.js';
import { WILD_FOE_HEALTH_MULT, WILD_RING_LOOT, WILD_RINGS, WILD_GIANT_HEALTH_MULT, WILD_GIANT, ZONE_WATCH_SCALE, applyWildFoe } from '../../src/systems/wild/wildZone.js';
import { RITE_SUMMONER_HEALTH } from '../../src/net/gate/gateRite.js';
import { STAR_FOE_HEALTH } from '../../src/net/starfall/starfallLaw.js';
import { KNIGHT_CITY_WATCH } from '../../src/characters/mobile/mobileTypes.js';
import { HERO_THREAT, heroThreat } from '../../src/systems/heroThreat.js';
import { progressionScaling, foeShare, wildernessShare, placeVeteran, wildernessThreat, DUNGEON_SHARE, EFFECTIVE_SKILL_MAX, SKILL_SOFT_CAP } from '../../src/systems/skillSoftcap.js';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';

const ladder = () => { _resetForTests(); setPref('lootRarity', true); _resetStreetChampionsForTests(); };
const MONSTERS = [...FOE_BOUND_ROWS.keys()];
const isClass = (t) => t >= 128;
/** A foe at its worst roll, as the builders hold it. */
const entityOf = (t, l) => {
  const max = isClass(t) ? rollEnemyClassMaxHealth(l, HP_MAX, () => 0.999999) : FOE_BOUND_ROWS.get(t)[0];
  return { mobileType: t, level: isClass(t) ? l : FOE_BOUND_ROWS.get(t)[1], maxHealth: max, health: max };
};
const worst = (t, dShare, place) => progressionScaling({ veteran: 1, edge: EFFECTIVE_SKILL_MAX - SKILL_SOFT_CAP }, dShare, foeShare(isClass(t) ? null : FOE_BOUND_ROWS.get(t)[2], isClass(t)), place, heroThreat(HERO_THREAT.level.to, HERO_THREAT.renown.to));
const revenantAt = (e) => applyRevenant(e, { id: 'rvn-bound', name: 'Grak', mobileType: e.mobileType, rank: REVENANT_MAX_RANK, wrath: WRATH_MAX, dread: true, wounds: [], learned: [], history: [], returns: 0 });

test('FOE-BOUNDS EACH MULTIPLIER IS ITS HOME\'S: the class roll, the elite, the Super dungeon, the champion and its traits, the revenant\'s rank, wrath and Dread, the wild zone, the Greater Giant, the zone\'s watch, the Rite\'s Summoner, a star\'s coven, the City Watch and the hero - copied because the relay cannot import their homes, equal to each (mutants: each copy off its home)', () => {
  assert.equal(rollEnemyClassMaxHealth(7, 1, () => 0), FOE_BOUND.classBase + 7, 'DFU\'s class roll: 10 and a die a level');
  assert.deepEqual([FOE_BOUND.classHpPerLevel, FOE_BOUND.elite, FOE_BOUND.superFoe, FOE_BOUND.champion, FOE_BOUND.championMinLevel], [HP_MAX, ELITE_FOE_HEALTH_MULT, SUPER_HEALTH_SCALE, CHAMPION_HEALTH, CHAMPION_MIN_LEVEL]);
  assert.deepEqual(FOE_BOUND.championTraits, CHAMPION_TRAITS.map((t) => t.health ?? 1));
  assert.deepEqual([FOE_BOUND.revenantPerRank, FOE_BOUND.revenantRankMax, FOE_BOUND.festerHealth, FOE_BOUND.wrathMax, FOE_BOUND.dread], [REVENANT_HEALTH_PER_RANK, REVENANT_MAX_RANK, FESTER.HEALTH, WRATH_MAX, DREAD.HEALTH]);
  assert.deepEqual([FOE_BOUND.wild, FOE_BOUND.wildRingTop, FOE_BOUND.giant, FOE_BOUND.giantType, FOE_BOUND.zoneWatch], [WILD_FOE_HEALTH_MULT, WILD_RING_LOOT[WILD_RINGS - 1], WILD_GIANT_HEALTH_MULT, WILD_GIANT, ZONE_WATCH_SCALE]);
  assert.deepEqual([FOE_BOUND.rite, FOE_BOUND.star, FOE_BOUND.watch], [RITE_SUMMONER_HEALTH, STAR_FOE_HEALTH, KNIGHT_CITY_WATCH]);
  assert.deepEqual(FOE_BOUND.hero, { level: { from: HERO_THREAT.level.from, to: HERO_THREAT.level.to, health: HERO_THREAT.level.health }, renown: { from: HERO_THREAT.renown.from, to: HERO_THREAT.renown.to, health: HERO_THREAT.renown.health } });
  assert.equal(FOE_HERO_HEALTH_MAX, heroThreat(1000, 1000).health, 'the hero at its worst');
  assert.equal(FOE_HERO_HEALTH_MAX, 2.6090292465253375, 'the spec\'s figure');
});

test('FOE-BOUNDS EACH MONSTER\'S ROW AT ITS MOST: the most health and the most level of its vanilla row, Ralzar\'s Meaner Monsters and Kirk.O\'s edit over it, and DEX1 Daggerfall Enemy Expansion\'s classic lines over each (the mod\'s Start after their Init) - and the most level its TABLE row holds, the progression share\'s - all 42 monsters, never the horse; a class foe has no row (mutants: a row one off; one profile left out)', () => {
  const want = Object.entries(ENEMY_BASICS).filter(([t, b]) => +t < 128 && b.maxHealth != null).map(([ts, b]) => {
    const t = +ts, mm = applyMeanerMonsters(t, b, true), both = meanerMonstersRow(t, mm, true);
    // DEX1: the mod loaded writes its lines into the table (d0), and at a foe's mint over the folds of that row
    const d0 = dexClassicRow(t, b), dmm = dexClassicRow(t, applyMeanerMonsters(t, d0, true)), dboth = dexClassicRow(t, meanerMonstersRow(t, applyMeanerMonsters(t, d0, true), true));
    // MUDEX1: Meaner Monsters beside the mod is MUDEX - its lines read after the mod's, written into the table (so its
    // level is a share level too); Meaner Monsters' own rows and PCAAO's edit stand aside
    const dx = dexClassicRow(t, b, { mudex: true });
    const all = [b, mm, both, d0, dmm, dboth, dx];
    return [t, [Math.max(...all.map((p) => p.maxHealth)), Math.max(...all.map((p) => p.level)), Math.max(b.level, d0.level, dx.level)]];
  });
  assert.deepEqual([...FOE_BOUND_ROWS], want);
  assert.equal(FOE_BOUND_ROWS.size, 42);
  assert.equal(foeHealthBound({ t: 39, k: 1e5 }), null, 'the horse: unverified');
  assert.equal(foeHealthBound({ t: 200, k: 1e5 }), null, 'an unknown type: unverified');
  assert.equal(foeHealthBound({ t: 256, k: 1e5 }), null, 'DEX1: a mod\'s own kind (the Goblin): unverified - the relay holds no career of it');
  assert.equal(foeStatsRefusal({ t: 34, k: 146, h: 146 }), null, 'DEX1: the mod\'s Dragonling at its row (146) stands - it was refused at 60');
});

test('FOE-BOUNDS THE STREET\'S BOUND IS ITS BUILDERS\' WORST, EXACTLY: every monster and a class foe at three levels, built through the game\'s own stages in spawnFoe\'s order - its row, an elite (`z`), progression at night with the hero at his worst, a Stalwart champion (`cp`), a revenant at rank 5 with full wrath and the Dread (`nm`), the wild heart, a Greater Giant (`gg`), a Rite\'s Summoner or a star\'s coven - stand at their bound, and one more is refused (mutants: a stage left out; the order or the rounding changed)', () => {
  ladder();
  const night = (e) => applyProgressionScaling(e, worst(e.mobileType, wildernessShare(true), placeVeteran(wildernessThreat(true))));
  const cases = [...MONSTERS.map((t) => [t, null]), [135, 1], [135, 37], [KNIGHT_CITY_WATCH, 100]];
  for (const [t, l] of cases) {
    for (const flags of [{}, { z: 1 }, { cp: 1 }, { nm: 'Grak' }, { z: 1, nm: 'Grak', wild: true }, { cp: 1, wild: true, camp: true }]) {
      if (t === KNIGHT_CITY_WATCH && (flags.z || Number.isInteger(flags.cp))) continue;   // never the watch's
      const e = entityOf(t, l);
      if (flags.z) assert.ok(promoteEliteFoe(e) || e.level < 3, `${t} elite`);
      if (flags.z && !e.eliteFoe) continue;   // ELITE-FLOOR: not this kind
      night(e);
      if (Number.isInteger(flags.cp) && !applyChampion(e, flags.cp)) continue;   // under its level
      if (flags.nm) revenantAt(e);
      if (flags.wild) applyWildFoe(e, { ring: WILD_RINGS });
      if (flags.camp) e.maxHealth = Math.max(1, Math.round(e.maxHealth * (isClass(t) ? Math.max(RITE_SUMMONER_HEALTH, STAR_FOE_HEALTH) : STAR_FOE_HEALTH)));   // scenes/riteHost.js riteFoe's own line; STAR-TUNE: a star's coven (scenes/starfall/starfallHost.js toughen), any kind
      const r = { t, ...(l != null ? { l } : {}), ...(flags.z ? { z: 1 } : {}), ...(Number.isInteger(flags.cp) ? { cp: flags.cp } : {}), ...(flags.nm ? { nm: flags.nm } : {}) };
      const o = { wild: !!flags.wild, camp: !!flags.camp };
      assert.equal(foeHealthBound(r, o), e.maxHealth, `${t}/${l} ${JSON.stringify(flags)}`);
      assert.equal(foeStatsRefusal({ ...r, k: e.maxHealth, h: e.maxHealth }, o), null, 'the maximum stands');
      assert.deepEqual(foeStatsRefusal({ ...r, k: e.maxHealth + 1 }, o), { t, k: e.maxHealth + 1, mx: e.maxHealth }, 'one more is refused');
    }
  }
  // the Greater Giant: x10 after the zone (exteriorFoes.js spawnFoe's own line)
  const g = entityOf(WILD_GIANT, null);
  promoteEliteFoe(g); night(g); applyWildFoe(g, { ring: WILD_RINGS });
  const gg = Math.max(1, Math.round(g.maxHealth * WILD_GIANT_HEALTH_MULT));
  assert.equal(foeHealthBound({ t: WILD_GIANT, z: 1, gg: 0 }, { camp: false }), gg);   // STAR-TUNE: a giant stands in no camp (unknown, a camp's coven's x2 is its worst)
  // the City Watch: its class roll and the open zone's x10 (scenes/cityGuards.js) - under its encounter's chain
  const w = entityOf(KNIGHT_CITY_WATCH, 40);
  assert.ok(foeHealthBound({ t: KNIGHT_CITY_WATCH, l: 40 }, { wild: true, camp: false }) >= Math.round(w.maxHealth * ZONE_WATCH_SCALE));
});

test('FOE-BOUNDS THE DUNGEON\'S BOUND IS ITS BUILDERS\' WORST, EXACTLY: a layout foe - a Super dungeon\'s x4, a Stalwart champion, progression at a Dragon\'s Den\'s worst, the wild dungeon - the record carrying no marks there; a revenant\'s lair stand (no tier, no champion) stands under it (mutant: the Super dungeon\'s x4 left out)', () => {
  ladder();
  for (const [t, l] of [...MONSTERS.map((x) => [x, null]), [131, 20]]) {
    for (const wild of [false, true]) {
      const dun = (e) => applyProgressionScaling(e, worst(t, Math.max(...DUNGEON_SHARE), 1));
      const a = entityOf(t, l); scaleSuperFoe(a); applyChampion(a, 1); dun(a); if (wild) applyWildFoe(a, { ring: WILD_RINGS });
      const b = entityOf(t, l); dun(b); if (wild) applyWildFoe(b, { ring: WILD_RINGS }); revenantAt(b);
      const want = Math.max(a.level >= CHAMPION_MIN_LEVEL ? a.maxHealth : 0, b.maxHealth);
      const r = { t, ...(l != null ? { l } : {}) };
      if (a.level >= CHAMPION_MIN_LEVEL) assert.equal(foeHealthBound(r, { lane: 'dungeon', wild }), want, `${t} ${wild}`);
      else assert.ok(foeHealthBound(r, { lane: 'dungeon', wild }) >= want, `${t} ${wild} (no champion under its level: the bound is the more)`);
      assert.ok(foeHealthBound(r, { lane: 'any', wild }) >= Math.max(want, foeHealthBound(r, { wild })), 'the relay\'s `any`: the larger');
    }
  }
});

test('FOE-BOUNDS WHAT A RECORD SAYS OF ITSELF ONLY RAISES ITS BOUND, AND NO BUILDER GIVES SOME MARKS: a rat with no marks is held to its own chain, a camp\'s twice it (a star\'s coven); an elite, a champion, a revenant\'s name raise it; the City Watch never an elite or a champion; no champion under level 3 (mutants: a mark read when absent; the watch\'s marks believed; the champion\'s floor)', () => {
  const plain = foeHealthBound({ t: 0 }, { wild: false, camp: false });
  assert.equal(plain, Math.round(35 * FOE_HERO_HEALTH_MAX), 'a rat: its row and the hero (its own share is none)');
  // STAR-TUNE: a camp's monster may be a fallen star's coven (x2, rounded once more); unknown is a camp's, the worst
  assert.equal(foeHealthBound({ t: 0 }, { wild: false, camp: true }), Math.round(plain * STAR_FOE_HEALTH), 'a rat in a camp: a star\'s coven');
  assert.equal(foeHealthBound({ t: 0 }, { wild: false }), foeHealthBound({ t: 0 }, { wild: false, camp: true }), 'unknown: a camp\'s');
  for (const m of [{ z: 1 }, { cp: 1 }, { nm: 'Grak' }]) assert.ok(foeHealthBound({ t: 0, ...m }, { wild: false }) > plain, JSON.stringify(m));
  assert.ok(foeHealthBound({ t: 0 }, { wild: true }) > plain, 'the zone');
  assert.ok(foeStatsRefusal({ t: 0, k: 99_999 }, { wild: true }), 'the forged rat');
  assert.ok(foeStatsRefusal({ t: KNIGHT_CITY_WATCH, l: 20, z: 1, k: 10 }), 'an elite watchman');
  assert.ok(foeStatsRefusal({ t: KNIGHT_CITY_WATCH, l: 20, cp: 0, k: 10 }), 'a champion watchman');
  assert.ok(foeStatsRefusal({ t: 1, cp: 0, k: 10 }), 'a champion of level 2');
  assert.equal(foeStatsRefusal({ t: 2, cp: 0, k: 10 }), null, 'a champion of level 3');
  assert.ok(foeStatsRefusal({ t: 0, h: plain + 1 }, { wild: false, camp: false }), 'its health past the bound, too');
  assert.equal(foeStatsRefusal({ t: 39, k: 1e5 }), null, 'unverified: never refused');
});
