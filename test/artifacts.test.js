// V3 - THE DAEDRIC ARTIFACT PAYLOADS, pinned against the nine
// Effects/Special/* classes. The registry row (type 26) sub-routes by
// the enchantment param - the artifact subtype - so every pin drives
// the REAL dispatcher (doItemEnchantmentPayloads) or the real hook
// site, never the handler tables alone.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  ARTIFACTS, WABBAJACK_CAREER_IDS, OGHMA_BONUS_POOL,
  SOUL_RELEASED_TEXT_ID, NO_SOUL_TO_RELEASE_TEXT_ID,
  SUMMON_ENEMY_RANGE, SUMMON_DURABILITY_LOSS, MACE_MAX_INCREASE_ROUNDS,
  NO_MONSTERS_NEARBY_TEXT, SPECIAL_ARTIFACT_HANDLERS,
  isAzurasStarEquipped, isWearingArtifact, maceState, onPlayerStruckByEnemy,
} from '../src/systems/artifactEffects.js';
import { doItemEnchantmentPayloads, PAYLOAD, ENCHANTMENT_TYPES } from '../src/systems/enchantments.js';
import { ENCHANTMENT_TYPES as FORMATS_TYPES } from '../src/formats/magicDef.js';
import { MOBILE_TYPES } from '../src/characters/mobileTypes.js';
import { applyLevelUp } from '../src/systems/advancement.js';
import { liveStat } from '../src/systems/statMods.js';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const T = ENCHANTMENT_TYPES;
const P = () => ({
  isPlayer: true, level: 5, activeEffects: [], items: [],
  stats: { strength: 50, agility: 50, endurance: 50, speed: 50, willpower: 50, intelligence: 50, personality: 50, luck: 50 },
  skills: {}, health: 60, maxHealth: 60, magicka: 20, maxMagicka: 30, fatigue: 100,
});
const artifactItem = (subtype, extra = {}) => ({
  name: 'Artifact', currentCondition: 800, maxCondition: 800,
  enchantments: [{ type: T.SpecialArtifactEffect, param: subtype }], ...extra,
});

test('V3: the enum re-homed to formats and the registry row ends the unknown-key abort for type 26', () => {
  assert.equal(FORMATS_TYPES, ENCHANTMENT_TYPES, 'one object, re-exported - never two enums');
  assert.equal(T.SpecialArtifactEffect, 26);
  // the abort used to stop the row walk at the Special row; now a
  // known-type row AFTER it still runs (PotentVs +5 vs the matching
  // affinity proves the walk continued)
  const item = {
    currentCondition: 100, maxCondition: 100,
    enchantments: [
      { type: T.SpecialArtifactEffect, param: ARTIFACTS.HircineRing },   // no hooks: idles, never aborts
      { type: T.PotentVs, param: 0 },   // undead affinity
    ],
  };
  const out = doItemEnchantmentPayloads(PAYLOAD.Strikes, item, { entity: P(), target: { mobileType: MOBILE_TYPES.SkeletalWarrior }, damage: 10 });
  assert.equal(out, 15, 'the walk reached PotentVs past the Special row');
});

test('V3: Azura\'s Star - Used releases the soul (TEXT 32) or reports none (TEXT 20); the equipped read', () => {
  const boxes = [];
  const ctx = { messageBox: (id) => boxes.push(id) };
  const star = artifactItem(ARTIFACTS.AzurasStar, { trappedSoulType: MOBILE_TYPES.Lich, azurasStar: true });
  const p = P();
  doItemEnchantmentPayloads(PAYLOAD.Used, star, { entity: p, ctx });
  assert.equal(star.trappedSoulType, null, 'the soul is released');
  assert.deepEqual(boxes, [SOUL_RELEASED_TEXT_ID]);
  doItemEnchantmentPayloads(PAYLOAD.Used, star, { entity: p, ctx });
  assert.deepEqual(boxes, [SOUL_RELEASED_TEXT_ID, NO_SOUL_TO_RELEASE_TEXT_ID], 'an empty Star says so');
  // the death sites' equipped read (DaggerfallEntityBehaviour.cs:240)
  p.equip = { slots: { Amulet0: star } };
  assert.equal(isAzurasStarEquipped(p), true);
  assert.equal(isWearingArtifact(p, ARTIFACTS.RingOfNamira), false, 'subtype-keyed, not any-artifact');
  const ef = read('src/scenes/exteriorFoes.js');
  const dc = read('src/scenes/dungeonContext.js');
  for (const src of [ef, dc]) {
    assert.ok(src.includes('isAzurasStarEquipped(playerEntity)'), 'both death sites read it');
    assert.ok(src.includes('azurasStarOnly: true'), 'and fill the Star alone, always-successful-while-empty');
  }
});

