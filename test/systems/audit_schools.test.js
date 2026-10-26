// AUDIT SCHOOLS (2026-10-13; bible/01-Overview/audits/Audit-Schools.md). The owner: "Lets do a comprehensive audit on
// everything" - five lanes read SCHOOLS (bible/06-Systems/Arcane-Specialisations.md) at 2c40b7f5: the law and the powers,
// the spell engine's edits, online integrity, the player's surface and its words, and the pins and the record. Every
// finding the audit fixed is pinned here BY EXECUTION through the producers that mint the shapes in play - the real cast
// engine (scenes/hostMagic.js createPlayerMagic: its release, its missiles, its doors), real foes (characters/
// enemyEntity.js makeEnemyEntity over enemyBasics.js), the save (systems/save/save.js), the round (systems/worldTick.js
// runMagicRoundsFor), the one ask (scenes/shared.js raisePlayerSkills), the classic sheet (ui/charsheet.js CharSheet)
// and the enhanced pause window (ui/enhanced/enhancedMenu.js) - each number on both sides of its line, and each window just
// before its end and just after.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as AP from '../../src/systems/arcanePaths.js';
import * as POW from '../../src/systems/arcanePowers.js';
import { signatureSpell, signatureOffers } from '../../src/systems/signatureSpells.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { masterSkill } from '../../src/systems/masterSkills.js';
import { SKILLS, MAGIC_SKILLS } from '../../src/systems/skills.js';
import { playerEntity, hurtPlayer, registerPlayerDamageMod, registerPlayerDeathSave } from '../../src/characters/playerEntity.js';
import { makeEnemyEntity } from '../../src/characters/enemy/enemyEntity.js';
import { ENEMY_BASICS } from '../../src/characters/enemy/enemyBasics.js';
import { KNIGHT_CITY_WATCH } from '../../src/characters/mobile/mobileTypes.js';
import { applySpell } from '../../src/systems/effects.js';
import { calculateCastCost, castSchool } from '../../src/systems/spellcost.js';
import { spellPowerMult, spellPierce, tellSpellLanded, registerSpellLandedListener } from '../../src/systems/spell/spellPower.js';
import { EFFECT_FLAGS } from '../../src/systems/spellcast.js';
import { reportPlayerKill } from '../../src/systems/playerKills.js';
import { setStruck, _resetSetPowersForTests } from '../../src/systems/sigil/sigilSetPowers.js';
import { setSigilDueling } from '../../src/systems/sigil/sigil.js';
import { setPlayerDoor, playerDoor } from '../../src/systems/playerDoor.js';
import { _resetPlayerHealForTests } from '../../src/systems/playerHeal.js';
import { snapshotPlayer, restorePlayer } from '../../src/systems/save/save.js';
import { seedCustomSpellIndex, mintCustomSpellIndex, _resetCustomIndexForTests, READY_MADE_INDEX_CEILING, isReadyMadeSpellIndex } from '../../src/systems/spell/spellMaker.js';
import { RESURRECTION_SPELL_INDEX } from '../../src/systems/resurrect.js';
import { SHARED_CARTOGRAPHY_SPELL_INDEX } from '../../src/systems/party/partyMap.js';
import { shownSpellName } from '../../src/systems/loot/loot.js';
import * as tm from '../../src/systems/textManager.js';
import { runMagicRoundsFor } from '../../src/systems/worldTick.js';
import { refreshMentor } from '../../src/systems/mentorMode.js';
import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { duelStandIn } from '../../src/combat/duelCombat.js';
import { raisePlayerSkills } from '../../src/scenes/shared.js';
import { CharSheet } from '../../src/ui/charsheet.js';

const { Destruction: DES, Restoration: RES, Illusion: ILL, Alteration: ALT, Thaumaturgy: THA, Mysticism: MYS } = SKILLS;
const src = (p) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8');
/** The page's own switch (onlineLane.js isOnlinePage), for the doors that read it themselves. */
function page(online, fn) {
  const had = Object.hasOwn(globalThis, 'location') ? globalThis.location : undefined;
  globalThis.location = { search: online ? '?online' : '' };
  try { return fn(); } finally { if (had === undefined) delete globalThis.location; else globalThis.location = had; }
}
const STATS = { strength: 50, intelligence: 80, willpower: 60, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const career = buildCustomCareer({ name: 'Mage', hp: 8, stats: STATS,
  skills: [DES, RES, ALT, MYS, ILL, THA, SKILLS.ShortBlade, SKILLS.Archery, SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking] });
/** A chargen'd mage, online (Master Skills in force), level 20, with `schools` mastered and standing at `raw`. */
function mage(schools = [], raw = 150) {
  const p = structuredClone(playerEntity);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p._online = true; p.level = 20; p.activeEffects = [];
  p.health = p.maxHealth = 200; p.magicka = 0; p.maxMagicka = 300;
  for (const s of schools) { p.skills[s] = 100; assert.equal(masterSkill(p, s).ok, true, `master ${s}`); p.skills[s] = raw; }
  return p;
}
function pathMage(id, raw = 150) {
  const p = mage(AP.PATH_BY_ID[id].schools, raw);
  assert.equal(AP.choosePath(p, id).ok, true);
  return p;
}
const reset = () => {
  POW._resetArcanePowersForTests(); _resetSetPowersForTests(); _resetPlayerHealForTests();
  POW._setArcanePowersClockForTests(null); POW._setArcanePowersRandForTests(null);
  setSigilDueling(false); setPlayerDoor(null);
};
/** Every test hook set back, however the test ends. */
const clean = (fn) => { reset(); try { return fn(); } finally { reset(); } };
/** A REAL FOE as the dungeon mints it (makeEnemyEntity over its basics row) - a class foe's careerIndex is its class's
 *  (mobileType - 128), its affinity Human. Willpower 0: a roll of 0.999 always fails its save. */
const FOE_CAREER = { hitPointsPerLevel: 8, strength: 50, intelligence: 50, willpower: 0, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
function realFoe(mt, over = {}) {
  const e = makeEnemyEntity(mt, ENEMY_BASICS[mt], FOE_CAREER, 21, () => 0.5);
  return Object.assign(e, { activeEffects: [] }, over);
}
const MT = { rat: 0, skeleton: 15, daedra: 25, barbarian: 143, knight: 145, watch: KNIGHT_CITY_WATCH };
/** A door record as the hosts keep their foes: `{ name, entity, ai: { feet, isHostile } }`. */
const rec = (name, entity, feet, ai = {}) => ({ name, entity, ai: { feet, isHostile: true, ...ai } });
/** A door: the foe records, the hurts it takes, the bundles cast on me; `clear(a, b)` the host's wall test. */
function door(foes = [], me = null, { clear = null } = {}) {
  const d = { hurts: [], cast: [] };
  setPlayerDoor({ foes: () => foes.filter((f) => !f.dead), feet: () => [0, 0, 0], hurtFoe: (f, n) => d.hurts.push([f.name, n]),
    castOnPlayer: (b) => d.cast.push(b), player: () => me, ...(clear ? { clear } : {}) });
  return d;
}
/** The real cast engine for `p`, the hosts' seams stubbed; `foes` its pool. */
function engine(p, foes = [], rolls = () => 0.999) {
  return createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }), uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity }, playerEntity: p,
    playerSinks: { hurt(n) { p.health -= n; }, heal(n) { p.health = Math.min(p.maxHealth, p.health + n); }, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {}, foes: () => foes, foeSinks: (t) => ({ hurt(n) { t.entity.health -= n; }, heal() {} }), absorbCtx: () => ({ inside: true, day: false }),
    rolls, startCastAnim: null,
  });
}
const eff = (type, subType, o = {}) => ({ type, subType, durationBase: 1, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
  magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1, ...o });
const SELF = (...effects) => ({ name: 'Self', rangeType: 0, element: 4, effects });
/** What a landing could take of `before` health (hostMagic.js tookOf). */
const tookOf = (r, before) => Math.max(0, Math.min(r.damage, before));

// ── the law and the powers (lane 1) ─────────────────────────────────

