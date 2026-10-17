// BAL11 - THE HERO'S THREAT (2026-10-17; bible/05-Combat/Balance-Arc.md section 17; the Discord's field report: "the game
// gets too easy pretty early ... starting around character level 10/renown 15ish ... 4x-6x more damage and 2x-3x more hp
// ... every type of mobs elite etc"). Each Daggerfall level past 10 (to 30) a foe hits 7% harder and stands 4% tougher,
// each Renown past 15 (to 50) 1% and 0.5% - compounding, through the one writer, at the two seams BAL3's place runs
// through, over every kind's own scale. Never an ally, a stage, a town's ground; a puppet's blows alone; the ladder's gate.
//
// Pinned by execution: the law's table, the pure scaling, the writer (poise kept the kind's), the reader (the ladder,
// the mentor, the Renown, a puppet), the wilds' pool and the dungeon's seam, and both doors a foe's harm reaches me by.

import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as acorn from 'acorn';
import { setPref, _resetForTests } from '../../src/systems/uiPrefs.js';
import { HERO_THREAT, heroThreat, heroThreatOf } from '../../src/systems/heroThreat.js';
import { progressionScaling, placeVeteran, wildernessThreat, ENEMY_SCALING, combatStanding, foeShare } from '../../src/systems/skillSoftcap.js';
import { makeEnemyEntity, applyProgressionScaling } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { kindHealth } from '../../src/ai/tells.js';
import { setSigilOnline, setSigilRenown, _resetSigilForTests } from '../../src/systems/sigil/sigil.js';
import { createExteriorFoes } from '../../src/scenes/exteriorFoes.js';
import { lootRarityOn, dungeonRarityTier } from '../../src/systems/loot/lootRarity.js';
import { isArenaFloor, ARENA_FLOOR_LOCATION_ID } from '../../src/world/arena/arenaFloor.js';
import { isGateArena } from '../../src/world/gate/gateArena.js';
import { calculateAttackDamage } from '../../src/combat/formulas.js';
import { casterDamageScaled } from '../../src/systems/effects.js';

const rd = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
const ladder = (on) => { _resetForTests(); setPref('lootRarity', on); };
const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 5e-5, `${msg}: ${a} is not ${b}`);
const stats = (o = {}) => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, ...o });
const career = stats({ attackModifierFlags: 0 });
const monster = (id = 24) => makeEnemyEntity(id, ENEMY_BASICS[id], career, 12, () => 0.5);
const online = (renown) => { _resetSigilForTests(); if (renown != null) { setSigilOnline(true); setSigilRenown(renown); } };

// ── THE LAW ───────────────────────────────────────────────────────

test('BAL11 the law: nothing at or under level 10 and Renown 15; each level past 10 x1.07 blows and x1.04 health, each Renown past 15 x1.01 and x1.005, compounding; level 30 and Renown 50 the top; anything not a number pays nothing', () => {
  assert.deepEqual(HERO_THREAT, { level: { from: 10, to: 30, damage: 1.07, health: 1.04 }, renown: { from: 15, to: 50, damage: 1.01, health: 1.005 } });
  assert.ok(Object.isFrozen(HERO_THREAT) && Object.isFrozen(HERO_THREAT.level) && Object.isFrozen(HERO_THREAT.renown), 'the table is frozen');
  // the measured ladder's points (Balance-Arc.md section 17.4's table)
  const TABLE = [
    [1, null, 1, 1], [10, null, 1, 1], [10, 15, 1, 1], [9, 14, 1, 1],
    [11, null, 1.07, 1.04], [10, 16, 1.01, 1.005], [11, 16, 1.0807, 1.0452],
    [15, 22, 1.5037, 1.2599], [20, null, 1.9672, 1.4802], [20, 30, 2.2838, 1.5952],
    [25, 38, 3.4686, 2.0199], [30, 45, 5.2158, 2.5448], [30, 50, 5.4818, 2.6090],
    [31, 51, 5.4818, 2.6090], [60, 60, 5.4818, 2.6090],   // the top holds
  ];
  for (const [L, R, d, h] of TABLE) {
    const t = heroThreat(L, R);
    close(t.damage, d, `level ${L}, Renown ${R}: the blows`);
    close(t.health, h, `level ${L}, Renown ${R}: the health`);
  }
  assert.deepEqual([heroThreat(20, 30).level, heroThreat(20, 30).renown], [10, 15], 'the steps paid');
  assert.deepEqual([heroThreat(30, 50).level, heroThreat(30, 50).renown], [20, 35], 'the steps at the top');
  assert.deepEqual([heroThreat(12.9, 15.9).level, heroThreat(12.9, 15.9).renown], [2, 0], 'whole levels only');
  for (const bad of [NaN, undefined, null, Infinity, -Infinity, '20']) assert.deepEqual(heroThreat(/** @type {any} */ (bad), /** @type {any} */ (bad)), { damage: 1, health: 1, level: 0, renown: 0 }, `${String(bad)}: nothing`);
  // the report's own ask, reached at the top of the curve and not at its foot (4x-6x the blows, 2x-3x the health)
  const top = heroThreat(30, 50);
  assert.ok(top.damage >= 4 && top.damage <= 6 && top.health >= 2 && top.health <= 3, 'the top is the report\'s');
  // damage carries two thirds of the threat, as the report split it ("mobs dont need much more hp")
  close(Math.log(heroThreat(30, null).damage) / Math.log(heroThreat(30, null).damage * heroThreat(30, null).health), 0.6330, 'the blows\' share of a level');
});