test('V3: the Masque adds LivePersonality/5 to EVERY social group\'s reaction mod, per round', () => {
  const p = P();
  p.stats.personality = 63;   // trunc(63/5) = 12
  const masque = artifactItem(ARTIFACTS.MasqueOfClavicus);
  doItemEnchantmentPayloads(PAYLOAD.MagicRound, masque, { entity: p, round: 1 });
  assert.deepEqual([...p.reactionMods], [12, 12, 12, 12, 12]);
});

test('V3: Mehrunes\' Razor - a failed save adds the target\'s WHOLE health and bills the same condition', () => {
  const razor = artifactItem(ARTIFACTS.MehrunesRazor);
  const target = { health: 45, maxHealth: 45, stats: { willpower: 0, luck: 0 }, level: 1, skills: {} };
  const handler = SPECIAL_ARTIFACT_HANDLERS.get(ARTIFACTS.MehrunesRazor);
  // rolls 0.99 -> Dice100 rolls 100 > saving 50: the save FAILS and
  // the effect fires (SavingThrow != 0)
  const r = handler.strikes({ target, item: razor, rolls: () => 0.99 });
  assert.deepEqual(r, { strikesModulateDamage: 45, durabilityLoss: 45 });
  // a MADE save (roll 1 <= 30 under saving) fires nothing
  assert.equal(handler.strikes({ target, item: razor, rolls: () => 0 }), null);
});

test('V3: the Mace of Molag Bal - magicka drain with overflow raising max, the dry-target strength arm, the 12-minute decay', () => {
  const mace = SPECIAL_ARTIFACT_HANDLERS.get(ARTIFACTS.MaceOfMolagBal);
  const wielder = P();   // magicka 20 / max 30
  // AUDIT 39: the target carries a real STRENGTH now. DrainTargetStrength
  // goes through DrainEffect.IncreaseMagnitude, whose clamp is relative
  // to the PERMANENT value, so a fixture with no strength at all pinned
  // the clamp's degenerate corner instead of the law.
  const target = { health: 30, magicka: 10, stats: { strength: 30, willpower: 0, luck: 0 }, level: 1, skills: {}, activeEffects: [] };
  // drain: damage 6 but target holds 10 -> 6 drained; 20+6 <= 30, no overflow
  let r = mace.strikes({ entity: wielder, target, damage: 6, nowMinutes: 100, rolls: () => 0.99 });
  assert.equal(target.magicka, 4);
  assert.equal(wielder.magicka, 26);
  assert.equal(maceState(wielder).maxMagickaIncrease, 0, 'no overflow below max');
  assert.deepEqual(r, { durabilityLoss: 6 });
  // overflow: another 6 -> 26+4(all target holds)=30... drain caps at
  // the target's pool; drain 4, no overflow; then a big hit overflows
  target.magicka = 50;
  r = mace.strikes({ entity: wielder, target, damage: 20, nowMinutes: 101, rolls: () => 0.99 });
  assert.equal(wielder.magicka, 46, 'the wielder takes the whole drain');
  assert.equal(maceState(wielder).maxMagickaIncrease, 16, '26 + 20 - 30: the overflow raises max');
  // the constant fold sums the increase into mods.maxMagicka
  const mods = { maxMagicka: 75 };
  mace.constant({ entity: wielder, mods });
  assert.equal(mods.maxMagicka, 91, 'a producer beside ExtraSpellPts, through the one fold');
  // dry target: 1d6 strength, wielder gains, target loses
  target.magicka = 0;
  const seq = [0.99, 0.5];   // fail the save, then 1 + floor(0.5*6) = 4
  mace.strikes({ entity: wielder, target, damage: 5, nowMinutes: 102, rolls: () => seq.shift() ?? 0.5 });
  assert.equal(maceState(wielder).statMods.strength, 4);
  assert.equal(liveStat(wielder, 'strength'), 54, 'the artifact arm reaches liveStat');
  assert.equal(liveStat(target, 'strength'), 26, 'the target takes a real DrainStrength incumbent (30 - 4)');
  // decay: 12 game minutes after the last strike, both reset
  mace.magicRound({ entity: wielder, nowMinutes: 102 + MACE_MAX_INCREASE_ROUNDS });
  assert.equal(maceState(wielder).maxMagickaIncrease, 16, 'at the boundary nothing moves (strictly greater)');
  mace.magicRound({ entity: wielder, nowMinutes: 103 + MACE_MAX_INCREASE_ROUNDS });
  assert.equal(maceState(wielder).maxMagickaIncrease, 0);
  assert.deepEqual(maceState(wielder).statMods, {});
});