test('AUDIT SCHOOLS L1 H1 / L3 F1: RIFT LANCE AND CHAIN LIGHTNING KEEP THE LOOT\'S ONE REACH LAW (lootPowers.js near) - never my summon, never a foe at peace (a calmed one, a guard not yet hostile), never one a storey off, never one behind a wall; and an arc is its spell\'s element (elementShare): none on a foe immune to shock, half on one that resists (mutants: the reach unfiltered; the rise unread; the wall unread; the share dropped)', () => clean(() => {
  for (const id of ['riftwalker', 'elementalist']) {
    reset();
    const p = pathMage(id, 100);
    const struck = rec('struck', realFoe(MT.knight, { health: 900, maxHealth: 900 }), [0, 0, 0]);
    const hostile = rec('hostile', realFoe(MT.knight), [2, 0, 0]);
    const summon = rec('summon', realFoe(MT.daedra, { team: 'PlayerAlly' }), [1, 0, 0]);
    const calmed = rec('calmed', realFoe(MT.knight), [1.5, 0, 0], { isHostile: false });
    const upstairs = rec('upstairs', realFoe(MT.knight), [1, 3, 0]);
    const walled = rec('walled', realFoe(MT.knight), [2.5, 0, 0]);
    const all = [struck, hostile, summon, calmed, upstairs, walled];
    const d = door(all, p, { clear: (_a, b) => b !== walled.ai.feet });
    const before = struck.entity.health;
    const r = engine(p, all).applySpellToFoe(signatureSpell(id), 20, struck, { entity: p });
    const share = id === 'riftwalker' ? 1 / 3 : 1 / 2;
    assert.deepEqual(d.hurts, [['hostile', Math.floor(tookOf(r, before) * share)]], `${id}: the hostile foe alone`);
  }
  // the shock share - Chain Lightning's arcs are shock, as the loot's are (a rider of a magic element arcs as magic)
  reset();
  const el = pathMage('elementalist', 100);
  const t0 = rec('t0', realFoe(MT.knight, { health: 900, maxHealth: 900 }), [0, 0, 0]);
  const immune = rec('immune', realFoe(MT.knight, { career: { ...FOE_CAREER, immunityFlags: EFFECT_FLAGS.Shock } }), [2, 0, 0]);
  const resists = rec('resists', realFoe(MT.knight, { career: { ...FOE_CAREER, resistanceFlags: EFFECT_FLAGS.Shock } }), [3, 0, 0]);
  const d2 = door([t0, immune, resists], el);
  const before = t0.entity.health;
  const r2 = engine(el, [t0, immune, resists]).applySpellToFoe(signatureSpell('elementalist'), 20, t0, { entity: el });
  assert.deepEqual(d2.hurts, [['resists', Math.floor(tookOf(r2, before) * 0.5 * 0.5)]], 'immune: nothing; resists: half of the half');
  assert.match(src('src/systems/arcanePowers.js'), /return near\(door, at, metres, struck\.entity\)/, 'the one reach law, no second copy');
}));

test('AUDIT SCHOOLS L1 H2 / L5 H1: THE LIGHTBRINGER READS THE LOOT\'S ONE FOE GROUP (lootPowers.js foeGroup) - a Barbarian, a Knight and the City Watch are men, though their class\'s careerIndex (15, 17, 18) names undead as a monster\'s; a skeleton and a daedra are what Dawn\'s Ward and Dawnbolt\'s second burn are for (mutants: the careerIndex read as a monster\'s)', () => clean(() => {
  const lb = pathMage('lightbringer', 100);
  const pow = (t) => page(true, () => spellPowerMult(lb, t, { online: false }));
  for (const mt of [MT.barbarian, MT.knight, MT.watch]) assert.equal(pow(realFoe(mt)), 1, `class ${mt}: a man`);
  assert.equal(pow(realFoe(MT.skeleton)), 1.2, 'undead');
  assert.equal(pow(realFoe(MT.daedra)), 1.2, 'daedra');
  assert.equal(pow(realFoe(MT.rat)), 1, 'an animal');
  // the burn, through the cast engine
  lb.health = 10;
  const barb = rec('barb', realFoe(MT.barbarian, { health: 900, maxHealth: 900 }), [0, 0, 0]);
  const bones = rec('bones', realFoe(MT.skeleton, { health: 900, maxHealth: 900 }), [0, 0, 0]);
  const d = door([barb, bones], lb);
  const m = engine(lb, [barb, bones]);
  m.applySpellToFoe(signatureSpell('lightbringer'), 20, barb, { entity: lb });
  assert.deepEqual(d.hurts, [], 'a Barbarian burns once');
  const b0 = bones.entity.health;
  const r = m.applySpellToFoe(signatureSpell('lightbringer'), 20, bones, { entity: lb });
  assert.deepEqual(d.hurts, [['bones', Math.round(tookOf(r, b0) / 2)]], 'a skeleton burns again');
}));

test('AUDIT SCHOOLS L1 M1 / L2 F1: A POWER\'S BUNDLE ON ME MERGES AS DFU\'S INCUMBENTS DO, AND TAKES THE LARGER - Aegis Bolt\'s Shield through the real door over my own small Shield, my own large Shield over a rider\'s, Sanctify\'s ward over my weaker one; between two of my own casts DFU\'s law stands (the first\'s pool and chance cap the recast - X11) (mutants: the power merge dropped; the larger never taken; the tag never set; the larger taken for plain casts)', () => clean(() => {
  const bt = pathMage('battlemage', 100);
  bt.health = bt.maxHealth = 1000;
  const shieldOf = () => bt.activeEffects.filter((a) => a.kind === 'shield' && !a.ended);
  const SHIELD = (n) => SELF(eff(35, 255, { durationBase: 5, magnitudeBaseLow: n, magnitudeBaseHigh: n }));
  const t = rec('t', realFoe(MT.knight, { health: 9000, maxHealth: 9000 }), [0, 0, 0]);
  const m = engine(bt, [t]);
  m.update(0.001, [0, 0, 0]);   // the engine publishes its own door (systems/playerDoor.js) - the rider's real way to me
  assert.equal(typeof playerDoor()?.castOnPlayer, 'function');
  page(false, () => m.applySpellToPlayer(SHIELD(6), 20, { entity: bt }));
  assert.deepEqual(shieldOf().map((a) => [a.startingShield, a.shieldRemaining]), [[6, 6]]);
  const r = m.applySpellToFoe(signatureSpell('battlemage'), 20, t, { entity: bt });
  const rider = Math.max(1, Math.min(r.damage * 2, 200));   // twice it, at most a fifth of 1000
  assert.deepEqual(shieldOf().map((a) => [a.startingShield, a.shieldRemaining]), [[rider, rider]], 'one entry, the rider\'s larger pool');
  assert.equal(shieldOf()[0].bundlePower, undefined, 'my own cast\'s entry is not a power\'s');
  // a rider first, my own larger cast after it
  const b2 = pathMage('battlemage', 100);
  b2.health = b2.maxHealth = 1000;
  const m2 = engine(b2, [t]);
  m2.update(0.001, [0, 0, 0]);
  playerDoor().castOnPlayer(SHIELD(40), { power: true });
  const own = () => b2.activeEffects.filter((a) => a.kind === 'shield' && !a.ended);
  assert.deepEqual(own().map((a) => [a.startingShield, a.bundlePower]), [[40, true]]);
  page(false, () => m2.applySpellToPlayer(SHIELD(140), 20, { entity: b2 }));
  assert.deepEqual(own().map((a) => [a.startingShield, a.shieldRemaining]), [[140, 140]], 'my 140 over the rider\'s 40');
  // two of my own: DFU's recast law - the first pool caps
  const b3 = mage([ALT], 100);
  page(false, () => applySpell(SHIELD(50), 20, b3, {}, () => 0.5, { entity: b3 }));
  page(false, () => applySpell(SHIELD(100), 20, b3, {}, () => 0.5, { entity: b3 }));
  assert.deepEqual(b3.activeEffects.filter((a) => a.kind === 'shield').map((a) => [a.startingShield, a.shieldRemaining]), [[50, 50]], 'DFU: the incumbent\'s pool');
  // the ward: Sanctify's 30% over my own 5%; my own 80% over the rider's 30%; two of mine keep the first
  const WARD = (c) => SELF(eff(22, 255, { durationBase: 5, chanceBase: c }));
  const ward = (who) => who.activeEffects.filter((a) => a.kind === 'spellResistance').map((a) => a.chance);
  const hi = pathMage('hierophant', 100);
  const m3 = engine(hi);
  m3.update(0.001, [0, 0, 0]);
  page(false, () => m3.applySpellToPlayer(WARD(5), 20, { entity: hi }));
  page(false, () => m3.applySpellToPlayer(signatureSpell('hierophant'), 20, { entity: hi }));
  assert.deepEqual(ward(hi), [30], 'the rider\'s 30 over my 5');
  const h2 = pathMage('hierophant', 100);
  const m4 = engine(h2);
  m4.update(0.001, [0, 0, 0]);
  page(false, () => m4.applySpellToPlayer(signatureSpell('hierophant'), 20, { entity: h2 }));
  assert.deepEqual(h2.activeEffects.filter((a) => a.kind === 'spellResistance').map((a) => [a.chance, a.bundlePower]), [[30, true]], 'the rider\'s own entry, a power\'s');
  page(false, () => m4.applySpellToPlayer(WARD(80), 20, { entity: h2 }));
  assert.deepEqual(ward(h2), [80], 'my 80 over the rider\'s 30');
  const w2 = mage([THA], 100);
  page(false, () => applySpell(WARD(10), 20, w2, {}, () => 0.5, { entity: w2 }));
  page(false, () => applySpell(WARD(80), 20, w2, {}, () => 0.5, { entity: w2 }));
  assert.deepEqual(ward(w2), [10], 'DFU: the incumbent\'s chance (X11)');
}));