test('BAL11 the scaling: the hero multiplies onto the place and the veteran, stands alone where neither does, is never under 1, and teaches nothing more (no skill, no challenge level)', () => {
  const hero = heroThreat(20, 30);
  const alone = progressionScaling(null, 0, 0, 0, hero);
  close(alone.healthMult, 1.5952, 'the hero alone: its health');
  close(alone.damageMult, 2.2838, 'the hero alone: its blows');
  assert.deepEqual([alone.skillGain, alone.challengeLevels], [0, 0], 'no skill, no challenge level');
  assert.deepEqual([alone.heroHealth, alone.heroDamage], [hero.health, hero.damage]);
  // over a Dragon's Den's whole row (x2 health, x1.25 blows), multiplied
  const den = progressionScaling(null, 0, 1, placeVeteran(18), hero);
  close(den.healthMult, 2 * hero.health, 'the Den x the hero');
  close(den.damageMult, 1.25 * hero.damage, 'the Den x the hero');
  assert.equal(den.skillGain, ENEMY_SCALING.veteran.skill, 'the place\'s skill, the hero adds none');
  // a rat's share stops the place, never the hero: every kind answers
  const rat = progressionScaling(null, 0, foeShare(1, false), placeVeteran(18), hero);
  close(rat.healthMult, hero.health, 'a rat: the hero alone');
  // nothing to pay: none, as before
  assert.equal(progressionScaling(null, 0, 1, 0, heroThreat(10, 15)), null, 'level 10, Renown 15: none');
  assert.equal(progressionScaling(null, 0, 1, 0, null), null);
  assert.equal(progressionScaling(null, 0, 1, 0, { damage: 0.5, health: 0.5 }), null, 'never under 1');
  const half = progressionScaling(null, 0, 1, placeVeteran(18), { damage: 0.5, health: 0.5 });
  assert.deepEqual([half.healthMult, half.damageMult, half.heroHealth, half.heroDamage], [2, 1.25, 1, 1], 'a threat under 1 is no threat');
});

test('BAL11 the one writer: a foe\'s health and blows at the threat, its kind\'s poise unmoved (kindHealth), the hero recorded beside the place', () => {
  const e = monster(24); const hp = e.maxHealth, kind = kindHealth(e);
  applyProgressionScaling(e, progressionScaling(null, 0, 1, placeVeteran(18), heroThreat(30, 50)));
  assert.equal(e.maxHealth, Math.max(1, Math.round(hp * 2 * heroThreat(30, 50).health)));
  assert.equal(e.health, e.maxHealth);
  close(e.damageScale, 1.25 * 5.4818, 'blows');
  close(e.healthMult, 2.6090, 'the hero\'s health stood on healthMult (the place\'s is not - BAL3 as it was)');
  assert.equal(Math.round(kindHealth(e)), kind * 2, 'the poise reads the kind\'s own health and the place\'s, never the hero\'s (to the maximum\'s rounding)');
  close(e.progression.hero.damage, 5.4818, 'recorded'); close(e.progression.hero.health, 2.6090, 'recorded');
  assert.equal(e.progression.place, 1);
  // an elite promoted first (x5, x3) compounds, as the place does
  const el = monster(24); const ehp = el.maxHealth; el.maxHealth *= 5; el.health = el.maxHealth; el.healthMult = 5; el.damageScale = 3;
  applyProgressionScaling(el, progressionScaling(null, 0, 1, 0, heroThreat(20, 30)));
  assert.equal(el.maxHealth, Math.round(ehp * 5 * heroThreat(20, 30).health));
  close(el.damageScale, 3 * 2.2838, 'an elite\'s x3 under the hero');
  assert.equal(Math.round(kindHealth(el)), ehp, 'an elite\'s poise is its kind\'s (to the maximum\'s rounding)');
});