test('V3: the Oghma Infinium - flags set, the sheet opens, the book is consumed, and the level-up is 30 points with NO level', () => {
  const p = P();
  const book = artifactItem(ARTIFACTS.OghmaInfinium);
  p.items = [book];
  let sheetOpened = 0;
  doItemEnchantmentPayloads(PAYLOAD.Used, book, { entity: p, ctx: { openCharacterSheet: () => sheetOpened++ }, collection: p.items });
  assert.equal(p.readyToLevelUp, true);
  assert.equal(p.oghmaLevelUp, true);
  assert.equal(sheetOpened, 1);
  assert.deepEqual(p.items, [], 'removeItem consumed the book');
  // the sheet's arm (DaggerfallCharacterSheetWindow.cs:374-383)
  let given = 0;
  const level = p.level, maxHealth = p.maxHealth;
  assert.equal(applyLevelUp(p, (_stats, pool) => { given = pool; }), true);
  assert.equal(given, OGHMA_BONUS_POOL, 'a fixed 30-point pool');
  assert.equal(p.level, level, 'NO Level++');
  assert.equal(p.maxHealth, maxHealth, 'no health raise');
  assert.equal(p.oghmaLevelUp, false, 'both flags clear together');
  assert.equal(p.readyToLevelUp, false);
});