test('AUDIT SCHOOLS L1 M3: FORESIGHT IS ASKED BEFORE ANY MODIFIER - a foreseen blow lands nothing and no damage modifier hears it (the sets\' Iron Hide ward, Gearward\'s winding); a blow it does not foresee reaches them; a fall and a spell are never asked; one in eight exactly (mutants: Foresight a modifier again; the roll at <=; one in six)', () => clean(() => {
  const se = pathMage('seer', 100);
  se.health = se.maxHealth = 1000;
  door([], se);
  const heard = [];
  registerPlayerDamageMod('auditSchoolsProbe', (_e, dmg) => { heard.push(dmg); return dmg; });
  try {
    const orc = realFoe(MT.knight);
    POW._setArcanePowersRandForTests(() => 1 / 8 - 1e-9);
    setStruck(orc, se, 50);
    assert.equal(hurtPlayer(se, 50), false);
    assert.deepEqual([se.health, heard], [1000, []], 'foreseen: nothing landed, no modifier asked');
    hurtPlayer(se, 50);
    assert.deepEqual([se.health, heard], [950, [50]], 'a fall: never foreseen');
    POW._setArcanePowersRandForTests(() => 1 / 8);
    setStruck(orc, se, 50); hurtPlayer(se, 50);
    assert.deepEqual([se.health, heard], [900, [50, 50]], 'the roll at one in eight exactly: seven in eight land');
  } finally { registerPlayerDamageMod('auditSchoolsProbe', null); }
}));

test('AUDIT SCHOOLS L1 M2: THE WARDEN\'S GUARD IS WHOLE POINTS, THE FRACTION CARRIED - three 7-point blows a fifth lighter take 6, 6 and 5 (17 of 21, health whole), as Hold the Line\'s carry; its 30 seconds end between 29.9 and 30.1 (mutants: the raw share; the carry dropped; the window a second)', () => clean(() => {
  let now = 10;
  POW._setArcanePowersClockForTests(() => now);
  const wa = pathMage('warden', 100);
  wa.health = wa.maxHealth = 1000;
  door([], wa);
  const m = engine(wa);
  m.applySpellToPlayer(signatureSpell('warden'), 20, { entity: wa });
  for (const a of wa.activeEffects) if (a.kind === 'shield') a.shieldRemaining = 0;   // the pool aside: the guard alone
  wa.health = 1000;
  const orc = realFoe(MT.knight);
  const took = [];
  for (let i = 0; i < 3; i++) { const b = wa.health; setStruck(orc, wa, 7); hurtPlayer(wa, 7); took.push(b - wa.health); }
  assert.deepEqual(took, [6, 6, 5], '1.4 owed: 1 off; 1.8: 1 off; 2.2: 2 off - 4 of the 4.2 owed');   // 7 x 20% = 1.4 a blow
  assert.ok(Number.isInteger(wa.health), 'whole');
  now = 10 + 29.9;
  let b = wa.health; setStruck(orc, wa, 100); hurtPlayer(wa, 100);
  assert.ok(b - wa.health < 100, 'still guarded at 29.9 s');
  now = 10 + 30.1;
  b = wa.health; setStruck(orc, wa, 100); hurtPlayer(wa, 100);
  assert.equal(b - wa.health, 100, 'gone at 30.1 s');
}));

test('AUDIT SCHOOLS L1 M4: A DEATH SAVE\'S TURNED-ASIDE DEATH SPENDS NO ABSOLUTION AND NO SLIP AWAY (the Vigil\'s and Shed Skin\'s own rule, AUDIT 625 P1) - the save leaves me at 1 and both stay ready for a hurt that happened (mutants: `saved` unread)', () => clean(() => {
  registerPlayerDeathSave('auditSchoolsSave', () => true);
  try {
    const hi = pathMage('hierophant', 100);
    hi.health = 300; hi.maxHealth = 400;
    door([], hi);
    hurtPlayer(hi, 500);
    assert.equal(hi.health, 1, 'the save held - no Absolution on it');
    hi.health = 400; hurtPlayer(hi, 300);
    assert.equal(hi.health, 200, 'still ready: a real hurt below 30% heals a quarter');
    reset();
    registerPlayerDeathSave('auditSchoolsSave', () => true);
    const tr = pathMage('trickster', 100);
    tr.health = 200; tr.maxHealth = 300;
    const d = door([], tr);
    hurtPlayer(tr, 500);
    assert.deepEqual(d.cast, [], 'no fade on a saved death');
    tr.health = 300; hurtPlayer(tr, 250);
    assert.equal(d.cast.length, 1, 'ready for the real one');
  } finally { registerPlayerDeathSave('auditSchoolsSave', null); }
}));

test('AUDIT SCHOOLS L1 M5: BEGUILE REFUNDS ONLY A FOE IT CALMED - hostile before the cast, with a mind the host calms (`ai`); a foe already at peace, one with no ai, and one no Pacify sways (pacifyImmune - effects.js refuses it, so it never reports `pacify`) give nothing back (mutants: r.pacify alone; the ai unread)', () => clean(() => {
  const en = pathMage('enchanter', 100);
  const paid = calculateCastCost(signatureSpell('enchanter'), en).sp;
  const cast = (foe) => { en.magicka = 0; door([foe], en); engine(en, [foe], () => 0.1).applySpellToFoe(signatureSpell('enchanter'), 20, foe, { entity: en, cast: { cost: paid } }, { bypassSavingThrows: true }); return en.magicka; };
  assert.equal(cast(rec('angry', realFoe(MT.knight), [0, 0, 0])), Math.min(en.maxMagicka, paid), 'calmed: the whole price back');
  assert.equal(cast(rec('calm', realFoe(MT.knight), [0, 0, 0], { isHostile: false })), 0, 'already at peace');
  assert.equal(cast(rec('warden', realFoe(MT.knight, { pacifyImmune: true }), [0, 0, 0])), 0, 'nothing a Pacify sways');
  assert.equal(cast({ name: 'mindless', entity: realFoe(MT.knight) }), 0, 'no ai: nothing the host calms');
}));

test('AUDIT SCHOOLS L1 M6: "WHAT IT LANDS" IS WHAT THE FOE COULD LOSE - Siphon Life on a 3-point rat heals 3, not the bolt\'s overkill; Soul Lance\'s magicka the same (mutants: r.damage read whole)', () => clean(() => {
  const ne = pathMage('necromancer', 200);
  ne.health = 10;
  const rat = rec('rat', realFoe(MT.rat, { health: 3, maxHealth: 3 }), [0, 0, 0]);
  door([rat], ne);
  const r = engine(ne, [rat]).applySpellToFoe(signatureSpell('necromancer'), 20, rat, { entity: ne });
  assert.ok(r.damage > 6, 'the bolt rolled far past the rat');
  assert.equal(ne.health, 10 + Math.floor(3 / 2), 'half of the 3 it could take');
  reset();
  const so = pathMage('soulbinder', 200);
  so.magicka = 0;
  const rat2 = rec('rat2', realFoe(MT.rat, { health: 4, maxHealth: 4 }), [0, 0, 0]);
  door([rat2], so);
  engine(so, [rat2]).applySpellToFoe(signatureSpell('soulbinder'), 20, rat2, { entity: so });
  assert.equal(so.magicka, 1, 'a quarter of the 4 it could take');
}));

test('AUDIT SCHOOLS L1 L1-L2 / L2 F6-F7: ONE CAST, ONE TOKEN, THROUGH THE REAL RELEASE - an area spell over three foes builds ONE Conflux stack, the next cast a second; Unravel refunds a third of what the release CHARGED (the ready\'s price), a missile carrying it to the foe; a free ready refunds nothing (mutants: the token dropped; Conflux once a foe; the refund re-priced)', () => clean(() => {
  let now = 0;
  POW._setArcanePowersClockForTests(() => now);
  const el = pathMage('elementalist', 100);
  el.magicka = el.maxMagicka;
  const foes = [rec('a', realFoe(MT.knight, { health: 9000, maxHealth: 9000 }), [1, 0, 1]), rec('b', realFoe(MT.knight, { health: 9000, maxHealth: 9000 }), [-1, 0, 1]), rec('c', realFoe(MT.knight, { health: 9000, maxHealth: 9000 }), [0, 0, -1])];
  door(foes, el);
  const m = engine(el, foes);
  const AREA = { name: 'Nova', rangeType: 3, element: 3, effects: [eff(4, 0, { magnitudeBaseLow: 5, magnitudeBaseHigh: 5 })] };
  const conflux = () => page(true, () => POW.pathSpellPower(el, foes[0].entity));
  m.setReadied(AREA);
  assert.equal(m.castInput([0, 0.9, 0], [0, 0, 1]), true);
  assert.ok(foes.every((f) => f.entity.health < 9000), 'the area struck all three');
  assert.equal(conflux(), 3, 'one cast, one stack');
  m.setReadied(AREA);
  m.castInput([0, 0.9, 0], [0, 0, 1]);
  assert.equal(conflux(), 6, 'the next cast, the next');
  // Unravel: the missile carries its cast's token to the foe it meets
  reset();
  const sb = pathMage('spellbreaker', 100);
  sb.magicka = sb.maxMagicka;
  const t = rec('t', realFoe(MT.knight, { health: 9000, maxHealth: 9000 }), [0, 0, 6]);
  door([t], sb);
  const m2 = engine(sb, [t]);
  const sp = signatureSpell('spellbreaker');
  m2.setReadied(sp);
  const charged = m2.readiedCost();
  assert.ok(charged > 3);
  const full = sb.magicka;
  assert.equal(m2.castInput([0, 0.9, 0], [0, 0, 1]), true);
  for (let i = 0; i < 40 && t.entity.health === 9000; i++) m2.update(0.05, [0, 0, 0]);
  assert.ok(t.entity.health < 9000, 'the missile landed');
  assert.equal(sb.magicka, full - charged + Math.floor(charged / 3), 'a third of what the release charged');
  // a free ready (an item's spell): it took nothing, and gives nothing back
  _resetPlayerHealForTests();
  const t2 = rec('t2', realFoe(MT.knight, { health: 9000, maxHealth: 9000 }), [0, 0, 1]);
  door([t2], sb);
  const m3 = engine(sb, [t2]);
  m3.takeReady({ sp: { ...sp, rangeType: 1 }, free: true, cost: 0 });
  const was = sb.magicka;
  assert.equal(m3.castInput([0, 0.9, 0], [0, 0, 1]), true);
  assert.ok(t2.entity.health < 9000, 'the touch landed');
  assert.equal(sb.magicka, was, 'nothing paid, nothing back');
}));