// ── THE READER ────────────────────────────────────────────────────

test('BAL11 the reader: the level the world is built around and the page\'s Renown; offline the level alone; a mentor\'s group level and no Renown; a puppet\'s blows alone; nothing with the ladder off or nothing to pay', () => {
  try {
    ladder(true);
    online(null);
    assert.equal(heroThreatOf({ level: 10 }), null, 'level 10 offline: nothing');
    assert.equal(heroThreatOf(null), null);
    close(heroThreatOf({ level: 20 }).damage, 1.9672, 'offline: the level alone');
    online(30);
    close(heroThreatOf({ level: 20 }).damage, 2.2838, 'online: the level and the Renown');
    close(heroThreatOf({ level: 10 }).damage, 1.01 ** 15, 'online at level 10: the Renown alone');
    // mentoring: the group's level (mentorMode.js effectiveLevel), and the Firmament asleep - no Renown
    close(heroThreatOf({ level: 30, _mentor: { level: 15 } }).damage, 1.07 ** 5, 'a mentor: the group\'s level, no Renown');
    assert.equal(heroThreatOf({ level: 30, _mentor: { level: 8 } }), null, 'a mentor of a level-8 group: nothing');
    // a puppet: my threat's blows, its health its owner's word
    const p = heroThreatOf({ level: 20 }, { puppet: true });
    close(p.damage, 2.2838, 'a puppet\'s blows at me: mine'); assert.equal(p.health, 1, 'a puppet\'s health: its owner\'s');
    ladder(false);
    assert.equal(heroThreatOf({ level: 30 }), null, 'the ladder off: DFU\'s own foes');
    assert.equal(lootRarityOn(), false);
  } finally { ladder(true); online(null); }
});

// ── THE SEAMS, BY EXECUTION ───────────────────────────────────────

// the open world's pool on a crafted MONSTER.BSA (test/systems/bal_arc.test.js's rig): an Orc Warlord at midnight
function craftCfg() {
  const b = new Uint8Array(74); const v = new DataView(b.buffer);
  b[10] = 0x08; v.setUint16(52, 4, true);
  [40, 50, 50, 85, 50, 50, 90, 55].forEach((a, i) => v.setUint16(58 + i * 2, a, true));
  return b;
}
function craftMonsterBsa(records) {
  const NAME_FIELD = 14, ENTRY = 18;
  const out = new Uint8Array(4 + records.reduce((a, [, b]) => a + b.length, 0) + ENTRY * records.length); const v = new DataView(out.buffer);
  v.setInt16(0, records.length, true); v.setUint16(2, 0x0100, true);
  let pos = 4;
  for (const [, bytes] of records) { out.set(bytes, pos); pos += bytes.length; }
  for (const [name, bytes] of records) { for (let i = 0; i < name.length; i++) out[pos + i] = name.charCodeAt(i); v.setInt32(pos + NAME_FIELD, bytes.length, true); pos += ENTRY; }
  return out;
}
const BSA = craftMonsterBsa([['ENEMY024.CFG', craftCfg()]]);
const stubTex = { getSize: () => ({ width: 64, height: 100 }), getScale: () => ({ width: 0, height: 0 }), recordCount: 8, getFrameCount: () => 1 };
const wildsPool = (level, inLocation = () => false) => createExteriorFoes({
  renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch: () => {}, textures: new Map() },
  collider: { raycast: () => Infinity, heightAt: () => 0, raycastHit: () => ({ dist: Infinity, normal: null }), sphereOverlaps: () => false, capsuleCast: () => ({ dist: Infinity, key: null }), sphereCast: () => ({ dist: Infinity, key: null }), move: (f) => f },
  fetchBytes: async (n) => { if (n === 'MONSTER.BSA') return BSA; throw new Error(`no ${n} in this pin`); },
  getTexture: async () => stubTex, uploadRecordFrame: () => {},
  currentMinute: () => 0, currentPixelKey: () => '3,12',
  playerEntity: { level, reflexes: 2, health: 50, maxHealth: 50, skills: new Array(40).fill(20), skillUses: new Array(40).fill(0), items: [], activeEffects: [], stats: stats() },
  audio: null, onPlayerHurt: () => {}, rolls: () => 0.01, rand: () => 0.01,
  inLocation,
});
const withRandom = async (v, fn) => { const old = Math.random; Math.random = () => v; try { return await fn(); } finally { Math.random = old; } };