test('V3/MT-ii: the two summons - the range gate, the fail line, the PlayerAlly filters, and the MOUNTED allied door', () => {
  const said = [];
  const spawned = [];
  const rose = artifactItem(ARTIFACTS.SanguineRose);
  // no monsters: the fail line, no durability
  doItemEnchantmentPayloads(PAYLOAD.Used, rose, { entity: P(), ctx: { nearbyFoes: () => [], say: (t) => said.push(t) } });
  assert.deepEqual(said, [NO_MONSTERS_NEARBY_TEXT]);
  assert.equal(rose.currentCondition, 800);
  // monsters near + a mounted door: an allied Daedroth, 100 condition
  doItemEnchantmentPayloads(PAYLOAD.Used, rose, {
    entity: P(),
    ctx: { nearbyFoes: (r) => (r === SUMMON_ENEMY_RANGE ? [{ mobileType: 0, distance: 5 }] : []), spawnAlliedFoe: (t) => spawned.push(t) },
  });
  assert.deepEqual(spawned, [MOBILE_TYPES.Daedroth]);
  assert.equal(rose.currentCondition, 800 - SUMMON_DURABILITY_LOSS);
  // the Skull clones the NEAREST
  const skull = artifactItem(ARTIFACTS.SkullOfCorruption);
  doItemEnchantmentPayloads(PAYLOAD.Used, skull, {
    entity: P(),
    ctx: {
      nearbyFoes: () => [{ mobileType: MOBILE_TYPES.Rat, distance: 9 }, { mobileType: MOBILE_TYPES.Lich, distance: 3 }],
      spawnAlliedFoe: (t) => spawned.push(t),
    },
  });
  assert.equal(spawned.at(-1), MOBILE_TYPES.Lich);
  // MT-ii: THE DOOR IS MOUNTED, and RETIRING A FLAG DELETES THE
  // SENTENCE - the module header's "no host mounts it" is gone with it.
  // SD1 re-anchored this from the literal spawn line onto the LAW it
  // holds. The old assertion quoted `exteriorFoes.spawnFoe(mobileType,
  // [pf[0] + 2, ...], { allied: true })` - a fixed offset from the
  // player's feet - and SD1 replaced that call with DFU's placement
  // ring, so the pin went red for a change that strengthened exactly
  // what it was defending. F041's precedent: anchor on the gate.
  // WAVE D moved the gate itself: the ctx BODY is scenes/hostEnchant.js
  // now and both mounting hosts hand it their own pool door, so the
  // arm is pinned where it lives and each host is pinned to reach it.
  const he = read('src/scenes/hostEnchant.js');
  assert.ok(he.includes("spawnAlliedFoe: (mobileType) => { standFoe?.(mobileType, { allied: true }); },"),
    'the shared ctx mounts the allied spawn');
  const w = read('src/scenes/world.js');
  assert.ok(/standLooseFoe: _standLooseFoe,/.test(w), 'world.js hands in its own stander');
  const stander = w.slice(w.indexOf('const _standLooseFoe ='), w.indexOf('const _standLooseFoe =') + 2400);
  assert.ok(/\? d\.spawnLooseFoe\(mt, pos, \{ yawRad: o\.yawRad, allied: o\.allied \}\)/.test(stander)
    && /: exteriorFoes\.spawnFoe\(mt, pos, \{ yaw: o\.yawRad, allied: o\.allied \}\)/.test(stander),
    'through a live pool either way, carrying allied to it');
  // ROAD-G G1: and a THIRD live pool - a Sanguine Rose broken in a shop
  // stands its Daedroth through the interior host's own chain.
  assert.ok(/if \(mode === 'interior'\) return modes\?\.insideStandLooseFoe\?\.\(mobileType, opts\) \?\? null;/.test(stander),
    'the interior arm goes to the pool that owns that building');
  const dc0 = read('src/scenes/dungeonContext.js');
  assert.ok(/standLooseFoe: \(mobileType, o = \{\}\) => standLooseFoe\(\{/.test(dc0),
    'and the dungeon host hands in its own');
  for (const [f, line] of [
    ['src/scenes/exteriorFoes.js', "if (allied) { entity.team = 'PlayerAlly'; entity.mobileTeam = 'PlayerAlly'; }"],
    ['src/scenes/dungeonContext.js', "if (allied && f.entity) { f.entity.team = 'PlayerAlly'; f.entity.mobileTeam = 'PlayerAlly'; }"],
  ]) {
    assert.ok(read(f).includes(line),
      `${f}: BOTH per-instance team fields turn (SetupDemoEnemy.cs:85-86), never the shared static row`);
  }
  assert.ok(!read('src/systems/artifactEffects.js').includes('the port has no ally/team combat'),
    'the flag sentence is deleted, not merely contradicted');

  // AND THE FILTERS both summons apply BEFORE counting company
  // (:47-48): a player standing alone among their OWN summons gets
  // the fail line, because an ally is not an enemy.
  const said2 = [];
  const spawned2 = [];
  doItemEnchantmentPayloads(PAYLOAD.Used, artifactItem(ARTIFACTS.SanguineRose), {
    entity: P(),
    ctx: {
      nearbyFoes: () => [{ mobileType: MOBILE_TYPES.Daedroth, distance: 4, team: 'PlayerAlly' }],
      say: (t) => said2.push(t), spawnAlliedFoe: (t) => spawned2.push(t),
    },
  });
  assert.deepEqual(said2, [NO_MONSTERS_NEARBY_TEXT], 'the Rose counts no ally as company');
  assert.deepEqual(spawned2, [], 'and summons nothing');
  // the Skull's SECOND gate (:67-71) - dead code past its own filter,
  // ported because a port that keeps one and drops the other guesses
  const said3 = [];
  doItemEnchantmentPayloads(PAYLOAD.Used, artifactItem(ARTIFACTS.SkullOfCorruption), {
    entity: P(),
    ctx: {
      nearbyFoes: () => [{ mobileType: MOBILE_TYPES.Rat, distance: 3, team: 'PlayerAlly' }],
      say: (t) => said3.push(t), spawnAlliedFoe: (t) => spawned2.push(t),
    },
  });
  assert.deepEqual(said3, [NO_MONSTERS_NEARBY_TEXT], 'the Skull refuses to clone an ally');
  assert.ok(read('src/systems/artifactEffects.js').includes(":67-71, unreachable past the filter"),
    'and the redundancy is recorded as the source\'s, not tidied away');
});

test('V3: the Wabbajack rerolls from the seventeen-entry table, never the same type, once per creature', () => {
  assert.equal(WABBAJACK_CAREER_IDS.length, 17, 'the effect\'s own careerIDs list');
  assert.equal(new Set(WABBAJACK_CAREER_IDS).size, 17, 'no duplicates');
  const wand = artifactItem(ARTIFACTS.Wabbajack);
  const replaced = [];
  const ctx = { replaceFoe: (t, m) => replaced.push([t, m]) };
  const target = { mobileType: MOBILE_TYPES.Rat };   // index 0 of the table
  // a roll sequence that lands on Rat FIRST forces the do/while reroll
  const seq = [0, 0.999];
  const env = { target, ctx, rolls: () => seq.shift() ?? 0.5 };
  SPECIAL_ARTIFACT_HANDLERS.get(ARTIFACTS.Wabbajack).strikes(env);
  assert.equal(replaced.length, 1);
  assert.notEqual(replaced[0][1], MOBILE_TYPES.Rat, 'never its own type - DFU\'s do/while');
  assert.equal(replaced[0][1], WABBAJACK_CAREER_IDS.at(-1));
  // the latch: an already-wabbajacked creature is left alone
  SPECIAL_ARTIFACT_HANDLERS.get(ARTIFACTS.Wabbajack).strikes({ target: { mobileType: 5, wabbajackActive: true }, ctx });
  assert.equal(replaced.length, 1);
  // the world door carries the transform laws
  const w = read('src/scenes/world.js');
  assert.ok(w.includes('replaceFoe: (targetEntity, mobileType)'), 'the world host mounts the door');
  assert.ok(w.includes('nf.entity.wabbajackActive = true'), 'the latch survives the swap');
  assert.ok(w.includes('nf.entity.health -= missing'), 'damage carries over (WabbajackEffect:94)');
  assert.ok(w.includes('if (f.questBehaviour && !f.questBehaviour.isFoeDead) return;'), 'a live quest foe is left alone');
});

test('V3: the Ring of Namira reflects by the attacker\'s TEAM at the attack tail - animals nothing, Daedra half, Undead double', () => {
  const mkPlayer = () => {
    const p = P();
    const ring = artifactItem(ARTIFACTS.RingOfNamira);
    p.equip = { slots: { Ring0: ring } };
    return [p, ring];
  };
  // Vermin (Rat): no reflection at all
  let [p, ring] = mkPlayer();
  const rat = { mobileType: MOBILE_TYPES.Rat, health: 20 };
  onPlayerStruckByEnemy(rat, p, 10);
  assert.equal(rat.health, 20);
  assert.equal(ring.currentCondition, 800);
  // Undead: double
  const skel = { mobileType: MOBILE_TYPES.SkeletalWarrior, health: 40 };
  onPlayerStruckByEnemy(skel, p, 10);
  assert.equal(skel.health, 20, '10 x 2 reflected');
  // AUDIT 58: THE RING PAYS NOTHING. RingOfNamiraEffect.cs:62-65
  // returns durabilityLoss, but FormulaHelper.cs:707 passes
  // `sourceItem: item` with item still null and :712-716 discards the
  // PayloadCallbackResults - only EntityEffectManager's dispatchers
  // (:1041-1042, :1095-1096, :1107-1108) ever read durabilityLoss,
  // which is why the Mace/Razor/Rose wear down and Namira does not.
  // MUTANT KILLED: restoring `lowerCondition(ring, reflected, target)`
  // takes this to 780 and 760.
  assert.equal(ring.currentCondition, 800, 'the ring takes NO durability loss');
  // Daedra: half, trunc
  const daedra = { mobileType: MOBILE_TYPES.FrostDaedra, health: 40 };
  onPlayerStruckByEnemy(daedra, p, 9);
  assert.equal(daedra.health, 36, 'trunc(9/2) = 4');
  // everyone else: full
  const orc = { mobileType: MOBILE_TYPES.Orc, health: 40 };
  onPlayerStruckByEnemy(orc, p, 10);
  assert.equal(orc.health, 30);
  assert.equal(ring.currentCondition, 800, 'still pristine after four reflected blows');
  assert.ok(!read('src/systems/artifactEffects.js').includes('lowerCondition(ring'),
    'the bill is gone, not commented out');
  // no ring, nothing
  const bare = P();
  const orc2 = { mobileType: MOBILE_TYPES.Orc, health: 40 };
  onPlayerStruckByEnemy(orc2, bare, 10);
  assert.equal(orc2.health, 40);
  // and it is dispatched where DFU dispatches it - the formulas tail,
  // through worldTick's registration
  const f = read('src/combat/formulas.js');
  assert.ok(f.includes("if (target?.isPlayer && !attacker.isPlayer && damage > 0) {"), 'the enemy-damages-player tail');
  assert.ok(f.includes('_playerStruckHook?.(attacker, target, damage);'));
  assert.ok(read('src/systems/worldTick.js').includes('setPlayerStruckHook((attacker, target, damage) => onPlayerStruckByEnemy(attacker, target, damage));'));
});