test('AUDIT SCHOOLS L5 M1: EVERY NUMBER ON BOTH SIDES OF ITS LINE - Rift Lance\'s 4 m and Chain Lightning\'s 8 m (3.99 in, 4.01 out), Blood Boil\'s and Absolution\'s 30% and Slip Away\'s third (just under, at the line), the Seer\'s 12 s, Conflux\'s 10 s and Prismatic Ward\'s 30 s (just before, just after), the recoveries (2 and 3 minutes: a second short, on the second), Aegis Bolt\'s twice what it landed under the cap (mutants: each number moved)', () => clean(() => {
  let now = 100;
  POW._setArcanePowersClockForTests(() => now);
  const big = () => realFoe(MT.knight, { health: 9000, maxHealth: 9000 });
  // the reach
  for (const [id, metres] of [['riftwalker', 4], ['elementalist', 8]]) {
    reset(); POW._setArcanePowersClockForTests(() => now);
    const p = pathMage(id, 100);
    const struck = rec('struck', big(), [0, 0, 0]);
    const inside = rec('inside', big(), [metres - 0.01, 0, 0]);
    const outside = rec('outside', big(), [0, 0, metres + 0.01]);
    const d = door([struck, inside, outside], p);
    engine(p, [struck, inside, outside]).applySpellToFoe(signatureSpell(id), 20, struck, { entity: p });
    assert.deepEqual(d.hurts.map(([n]) => n), ['inside'], `${id}: ${metres} m`);
  }
  // Blood Boil's line: a foe left just under 30% boils, one at 30% does not
  reset(); POW._setArcanePowersClockForTests(() => now);
  const bm = pathMage('bloodmage', 100);
  const boil = (left) => {
    const probe = rec('probe', big(), [0, 0, 0]);
    door([probe], bm);
    const bolt = engine(bm, [probe]).applySpellToFoe(signatureSpell('bloodmage'), 20, probe, { entity: bm }).damage;
    const f = rec('f', realFoe(MT.knight, { health: left + bolt, maxHealth: 1000 }), [0, 0, 0]);
    const d = door([f], bm);
    engine(bm, [f]).applySpellToFoe(signatureSpell('bloodmage'), 20, f, { entity: bm });
    return d.hurts.length;
  };
  assert.equal(boil(299), 1, '29.9% left: it boils');
  assert.equal(boil(300), 0, '30% left: it does not');
  assert.equal(boil(0), 0, 'a corpse never boils (L5 M4)');
  // Slip Away's third and Absolution's 30%: just under the line, and at it
  reset(); POW._setArcanePowersClockForTests(() => now);
  const tr = pathMage('trickster', 100);
  tr.maxHealth = 300;
  const d1 = door([], tr);
  tr.health = 300; hurtPlayer(tr, 200);
  assert.equal(d1.cast.length, 0, 'at a third (100 of 300): not below it');
  tr.health = 300; hurtPlayer(tr, 201);
  assert.equal(d1.cast.length, 1, 'just below');
  now += 119; tr.health = 300; hurtPlayer(tr, 201);
  assert.equal(d1.cast.length, 1, 'a second short of 2 minutes');
  now += 1; tr.health = 300; hurtPlayer(tr, 201);
  assert.equal(d1.cast.length, 2, 'on the second');
  tr.health = 50; now += 500; hurtPlayer(tr, 10);
  assert.equal(d1.cast.length, 2, 'a hurt while already under the line crosses nothing (L5 M4)');
  reset(); POW._setArcanePowersClockForTests(() => now);
  const hi = pathMage('hierophant', 100);
  hi.maxHealth = 1000;
  door([], hi);
  hi.health = 1000; hurtPlayer(hi, 700);
  assert.equal(hi.health, 300, 'at 30%: not below it');
  hi.health = 1000; hurtPlayer(hi, 701);
  assert.equal(hi.health, 299 + 250, 'just below: a quarter back');
  now += 179; hi.health = 1000; hurtPlayer(hi, 701);
  assert.equal(hi.health, 299, 'a second short of 3 minutes');
  now += 1; hi.health = 1000; hurtPlayer(hi, 701);
  assert.equal(hi.health, 549, 'on the second');
  // the Seer's mark, Conflux and Prismatic Ward: just before their end and just after
  reset(); POW._setArcanePowersClockForTests(() => now);
  const se = pathMage('seer', 100);
  const mark = rec('mark', big(), [0, 0, 0]);
  door([mark], se);
  const at = now;
  engine(se, [mark]).applySpellToFoe(signatureSpell('seer'), 20, mark, { entity: se });
  now = at + 11.9; assert.equal(spellPierce(se, mark.entity), 20, 'laid open at 11.9 s');
  now = at + 12.1; assert.equal(spellPierce(se, mark.entity), 0, 'closed at 12.1 s');
  reset(); POW._setArcanePowersClockForTests(() => now);
  const el = pathMage('elementalist', 100);
  const t = rec('t', big(), [0, 0, 0]);
  door([t], el);
  const start = now;
  engine(el, [t]).applySpellToFoe({ name: 'Bolt', rangeType: 2, element: 3, effects: [eff(4, 0, { magnitudeBaseLow: 5, magnitudeBaseHigh: 5 })] }, 20, t, { entity: el });
  now = start + 9.9; assert.equal(POW.pathSpellPower(el, t.entity), 3, 'a stack at 9.9 s');
  now = start + 10.1; assert.equal(POW.pathSpellPower(el, t.entity), 0, 'none at 10.1 s');
  engine(el, [t]).applySpellToFoe({ name: 'Bolt', rangeType: 2, element: 3, effects: [eff(4, 0, { magnitudeBaseLow: 5, magnitudeBaseHigh: 5 })] }, 20, t, { entity: el });
  assert.equal(POW.pathSpellPower(el, t.entity), 3, 'a cast after the window starts again at one stack, not the old two (L5 M4)');
  reset(); POW._setArcanePowersClockForTests(() => now);
  const ww = pathMage('wardwright', 100);
  door([], ww);
  const w0 = now;
  engine(ww).applySpellToPlayer(signatureSpell('wardwright'), 20, { entity: ww });
  now = w0 + 29.9; assert.equal(POW.pathAbsorbChance(ww), 40, 'at 29.9 s');
  now = w0 + 30.1; assert.equal(POW.pathAbsorbChance(ww), 0, 'at 30.1 s');
  // Aegis Bolt under its cap: twice what it landed
  reset();
  const bt = pathMage('battlemage', 100);
  bt.health = bt.maxHealth = 10000;
  const small = rec('small', realFoe(MT.knight, { health: 7, maxHealth: 7 }), [0, 0, 0]);
  const d2 = door([small], bt);
  engine(bt, [small]).applySpellToFoe(signatureSpell('battlemage'), 20, small, { entity: bt });
  assert.deepEqual(d2.cast.map((b) => b.effects[0].magnitudeBaseLow), [14], 'it could take 7: a Shield of 14');
}));

test('AUDIT SCHOOLS L5 M4: THE RIDERS\' GUARDS, through the producers - a bolt the foe saved against (it took nothing) wraps me in no Shadow and no Shield; my bolt a foe turned back at me (Spell Reflection, the real return through applySpellToPlayer) rides nothing either way; a landing on a player (the referee\'s stand-in, as duelCombat.js mints it) answers nothing; a landing listener that throws never breaks the cast (mutants: each guard dropped)', () => clean(() => {
  for (const id of ['shadowcaster', 'battlemage']) {
    reset();
    const p = pathMage(id, 100);
    p.health = p.maxHealth = 5000;
    const t = rec('t', realFoe(MT.knight, { health: 900, maxHealth: 900 }), [0, 0, 0]);
    const d = door([t], p);
    const saved = engine(p, [t], () => 0).applySpellToFoe(signatureSpell(id), 20, t, { entity: p });
    assert.deepEqual([saved.damage, t.entity.health], [0, 900], `${id}: the foe saved it whole (a roll of 1 under its 50 - 20)`);
    assert.deepEqual(d.cast, [], `${id}: a save made wraps nothing`);
    const mirror = rec('mirror', realFoe(MT.knight, { health: 900, maxHealth: 900, activeEffects: [{ kind: 'spellReflection', chance: 100, roundsRemaining: 9 }] }), [0, 0, 0]);
    const dm = door([mirror], p);
    const before = p.health;
    const back = engine(p, [mirror]).applySpellToFoe(signatureSpell(id), 20, mirror, { entity: p });
    assert.ok(back.reflected > 0 && p.health < before, `${id}: turned back, it struck me`);
    assert.deepEqual(dm.cast, [], `${id}: a turned bolt rides nothing`);
    const dp = door([], p);
    tellSpellLanded({ caster: p, target: duelStandIn(), foe: null, spell: signatureSpell(id), r: { damage: 40 }, self: false, took: 40, cast: null });
    assert.deepEqual(dp.cast, [], `${id}: a player`);
    const d2 = door([t], p);
    engine(p, [t]).applySpellToFoe(signatureSpell(id), 20, t, { entity: p });
    assert.equal(d2.cast.length, 1, `${id}: a landing that took`);
  }
  reset();
  registerSpellLandedListener('auditSchoolsThrows', () => { throw new Error('a rider broke'); });
  try {
    const ne = pathMage('necromancer', 100);
    ne.health = 10;
    const t = rec('t', realFoe(MT.knight, { health: 900, maxHealth: 900 }), [0, 0, 0]);
    door([t], ne);
    const r = engine(ne, [t]).applySpellToFoe(signatureSpell('necromancer'), 20, t, { entity: ne });
    assert.ok(r.damage > 0 && ne.health > 10, 'the cast landed and Siphon Life still healed');
  } finally { registerSpellLandedListener('auditSchoolsThrows', null); }
}));