test('BAL11 the wilds by execution: my foe stands at the place and my threat; an elite under it; on a location\'s ground, an ally, the ladder off - DFU\'s own; a peer\'s puppet strikes me at my threat, its health its owner\'s', async () => {
  try {
    online(null);
    const spawn = async (level, opts = {}, { on = true, inLocation } = {}) => { ladder(on); return (await withRandom(0.5, () => wildsPool(level, inLocation).spawnFoe(24, [10, 0, 10], { feetGiven: true, eliteFoe: false, champion: null, ...opts }))).entity; };
    const p = placeVeteran(wildernessThreat(true));
    const at30 = await spawn(30);
    const h = heroThreat(30, null);
    const plain = await spawn(30, {}, { on: false });
    assert.equal(plain.progression, undefined, 'the ladder off: nothing');
    assert.equal(at30.maxHealth, Math.max(1, Math.round(plain.maxHealth * (1 + ENEMY_SCALING.veteran.health * p) * h.health)), 'the place x the hero');
    close(at30.damageScale, (1 + ENEMY_SCALING.veteran.damage * p) * h.damage, 'the blows: the place x the hero');
    close(at30.progression.hero.damage, h.damage, 'recorded');
    // online, the Renown too
    online(50);
    const r50 = await spawn(30);
    close(r50.damageScale, (1 + ENEMY_SCALING.veteran.damage * p) * 5.4818, 'level 30, Renown 50');
    online(null);
    // an elite (promoted first, x5 / x3) stands under the hero too
    const el = await spawn(30, { eliteFoe: true });
    assert.equal(el.eliteFoe, true);
    assert.equal(el.maxHealth, Math.max(1, Math.round(Math.max(1, Math.round(plain.maxHealth * 5)) * (1 + ENEMY_SCALING.veteran.health * p) * h.health)), 'the elite\'s x5, then the place and the hero');
    close(el.damageScale, 3 * (1 + ENEMY_SCALING.veteran.damage * p) * h.damage, 'the elite\'s x3, then the place and the hero');
    // never on a location's ground, never an ally
    const town = await spawn(30, {}, { inLocation: () => true });
    assert.equal(town.progression, undefined, 'a location\'s ground: nothing'); assert.equal(town.maxHealth, plain.maxHealth);
    const ally = await spawn(30, { allied: true });
    assert.equal(ally.progression, undefined, 'an ally: nothing'); assert.equal(ally.maxHealth, plain.maxHealth);
    // a peer's puppet: my threat's blows, its own (its owner's) health - and nothing of the place (BAL3 section 8)
    ladder(true);
    const pup = (await withRandom(0.5, () => wildsPool(30).spawnFoe(24, [10, 0, 10], { feetGiven: true, puppet: 'peer-1', seq: 7, level: 19, champion: null }))).entity;
    assert.equal(pup.maxHealth, plain.maxHealth, 'a puppet\'s maximum is untouched here (its owner\'s `k` lands on it)');
    close(pup.damageScale, h.damage, 'a puppet strikes me at my threat');
    const pup10 = (await withRandom(0.5, () => wildsPool(10).spawnFoe(24, [10, 0, 10], { feetGiven: true, puppet: 'peer-1', seq: 8, level: 19, champion: null }))).entity;
    assert.equal(pup10.progression, undefined, 'a puppet at level 10: nothing');
    const pupTown = (await withRandom(0.5, () => wildsPool(30, () => true).spawnFoe(24, [10, 0, 10], { feetGiven: true, puppet: 'peer-1', seq: 9, level: 19, champion: null }))).entity;
    assert.equal(pupTown.progression, undefined, 'a puppet on a location\'s ground: nothing, as my own foe there');
  } finally { ladder(true); online(null); }
});