test('AUDIT SCHOOLS L5 H4: STEADFAST THROUGH THE MAGIC ROUND ITSELF (worldTick.js runMagicRoundsFor - the seam, not the function): 1% a round while my Shield holds, none once it is gone (mutants: the round hook never registered)', () => clean(() => {
  const wa = pathMage('warden', 100);
  wa.maxHealth = 1000; wa.health = 1000;
  door([], wa);
  engine(wa).applySpellToPlayer(signatureSpell('warden'), 20, { entity: wa });
  assert.ok(wa.activeEffects.some((a) => a.kind === 'shield' && a.shieldRemaining > 0), 'Living Aegis\'s Shield holds');
  wa.health = 500;
  const sinks = { heal: (n) => { wa.health = Math.min(wa.maxHealth, wa.health + n); }, hurt() {}, say() {} };
  runMagicRoundsFor(wa, 0, 1, { sinks, rolls: () => 0.5 });
  assert.equal(wa.health, 510, 'a round: 1% of 1000');
  for (const a of wa.activeEffects) if (a.kind === 'shield') a.shieldRemaining = 0;
  runMagicRoundsFor(wa, 1, 2, { sinks, rolls: () => 0.5 });
  assert.equal(wa.health, 510, 'the Shield spent: no more');
}));

test('AUDIT SCHOOLS L5 LOW: SOUL WELL PAYS FOR NO CITY WATCH AND FOR NO TRAP THAT ENDED - the City Watch never counts (the sets\' and the loot\'s own law), and a trap that ended held nothing (mutants: the Watch counted; an ended trap read as holding)', () => clean(() => {
  const sb = pathMage('soulbinder', 100);
  door([], sb);
  const gained = (foe) => { sb.magicka = 0; reportPlayerKill(foe); return sb.magicka; };
  assert.equal(gained(realFoe(MT.watch)), 0, 'the Watch');
  const plain = gained(realFoe(MT.knight));
  assert.equal(plain, Math.floor(sb.maxMagicka * 0.1));
  _resetPlayerHealForTests();
  assert.equal(gained(realFoe(MT.knight, { activeEffects: [{ kind: 'soulTrap', chance: 50, roundsRemaining: 0, ended: true }] })), plain, 'an ended trap: 10%');
  _resetPlayerHealForTests();
  assert.equal(gained(realFoe(MT.knight, { activeEffects: [{ kind: 'soulTrap', chance: 50, roundsRemaining: 3 }] })), Math.floor(sb.maxMagicka * 0.2), 'a live trap of mine: 20%');
}));

// ── the spell engine (lane 2) ───────────────────────────────────────

test('AUDIT SCHOOLS L2 F2 / F9: A WORN ITEM\'S BUNDLE AND MY SPELL TURNED BACK AT ME TAKE NO SCHOOL PAST 100 - a Cast When Held ward keeps its own chance (it outlived a duel\'s start and a mentoring to its reroll), and my heal a foe reflected heals what it says (mutants: the held item scaled; the reflected scaled)', () => clean(() => {
  const t200 = mage([THA, RES], 200);
  const ring = { name: 'Ring', equipSlot: 1, currentCondition: 100 };
  page(true, () => applySpell(SELF(eff(21, 255, { durationBase: 5, chanceBase: 50 })), 20, t200, {}, () => 0.5, { entity: t200 }, { heldItem: ring }));
  assert.deepEqual(t200.activeEffects.filter((a) => a.kind === 'spellReflection').map((a) => a.chance), [50], 'the item\'s own 50');
  const own = mage([THA], 200);
  page(true, () => applySpell(SELF(eff(21, 255, { durationBase: 5, chanceBase: 50 })), 20, own, {}, () => 0.5, { entity: own }));
  assert.deepEqual(own.activeEffects.filter((a) => a.kind === 'spellReflection').map((a) => a.chance), [70], 'my own cast: x1.4');
  const heal = SELF(eff(10, 8, { magnitudeBaseLow: 50, magnitudeBaseHigh: 50 }));
  assert.equal(page(true, () => applySpell(heal, 20, t200, { heal() {} }, () => 0.5, { entity: t200 }, { reflectedCount: 1 }).healed), 50, 'turned back at me');
  assert.equal(page(true, () => applySpell(heal, 20, t200, { heal() {} }, () => 0.5, { entity: t200 }).healed), 70, 'my own');
  // Troll's Blood held: a Regenerate's rounds read no school
  const worn = mage([RES], 200);
  let got = 0;
  page(true, () => applySpell(SELF(eff(18, 255, { durationBase: 3, magnitudeBaseLow: 10, magnitudeBaseHigh: 10 })), 20, worn, { heal: (n) => { got += n; }, say() {} }, () => 0.5, { entity: worn }, { heldItem: ring }));
  assert.equal(got, 10, 'a worn Regenerate: its own 10');
}));

test('AUDIT SCHOOLS L2 F3: A REGENERATE READS ITS SCHOOL EVERY ROUND, as a damage over time does - cast at Restoration 200 it heals 14 a round, a mentoring or a refereed fight begun mid-way takes the climb off the next round, and it comes back when they end (mutants: frozen at the cast)', () => clean(() => {
  const r200 = mage([RES], 200);
  r200.health = 10; r200.maxHealth = 10000;
  const sinks = { heal: (n) => { r200.health += n; }, hurt() {}, say() {} };
  page(true, () => applySpell(SELF(eff(18, 255, { durationBase: 10, magnitudeBaseLow: 10, magnitudeBaseHigh: 10 })), 20, r200, sinks, () => 0.5, { entity: r200 }));
  const round = (k) => { const b = r200.health; page(true, () => runMagicRoundsFor(r200, k, k + 1, { sinks, rolls: () => 0.5 })); return r200.health - b; };
  assert.equal(round(0), 14, 'x1.4');
  assert.equal(refreshMentor(r200, [5, 5]), 'on', 'a party of level 5s: mentoring');
  assert.equal(round(1), 10, 'mentoring');
  assert.equal(refreshMentor(r200, []), 'off');
  setSigilDueling(true);
  assert.equal(round(2), 10, 'a refereed fight');
  setSigilDueling(false);
  assert.equal(round(3), 14, 'back');
}));

test('AUDIT SCHOOLS L2 F5: MENTORING LEAVES A SIGNATURE SPELL IN ITS PATH\'S SCHOOLS - priced, trained and sold by the pair (pathHeld), the powers asleep (pathAwake); a Necromancer\'s Siphon Life never turns into the Destruction they never chose (mutants: the cast school through pathAwake; the shelf through pathAwake)', () => clean(() => {
  const ne = pathMage('necromancer', 150);
  ne.level = 30; ne.skills[DES] = 15;
  const sp = signatureSpell('necromancer');
  const plain = { ...sp, path: undefined };   // the same bundle, no path: cast in its own Destruction
  const price = (spell) => page(true, () => calculateCastCost(spell, ne).sp);
  const awake = price(sp);
  assert.ok(awake < price(plain), 'awake: the pair prices it');
  assert.equal(refreshMentor(ne, [8, 8]), 'on', 'a party of level 8s: mentoring, automatic');
  assert.equal(AP.pathAwake(ne), null, 'the powers sleep');
  assert.equal(AP.pathHeld(ne)?.id, 'necromancer', 'the path is held');
  assert.equal(castSchool(ne, sp, sp.effects[0]), RES, 'cast in the pair (a tie: the first)');
  assert.deepEqual(signatureOffers(ne).map((s) => s.path), ['necromancer'], 'still sold to them');
  assert.ok(price(sp) < price(plain), `mentored, still the pair's price (${price(sp)}), never the Destruction one (${price(plain)})`);
}));

test('AUDIT SCHOOLS L5 M2: pathCastSchool - an effect of the pair stays its own school\'s; one outside it takes the STRONGER of the pair, a tie the first (Soul Lance: its Soul Trap is Mysticism\'s with Thaumaturgy above it; its Damage Health is Thaumaturgy\'s then, Mysticism\'s on a tie) (mutants: a pair effect cast in the stronger; a tie the second)', () => {
  const so = pathMage('soulbinder', 150);
  const sp = signatureSpell('soulbinder');
  const trap = sp.effects.find((e) => e.type === 12), harm = sp.effects.find((e) => e.type === 4);
  so.skills[THA] = 180;
  assert.equal(castSchool(so, sp, trap), MYS, 'the trap is Mysticism\'s own');
  assert.equal(castSchool(so, sp, harm), THA, 'the harm: the stronger');
  so.skills[THA] = 150;
  assert.equal(castSchool(so, sp, harm), MYS, 'a tie: the first of the pair');
});

test('AUDIT SCHOOLS L5 M3 / L2 F9: ILLUSION PAST 100 LENGTHENS CHAMELEON AND SHADOW TOO (not only Invisibility); Comprehend Languages is no ward - its chance reads no Thaumaturgy (mutants: Chameleon unscaled; Shadow unscaled; Comprehend scaled)', () => clean(() => {
  for (const [sub, kind] of [[23, 'chameleonNormal'], [24, 'shadeNormal']]) {
    const rounds = (raw) => {
      const p = mage([ILL], raw);
      page(true, () => applySpell(SELF(eff(sub, 0, { durationBase: 10 })), 20, p, {}, () => 0.5, { entity: p }));
      const a = p.activeEffects.find((x) => x.kind === kind);
      assert.ok(a, `${kind} landed (${p.activeEffects.map((x) => x.kind)})`);
      return a.roundsRemaining + 1;
    };
    assert.deepEqual([rounds(100), rounds(200)], [10, 14], `${kind}: 10 rounds, x1.4`);
  }
  const m200 = mage([MYS, THA], 200);   // Comprehend Languages is Mysticism's (spellcost.js '44,255')
  page(true, () => applySpell(SELF(eff(44, 255, { durationBase: 5, chanceBase: 50 })), 20, m200, {}, () => 0.5, { entity: m200 }));
  const cl = m200.activeEffects.find((a) => a.kind === 'comprehendLanguages');
  assert.ok(cl, 'Comprehend Languages landed');
  assert.equal(cl.chance, 50, 'its own chance');
}));

test('AUDIT SCHOOLS L2 F4: MY SPELL ON THE RELAY\'S STAND-INS IS TOLD TO THE RIDERS - the court\'s Warden, its crystals, its host and the serpent\'s hide each tell the landing (no foe record: the relay holds the body), and the cast engine hands each its cast\'s wrapper (by source: the stand-ins live inside the page builders) (mutants: a stand-in untold; the caster dropped)', () => {
  const dc = src('src/scenes/dungeonContext.js');
  // PIN MOVED (FIELD BUGS 2026-10-19f STAND-IN-WHOLE, HOST-SPLIT): the court's three spell doors left the context as one
  // (scenes/gate/standInSpell.js onBody) - each counted on its stand-in and told, and what the riders are told is what can
  // land there (the number the HUD says), never a claim no relay lands
  const sis = src('src/scenes/gate/standInSpell.js');
  assert.match(sis, /function tellStandIn\(sp, entity, r, took, caster\) \{\n\s*tellSpellLanded\(\{ caster: player, target: entity, foe: null, spell: sp, r, self: false, took, cast: caster\?\.cast \?\? null \}\);/);
  assert.match(sis, /const \{ dealt: counted, r, kept \} = countOnStandIn\(harm, body\.entity, player\.level, player, rolls, rounds\.carried\(key\)\);\n\s*const dealt = counted >= 1 \? bossStrike\(body\.entity, counted, \{ kind: 'spell', element: sp\.element \?\? null \}\)\.damage : counted;[^\n]*\n\s*if \(!\(dealt >= 1\)\) \{[^]*?\n\s*\}\n\s*const shown = standInShown\(dealt, standInBlowCap\(body\.entity, player\.level\)\);\n\s*tellStandIn\(sp, body\.entity, r, shown, caster\);/);
  for (const [fn, who, land] of [['spellOnCrystal', 'cr', 'landOnCrystal'], ['spellOnHost', 'hb', 'landOnHost'], ['spellOnBoss', 'boss', 'landOnBoss']]) {
    assert.match(sis, new RegExp(`function ${fn}\\(sp, [^)]*caster = null\\) \\{[\\s\\S]*?return onBody\\(sp, ${who}, harm, caster, host\\.${land}, `), fn);   // PIN MOVED (FIELD BUGS 2026-10-19f BOSS-DOT): each its rounds' key
  }
  assert.match(dc, /castAtBoss: opts\.gateBoss \? \(sp, caster\) => spellOnBoss\(sp, caster\) : null,/);
  assert.match(dc, /castAtCrystal: opts\.gateCrystals \? \(sp, c, caster\) => spellOnCrystal\(sp, c, caster\) : null,/);
  assert.match(dc, /castAtHost: opts\.gateHost \? \(sp, i, caster\) => spellOnHost\(sp, i, caster\) : null,/);
  const w = src('src/scenes/world.js');
  // PIN MOVED (FIELD BUGS 2026-10-19f BOSS-DOT): the serpent's door left bootWorld for scenes/gate/standInSpell.js createSerpentSpell, which tells the riders
  assert.match(sis, /tellSpellLanded\(\{ caster: player, target: e, foe: null, spell: sp, r, self: false, took: standInShown\(dealt, SERPENT_HIT_CAP_X \* SERPENT_HAND_REF\), cast: caster\?\.cast \?\? null \}\);/);
  assert.match(w, /castAtBox: \(sp, q, caster\) => serpentSpell\.cast\(sp, q, caster\),/);
  const hm = src('src/scenes/hostMagic.js');
  assert.match(hm, /function giveToBoss\(mark, sp, caster = null\) \{/);
  assert.match(hm, /else giveToBoss\(hitBoss, m\.spell, playerCaster\(m\.cast \?\? null\)\);/);
  assert.match(hm, /castAtBox\(m\.spell, hitBox, playerCaster\(m\.cast \?\? null\)\)/);
});

test('AUDIT SCHOOLS L2 F8 / L5 H2: WHAT THE PATHS DO IS REGISTERED WITH THE ONE CAST ENGINE EVERY PAGE BUILDS - hostMagic.js imports arcanePowers.js, and the world, the exterior and the dungeon page each build that engine (the standalone dungeon page had the paths\' price and none of their powers) (mutants: the import dropped)', () => {
  assert.match(src('src/scenes/hostMagic.js'), /^import '\.\.\/systems\/arcanePowers\.js';/m);
  for (const f of ['src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    assert.match(src(f), /const magic = createPlayerMagic\(\{/, `${f} builds the one engine`);
    assert.match(src(f), /import \{[^}]*createPlayerMagic[^}]*\} from '\.\/hostMagic\.js';/, `${f} from hostMagic.js`);
  }
});

// ── online integrity (lane 3) ───────────────────────────────────────

test('AUDIT SCHOOLS L3 F2: A SAVE AN OLDER BUILD CARRIED KEEPS ITS PATH - no `arcanePath` key, and the book\'s signature spell names one path whose schools are mastered: the path, already asked; two paths\' spells, a school unmastered, or a newer save\'s own `null` restore none (mutants: the witness unread; a `null` read as missing)', () => {
  const p = pathMage('seer', 150);
  p.pathPrompted = true;
  p.spells = [signatureSpell('seer')];
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(p)));
  const { arcanePath: _a, pathPrompted: _b, ...older } = snap;
  older.career = { ...older.career }; delete older.career.arcaneMirror;   // PIN MOVED (AUDIT SPEC-RESET L2-1): a save from before the mirror - the book alone bears witness
  const back = (s) => { const e = structuredClone(playerEntity); restorePlayer(e, s); return [e.arcanePath, e.pathPrompted]; };
  assert.deepEqual(back(older), ['seer', true], 'the book bears witness');
  assert.deepEqual(back({ ...older, spells: [signatureSpell('seer'), signatureSpell('necromancer')] }), [null, false], 'two paths\' spells');
  assert.deepEqual(back({ ...older, masteredSkills: [ILL] }), [null, false], 'a school unmastered');
  assert.deepEqual(back({ ...snap, arcanePath: null, pathPrompted: false }), [null, false], 'a newer save that chose none');
});