// the dungeon context's own functions, mounted over a scope of their free names (bal_arc's AUDIT BAL harness)
function sliced(path) {
  const S = rd(path);
  const AST = acorn.parse(S, { ecmaVersion: 'latest', sourceType: 'module' });
  const find = (pred) => {
    let hit = null;
    (function walk(n) {
      if (!n || typeof n.type !== 'string' || hit) return;
      if (pred(n)) { hit = n; return; }
      for (const k of Object.keys(n)) { const v = n[k]; if (Array.isArray(v)) v.forEach(walk); else if (v && typeof v.type === 'string') walk(v); }
    })(AST);
    return hit;
  };
  return {
    fnSrc: (name) => { const n = find((x) => x.type === 'FunctionDeclaration' && x.id?.name === name); assert.ok(n, `${path} has function ${name}`); return S.slice(n.start, n.end); },
    declSrc: (name) => { const n = find((x) => x.type === 'VariableDeclaration' && x.declarations.some((d) => d.id?.name === name)); assert.ok(n, `${path} declares ${name}`); return S.slice(n.start, n.end); },
  };
}
const DC = sliced('src/scenes/dungeonContext.js');
const mount = (body, state) => new Function('__s', `with (__s) { ${body} }`)(new Proxy(state, {
  has: (t, k) => k !== '__s',
  get: (t, k) => (k === Symbol.unscopables ? undefined : (k in t ? t[k] : globalThis[k])),
  set: (t, k, v) => { t[k] = v; return true; },
}));

test('BAL11 the dungeon\'s seam by execution: my foe at the place and my threat, a puppet at my threat\'s blows alone, an ally at nothing of it; a made level (the court, the Hour, the Spire) and the arena\'s floor never; the ladder off nothing', () => {
  try {
    online(null);
    const seam = ({ level = 30, dungeonType = 6, made = null, location = {} } = {}) => {
      const st = {
        dfLocation: { mapTableData: { dungeonType }, ...location }, _sdRealm: made === 'hour', _made: made, isGateArena, isArenaFloor, placeVeteran, dungeonRarityTier,
        _dungeonShare: 0, lootRarityOn, progressionScaling, combatStanding, foeShare, heroThreatOf,
        foeDeps: { playerEntity: { level, skills: new Array(35).fill(20) }, applyProgressionScaling },
      };
      return mount(`${DC.declSrc('_placeVeteran')}\n${DC.declSrc('_heroStage')}\n${DC.fnSrc('applyProgressionScalingTo')}\nreturn { applyProgressionScalingTo, stage: _heroStage };`, st);
    };
    ladder(true);
    const h = heroThreat(30, null);
    // a natural cave (tier 4): no place, the hero alone
    const cave = seam();
    const e = monster(24); const hp = e.maxHealth;
    cave.applyProgressionScalingTo(e, ENEMY_BASICS[24]);
    assert.equal(e.maxHealth, Math.max(1, Math.round(hp * h.health)), 'my foe: my threat\'s health');
    close(e.damageScale, h.damage, 'my foe: my threat\'s blows');
    // a Dragon's Den: the place's whole row under it
    const den = seam({ dungeonType: 14 });
    const d = monster(24); const dhp = d.maxHealth;
    den.applyProgressionScalingTo(d, ENEMY_BASICS[24]);
    assert.equal(d.maxHealth, Math.max(1, Math.round(dhp * 2 * h.health)));
    // a puppet: my threat's blows, its health the place's alone (its owner's record's `k` lands after)
    const pup = monster(24); const php = pup.maxHealth;
    den.applyProgressionScalingTo(pup, ENEMY_BASICS[24], { puppet: true });
    assert.equal(pup.maxHealth, Math.round(php * 2), 'a puppet: the place\'s health, never mine');
    close(pup.damageScale, 1.25 * h.damage, 'a puppet strikes me at my threat');
    // an ally: nothing of the hero (a cave: nothing at all)
    const al = monster(24); const ahp = al.maxHealth;
    cave.applyProgressionScalingTo(al, ENEMY_BASICS[24], { ally: true });
    assert.deepEqual([al.maxHealth, al.damageScale, al.progression], [ahp, undefined, undefined], 'an ally: nothing');
    // the tuned stages: a made level, the arena's floor
    for (const made of ['court', 'hour', 'spire']) {
      const s = seam({ made });
      assert.equal(s.stage, true, made);
      const m = monster(24); const mhp = m.maxHealth;
      s.applyProgressionScalingTo(m, ENEMY_BASICS[24]);
      assert.equal(m.maxHealth, mhp, `${made}: nothing`);
    }
    const floor = seam({ location: { arenaFloor: 'bout', dungeon: { recordElement: { header: { locationId: ARENA_FLOOR_LOCATION_ID } } } } });
    assert.equal(floor.stage, true, 'the arena\'s floor');
    assert.equal(cave.stage, false, 'a real dungeon is no stage');
    // the ladder off: nothing
    ladder(false);
    const off = monster(24); const ohp = off.maxHealth;
    cave.applyProgressionScalingTo(off, ENEMY_BASICS[24]);
    assert.equal(off.maxHealth, ohp, 'the ladder off: DFU\'s own');
    // level 10: nothing
    ladder(true);
    const low = monster(24); const lhp = low.maxHealth;
    seam({ level: 10 }).applyProgressionScalingTo(low, ENEMY_BASICS[24]);
    assert.deepEqual([low.maxHealth, low.progression], [lhp, undefined], 'level 10 in a cave: nothing');
  } finally { ladder(true); online(null); }
});