test('AUDIT SCHOOLS L3 F4 / F5 / L5 H5: THE READY-MADE BANDS ARE NOBODY\'S TO MINT, AND THE SIGNATURE RECORDS ARE LITERAL - a book holding Shared Cartography or a signature spell seeds no made spell into their bands; every ready-made index stands at the ceiling or below; each path\'s record (index, name, element, range, icon, every slot\'s numbers) is pinned whole - a bought copy carries its index for good (mutants: the seed steps into the band; the base moved; any slot number moved)', () => {
  _resetCustomIndexForTests();
  try {
    seedCustomSpellIndex([{ index: SHARED_CARTOGRAPHY_SPELL_INDEX }, { index: RESURRECTION_SPELL_INDEX }, signatureSpell('battlemage')]);
    assert.equal(mintCustomSpellIndex(), -1, 'the bands seed nothing');
    seedCustomSpellIndex([{ index: -7 }, { index: SHARED_CARTOGRAPHY_SPELL_INDEX }]);
    assert.equal(mintCustomSpellIndex(), -8, 'a made spell seeds');
  } finally { _resetCustomIndexForTests(); }
  assert.equal(READY_MADE_INDEX_CEILING, -45000);
  for (const i of [RESURRECTION_SPELL_INDEX, SHARED_CARTOGRAPHY_SPELL_INDEX, ...AP.PATHS.map((p) => p.spell.index)]) assert.ok(isReadyMadeSpellIndex(i), `${i} under the ceiling`);
  assert.equal(isReadyMadeSpellIndex(-44999), false);
  const F = ['durationBase', 'durationMod', 'durationPerLevel', 'chanceBase', 'chanceMod', 'chancePerLevel', 'magnitudeBaseLow', 'magnitudeBaseHigh', 'magnitudeLevelBase', 'magnitudeLevelHigh', 'magnitudePerLevel'];
  const LITERAL = {
    battlemage: [-46101, 'Aegis Bolt', 3, 2, 23, [[4, 0, [1, 1, 1, 1, 1, 1, 10, 18, 2, 3, 1]]]],
    trickster: [-46102, 'Fleeting Hold', 4, 2, 30, [[0, 255, [2, 1, 4, 35, 2, 2, 1, 1, 1, 1, 1]]]],
    riftwalker: [-46103, 'Rift Lance', 4, 2, 47, [[4, 0, [1, 1, 1, 1, 1, 1, 8, 16, 2, 3, 1]]]],
    warden: [-46104, 'Living Aegis', 4, 0, 36, [[35, 255, [8, 1, 2, 1, 1, 1, 10, 20, 2, 3, 1]], [10, 8, [1, 1, 1, 1, 1, 1, 8, 14, 1, 2, 1]]]],
    wardwright: [-46105, 'Prismatic Ward', 4, 0, 12, [[8, 0, [10, 2, 2, 25, 2, 2, 1, 1, 1, 1, 1]], [8, 1, [10, 2, 2, 25, 2, 2, 1, 1, 1, 1, 1]], [8, 3, [10, 2, 2, 25, 2, 2, 1, 1, 1, 1, 1]]]],
    shadowcaster: [-46106, 'Shadow Bolt', 4, 2, 52, [[4, 0, [1, 1, 1, 1, 1, 1, 8, 16, 2, 3, 1]]]],
    spellbreaker: [-46107, 'Unravel', 4, 2, 41, [[4, 0, [1, 1, 1, 1, 1, 1, 8, 14, 2, 3, 1]], [19, 255, [3, 1, 4, 30, 2, 2, 1, 1, 1, 1, 1]]]],
    bloodmage: [-46108, 'Blood Boil', 0, 2, 3, [[4, 0, [1, 1, 1, 1, 1, 1, 10, 18, 2, 3, 1]]]],
    elementalist: [-46109, 'Chain Lightning', 3, 2, 25, [[4, 0, [1, 1, 1, 1, 1, 1, 10, 18, 2, 3, 1]]]],
    seer: [-46110, 'Psychic Lance', 4, 2, 44, [[4, 0, [1, 1, 1, 1, 1, 1, 8, 14, 2, 3, 1]]]],
    lightbringer: [-46111, 'Dawnbolt', 4, 2, 18, [[4, 0, [1, 1, 1, 1, 1, 1, 8, 16, 2, 3, 1]]]],
    enchanter: [-46112, 'Beguile', 4, 2, 33, [[33, 2, [1, 1, 1, 30, 2, 2, 1, 1, 1, 1, 1]], [34, 255, [1, 1, 1, 30, 2, 2, 1, 1, 1, 1, 1]]]],
    necromancer: [-46113, 'Siphon Life', 4, 2, 57, [[4, 0, [1, 1, 1, 1, 1, 1, 8, 16, 2, 3, 1]]]],
    soulbinder: [-46114, 'Soul Lance', 4, 2, 62, [[12, 255, [6, 1, 2, 40, 2, 2, 1, 1, 1, 1, 1]], [4, 0, [1, 1, 1, 1, 1, 1, 6, 12, 2, 3, 1]]]],
    hierophant: [-46115, 'Sanctify', 4, 0, 9, [[10, 8, [1, 1, 1, 1, 1, 1, 12, 20, 2, 4, 1]], [3, 1, [1, 1, 1, 100, 1, 20, 1, 1, 1, 1, 1]], [3, 0, [1, 1, 1, 100, 1, 20, 1, 1, 1, 1, 1]]]],
  };
  assert.deepEqual(Object.keys(LITERAL), AP.PATHS.map((p) => p.id));
  for (const p of AP.PATHS) {
    const s = signatureSpell(p.id);
    assert.deepEqual([s.index, s.name, s.element, s.rangeType, s.icon, s.effects.filter((e) => e.type > -1).map((e) => [e.type, e.subType, F.map((k) => e[k])])], LITERAL[p.id], p.id);
  }
});

// ── the player's surface and its words (lane 4) ─────────────────────

test('AUDIT SCHOOLS L4 4: A SIGNATURE SPELL\'S RECORD IS MINTED UNDER ITS ENGLISH NAME AND SHOWN IN THE PLAYER\'S LANGUAGE (loot.js shownSpellName, as a stock spell is) - the wire\'s ASCII label never loses it, a language switch never splits the book from the shelf, and a name the player gave it stays theirs (mutants: minted in the buyer\'s language; the shown name the record\'s)', () => {
  const was = tm.currentLocale();
  try {
    tm.setLocale(tm.PSEUDO_LOCALE);
    const sp = signatureSpell('necromancer');
    assert.equal(sp.name, 'Siphon Life', 'minted in English whatever the language');
    assert.equal(shownSpellName(sp), AP.PATH_BY_ID.necromancer.spell.name, 'shown in the player\'s');
    assert.notEqual(shownSpellName(sp), 'Siphon Life');
    assert.equal(shownSpellName({ ...sp, name: 'My Leech' }), 'My Leech', 'a name the player gave it');
  } finally { tm.setLocale(was); }
});

test('AUDIT SCHOOLS L4 H2: NO ENGLISH LINE SAYS "a" BEFORE A VOWEL - every path\'s words, its choice box, its chosen line, its refusals and its about rows, for all fifteen (mutants: "Become a {name}?")', () => {
  const lines = [];
  for (const p of AP.PATHS) {
    const two = mage(p.schools, 100);
    lines.push(...AP.pathChoiceRows(two, p.id), ...AP.pathAboutRows(p), ...AP.pathPowerRows(p), AP.choosePath(two, p.id).text, AP.pathRefusal(two, p.id), AP.pathRefusal(mage([]), p.id));
  }
  lines.push(...AP.pathsOpenRows(AP.PATHS.slice(0, 3)), AP.pathDeclinedText());
  for (const l of lines.filter(Boolean)) assert.doesNotMatch(l, /\ba [AEIOUaeiou]/, l);
});

test('AUDIT SCHOOLS L4 M1 / L5 H3: THE ONE ASK (scenes/shared.js raisePlayerSkills) - one path open is asked about and Yes chooses it; several are NAMED in an OK box that sends the player to the skill screen, choosing none; asked once; one box a pass - a mastery waiting is asked first (mutants: the ask never made; asked every pass; the first of several chosen on Yes; Yes chooses nothing)', () => {
  const asks = [];
  const ask = (rows, onYes, onNo, o = {}) => { asks.push({ rows, onYes, onNo, okOnly: !!o.okOnly }); };
  const one = mage([RES, MYS], 100);
  one.masterSkillsInfoSeen = true;
  raisePlayerSkills(one, { ask, rolls: () => 0.99 });
  assert.equal(asks.length, 1);
  assert.equal(asks[0].rows[0], 'Specialize as Necromancer?');
  assert.equal(asks[0].okOnly, false);
  assert.equal(one.pathPrompted, true);
  asks[0].onYes();
  assert.equal(one.arcanePath, 'necromancer', 'Yes chooses it');
  raisePlayerSkills(one, { ask, rolls: () => 0.99 });
  assert.equal(asks.length, 1, 'asked once');
  const three = mage([ALT, RES, MYS], 100);
  three.masterSkillsInfoSeen = true;
  raisePlayerSkills(three, { ask, rolls: () => 0.99 });
  assert.equal(asks.length, 2);
  // PIN MOVED (GROWTH4, bible/10-UI/Growth.md section 7): the enhanced skin's box sends the player to the Growth tab; the
  // classic skin's to the skill screen, whose S row opens the same guide
  assert.deepEqual(asks[1].rows, ['Specialization', '', '3 specializations are open to you:', 'Riftwalker, Warden, Necromancer', '', 'See them all and choose one on the Growth tab of the pause menu.', 'Resetting it later costs 200,000 gold.']);   // PIN MOVED (SPEC-RESET; AUDIT SPEC-RESET L4-5: the price a row of its own)
  assert.equal(AP.pathsOpenRows([AP.PATH_BY_ID.warden]).at(-2), 'Choose one in your skill screen.', 'the classic skin\'s');
  assert.deepEqual([asks[1].okOnly, asks[1].onYes, three.arcanePath ?? null, three.pathPrompted], [true, null, null, true], 'named, none chosen');
  // one box a pass: a mastery waiting is asked first, the path on the next quiet pass
  const busy = mage([RES, MYS], 100);
  busy.masterSkillsInfoSeen = true;
  busy.skills[ALT] = 100;
  const before = asks.length;
  raisePlayerSkills(busy, { ask, rolls: () => 0.99 });
  assert.equal(asks.length, before + 1);
  assert.match(asks.at(-1).rows.join(' '), /Alteration/, 'the mastery first');
  assert.equal(busy.pathPrompted ?? false, false, 'the path not asked under it');
  raisePlayerSkills(busy, { ask, rolls: () => 0.99 });
  assert.equal(asks.at(-1).rows[0], 'Specialize as Necromancer?', 'the next pass');
});

test('AUDIT SCHOOLS L4 H1 / L5 H3: THE CLASSIC SHEET\'S S ROW - drawn on a skill page with paths open; S asks about the first, No, then S, the next (the plate stays behind the box, so the key the box names reaches it); Yes chooses; a chosen path\'s S shows what it is (mutants: the plate closed under the box; the row never drawn; Yes chooses nothing)', () => {
  const e = mage([ALT, RES, MYS], 100);
  const sheet = new CharSheet(e, {});
  sheet.page = 1;
  const font = { tex: 'font', glyph: () => null, fnt: { fixedHeight: 6, fixedWidth: 4, glyphWidth: () => 4 } };
  const renderer = { uploadTexture: () => 'tex', releaseTexture() {}, drawScreenQuad() {}, drawScreenQuadRun() {} };
  sheet._drawSkillPage(renderer, font, { s: 1, ox: 0, oy: 0 });
  assert.ok(sheet._pathRow, 'the S row is drawn');
  const titles = [];
  for (let i = 0; i < 3; i++) {
    sheet.input('KeyS');
    assert.ok(sheet.child, `S opens a box (${i})`);
    titles.push(sheet.child.rows[0]);
    assert.equal(sheet.child.okOnly, false, 'a Yes/No box');
    assert.equal(sheet.page, 1, 'the plate stays behind the box');
    sheet.input('KeyN');
    assert.equal(sheet.child, null, 'No closes it');
  }
  assert.deepEqual(titles, ['Specialize as Riftwalker?', 'Specialize as Warden?', 'Specialize as Necromancer?'], 'No, then S, for the next');
  sheet.input('KeyS');   // Riftwalker again, round the pool
  sheet.input('KeyS');   // ...the box's own key: nothing
  sheet.input('KeyY');
  assert.equal(e.arcanePath, 'riftwalker', 'Yes chooses');
  sheet.page = 1;
  sheet._drawSkillPage(renderer, font, { s: 1, ox: 0, oy: 0 });
  sheet.input('KeyS');
  assert.deepEqual([sheet.child.okOnly, sheet.child.rows[0], sheet.child.rows.at(-1)], [true, 'Riftwalker - Alteration and Mysticism', 'Its signature spell is sold to you at the Mages Guild.'], 'a chosen path: what it is, in an OK box');
});

test('AUDIT SCHOOLS L4 8 / L5 H3: THE ENHANCED MODEL - each path names its two schools; a chosen one its schools too; a class whose career holds fewer than two schools can never meet one (pathPossible), and its sheet says so by showing nothing (mutants: the schools unnamed; pathPossible always true)', async () => {
  // PIN MOVED (GROWTH2, bible/10-UI/Growth.md section 5): the enhanced model is the Growth tab's guide (ui/growth/specGuide.js)
  const { specGuideModel } = await import('../../src/ui/growth/specGuide.js');
  const fam = (e) => specGuideModel(e).families.find((f) => f.id === 'arcane');
  const m = fam(mage([ALT, RES, MYS], 100));
  assert.deepEqual(m.paths.filter((p) => p.state === 'open').map((p) => [p.id, p.pairText]), [['riftwalker', 'Alteration and Mysticism'], ['warden', 'Alteration and Restoration'], ['necromancer', 'Restoration and Mysticism']]);
  assert.equal(m.possible, true);
  const r = m.paths.find((p) => p.id === 'warden').choose();
  assert.equal(r.ok, true);
  const chosen = fam(pathMage('warden', 100));
  assert.deepEqual([chosen.held.id, chosen.paths[0].state, chosen.paths[0].pairText], ['warden', 'chosen', 'Alteration and Restoration']);
  const warrior = structuredClone(playerEntity);
  createCharacter(warrior, buildCustomCareer({ name: 'Brute', hp: 12, stats: STATS,
    skills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Archery, SKILLS.HandToHand, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Jumping, SKILLS.Dodging, SKILLS.CriticalStrike, DES] }), -1, { rolls: () => 0.5 });
  assert.equal(AP.pathPossible(warrior), false, 'one school in the whole career');
  assert.equal(AP.pathPossible({ career: { primarySkills: [DES], majorSkills: [], minorSkills: [THA] } }), true, 'two, in any groups');
  assert.ok(MAGIC_SKILLS.includes(DES));
});

test('AUDIT SCHOOLS L5 H3: THE ENHANCED PAUSE WINDOW, DRIVEN - its Master Skills door counts the waiting specialisation, the page\'s Specialisation card names each path with its schools, Choose asks in the skin\'s Yes/No card and Yes chooses; a class that can never meet a path sees no card (mutants: the door\'s count; the card gone; Choose chooses nothing)', async () => {
  await import('../chargenDom.mjs');   // the pause window's document - its globals stand for the rest of this file: this test is the last
  const { mountEnhancedMenu } = await import('../../src/ui/enhanced/enhancedMenu.js');
  const kept = { ...playerEntity };
  const restore = () => { for (const k of Object.keys(playerEntity)) if (!(k in kept)) delete playerEntity[k]; Object.assign(playerEntity, kept); };
  try {
    Object.assign(playerEntity, mage([RES, MYS], 100));
    const host = globalThis.document.createElement('div');
    const menu = mountEnhancedMenu(host, { mode: 'pause', hooks: {}, onAction: () => {}, at: 'stats' });
    try {
      // PIN MOVED (GROWTH1/GROWTH2): the Stats page's Growth door counts the path waiting; the guide names it, asks, chooses
      const btn = (text) => host.querySelectorAll('button').find((b) => b.textContent.startsWith(text));
      const door = btn('Growth');
      assert.equal(door?.textContent, 'Growth (1)', 'the door counts the specialisation waiting');
      door.onclick();
      host.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && b.textContent.includes('Specializations')).onclick();   // PIN MOVED (VOICE2): the rail's American spelling
      const bar = host.querySelectorAll('button').find((b) => String(b.className).includes('gr-pathbar') && b.textContent.startsWith('Necromancer'));
      assert.ok(bar, 'the guide\'s Necromancer');
      assert.match(bar.textContent, /Restoration and Mysticism/);
      bar.onclick();
      btn('Choose Necromancer').onclick();
      const ask = globalThis.document.body.querySelectorAll('div').find((d) => String(d.className).includes('px-master-ask'));
      assert.ok(ask, 'the Yes/No card');
      assert.match(ask.textContent, /Specialize as Necromancer\?/);
      ask.querySelectorAll('button').find((b) => b.textContent === 'Yes').onclick();
      assert.equal(playerEntity.arcanePath, 'necromancer', 'Yes chooses');
    } finally { menu.unmount(); }
    restore();
    const brute = structuredClone(playerEntity);
    createCharacter(brute, buildCustomCareer({ name: 'Brute', hp: 12, stats: STATS,
      skills: [SKILLS.LongBlade, SKILLS.Axe, SKILLS.BluntWeapon, SKILLS.Archery, SKILLS.HandToHand, SKILLS.Running, SKILLS.Swimming, SKILLS.Climbing, SKILLS.Jumping, SKILLS.Dodging, SKILLS.CriticalStrike, SKILLS.Medical] }), -1, { rolls: () => 0.5 });
    Object.assign(playerEntity, brute, { _online: true, level: 20 });
    const host2 = globalThis.document.createElement('div');
    const menu2 = mountEnhancedMenu(host2, { mode: 'pause', hooks: {}, onAction: () => {}, at: 'stats' });
    try {
      // PIN MOVED (GROWTH2): the guide says it - no arcane path for a class with no two schools, the Brute's weapons meet the martial
      host2.querySelectorAll('button').find((b) => b.textContent.startsWith('Growth')).onclick();
      host2.querySelectorAll('button').find((b) => String(b.className).includes('px-qrow') && b.textContent.includes('Specializations')).onclick();
      const head = () => host2.querySelectorAll('div').find((d) => String(d.className).includes('gr-headline'))?.textContent ?? '';
      host2.querySelectorAll('button').find((b) => String(b.className).includes('gr-fam') && b.textContent.startsWith('Arcane')).onclick();
      assert.match(head(), /Your class can't master two schools of magic/, 'no arcane path for a class with no two schools');
      host2.querySelectorAll('button').find((b) => String(b.className).includes('gr-fam') && b.textContent.startsWith('Martial')).onclick();
      assert.match(head(), /^Master any two weapon skills to unlock the path for that pair\.$/, 'the Brute\'s weapons meet the martial');   // AUDIT GROWTH LANE5-5: the line says can't, never cannot - the old doesNotMatch could not fail
    } finally { menu2.unmount(); }
  } finally { restore(); }
});