test('BAL11 the seams by source: both build arms of the dungeon say an ally, the wilds\' own arm hands the hero beside the place and its puppet arm the blows alone; the four hosts', () => {
  const dc = rd('src/scenes/dungeonContext.js');
  assert.equal((dc.match(/if \(!puppet && e\.level == null\) applyProgressionScalingTo\(entity, basics, \{ ally: !!e\.allied \}\);/g) ?? []).length, 2, 'a class foe\'s arm and a monster\'s');
  assert.equal((dc.match(/else if \(puppet && e\.level == null\) applyProgressionScalingTo\(entity, basics, \{ puppet: true, ally: !!e\.allied \}\);/g) ?? []).length, 2);
  assert.match(dc, /const _heroStage = _made != null \|\| isArenaFloor\(dfLocation\);/);
  const xf = rd('src/scenes/exteriorFoes.js');
  assert.match(xf, /\} else if \(puppet && !allied && !inLocation\(\)\) \{\n[^\n]*\n\s*applyProgressionScaling\(entity, progressionScaling\(null, 0, 0, 0, heroThreatOf\(playerEntity, \{ puppet: true \}\)\)\);/);
  // THE FOUR HOSTS: world.js's wilds and every dungeon (worldModes.js's dungeon mode, the standalone dungeon) through the
  // two seams; worldModes.js's interiors and exterior.js's fixed city hand their pools no `inLocation` - a town's ground
  assert.match(rd('src/scenes/world.js'), /inLocation: \(\) => _musicInLocationRect\(\),/);
  for (const host of ['src/scenes/exterior.js', 'src/scenes/worldModes.js']) {
    for (const p of rd(host).split('createExteriorFoes({').slice(1).map((s) => s.slice(0, s.indexOf('});')))) assert.doesNotMatch(p, /inLocation:/, `${host}: a town's ground`);
  }
  // the watch is no seam of it (scenes/cityGuards.js builds the watch with no progression at all)
  assert.doesNotMatch(rd('src/scenes/cityGuards.js'), /heroThreat|progressionScaling/);
});

// ── THE DOORS ─────────────────────────────────────────────────────

test('BAL11 both doors a foe\'s harm reaches me by: its blow at the formula\'s tail and its spell at the spell door land at its damageScale - the hero\'s threat with every other scale', () => {
  const foe = monster(24);
  applyProgressionScaling(foe, progressionScaling(null, 0, 0, 0, heroThreat(20, null)));
  const me = { isPlayer: true, level: 20, stats: stats(), skills: new Array(35).fill(40), career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 }, health: 1e6, maxHealth: 1e6, items: [], armorValues: new Array(7).fill(100), reflexes: 2, biographyAvoidHitMod: 0 };
  // the spell door: a 10-point bolt
  assert.equal(casterDamageScaled(10, foe, me), Math.max(1, Math.round(10 * heroThreat(20, null).damage)), 'a spell: 10 -> 20');
  // the blow: the same rolls through a plain twin and the scaled foe
  const twin = monster(24);
  const seq = (s) => { let a = s; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; };
  let landed = 0;
  for (let s = 1; s <= 300; s++) {
    const plain = calculateAttackDamage(twin, me, { rolls: seq(s), dfRand: (() => { const r = seq(s + 9999); return () => Math.floor(r() * 32768); })() });
    const hit = calculateAttackDamage(foe, me, { rolls: seq(s), dfRand: (() => { const r = seq(s + 9999); return () => Math.floor(r() * 32768); })() });
    if (plain > 0) { landed++; assert.equal(hit, Math.max(1, Math.round(plain * foe.damageScale)), `seed ${s}`); } else assert.equal(hit, 0, `seed ${s}: a miss is a miss`);
  }
  assert.ok(landed > 30, `enough blows landed (${landed})`);
});
