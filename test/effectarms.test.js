// X1: THE EFFECT LIBRARY'S MISSING ARMS - the effects the spell maker
// could sell but the runtime could not honour. Each slice moves rows
// out of spellEffects.js's inert set, so the maker's "(no effect
// yet)" marks disappear as the arms land.

import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
import { applySpell } from '../src/systems/effects.js';
import { jumpSpeedMultiplier, JUMP_SPELL_MULTIPLIER } from '../src/systems/skills.js';
import { climbingDeps } from '../src/scenes/shared.js';
import { buildCustomSpell, blankEffectSettings } from '../src/systems/spellMaker.js';
import { effectByKey } from '../src/systems/spellEffects.js';

const entity = () => ({
  stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [],
  race: 'Breton', level: 1, health: 20, maxHealth: 20,
});
const castSelf = (ent, type, subType = 255, settings = {}) => applySpell(
  buildCustomSpell({ slots: [{ type, subType, settings: { ...blankEffectSettings(), durationBase: 10, ...settings } }], rangeType: 0 }),
  1, ent, {}, () => 0.5, null, {});

test('X1 Jumping: the spell adds AcrobatMotor\'s +0.6, on top of the skill term', () => {
  const e = entity();
  assert.equal(JUMP_SPELL_MULTIPLIER, 0.6, 'jumpSpellMultiplier (AcrobatMotor.cs:16)');
  const base = jumpSpeedMultiplier(e);
  assert.equal(base, 1, 'a skill-less Breton jumps at 1.0');
  const out = castSelf(e, 27);
  assert.equal(out.skipped, 0, 'the library honours it now');
  assert.equal(out.buffs, 1);
  assert.deepEqual(e.activeEffects.map((a) => a.kind), ['jumping']);
  assert.equal(jumpSpeedMultiplier(e), base + 0.6, 'IsEnhancedJumping adds the spell term (:104-105)');
  // and it leaves when the effect does
  e.activeEffects.length = 0;
  assert.equal(jumpSpeedMultiplier(e), base, 'End() clears it');
});

test('X1 Climbing: the spell doubles the effective skill, through the seam that was hardcoded false', () => {
  const e = entity();
  assert.equal(climbingDeps(e).inputs().enhanced, false);
  const out = castSelf(e, 28);
  assert.equal(out.skipped, 0);
  assert.deepEqual(e.activeEffects.map((a) => a.kind), ['climbing']);
  assert.equal(climbingDeps(e).inputs().enhanced, true,
    'FormulaHelper.cs:304-306 doubles the skill; climbing.js reads `enhanced`');
  e.activeEffects.length = 0;
  assert.equal(climbingDeps(e).inputs().enhanced, false);
});

test('X1 both buffs stack their rounds like every other incumbent, and the catalog marks them live', () => {
  const e = entity();
  castSelf(e, 27);
  const first = e.activeEffects[0].roundsRemaining;
  castSelf(e, 27);
  assert.equal(e.activeEffects.length, 1, 'one incumbent, not two');
  assert.ok(e.activeEffects[0].roundsRemaining > first, 'a recast STACKS the rounds (the port\'s incumbent law)');
  // the spell maker no longer warns about these two
  assert.equal(effectByKey('27,255').ported, true);
  assert.equal(effectByKey('28,255').ported, true);
});

// ── X1b: Open and Lock ────────────────────────────────────────────
import { doorSpellFor, consumeDoorSpell, wireDoorSpells } from '../src/scenes/shared.js';
import { triggerOpen, triggerLock, DOOR_SPELL_TEXT } from '../src/systems/mysticism.js';

const castTouch = (ent, type, level = 5) => applySpell(
  buildCustomSpell({ slots: [{ type, subType: 255, settings: { ...blankEffectSettings(), chanceBase: 100 } }], rangeType: 1 }),
  level, ent, {}, () => 0.0, null, {});
const door = (lock = 0, state = 'start') => ({ kind: 'door', currentLockValue: lock, state });

test('X1 Open/Lock: the cast ARMS and waits - DFU never acts at cast time', () => {
  const e = entity();
  const out = castTouch(e, 17);
  assert.equal(out.skipped, 0, 'the library honours Open now');
  assert.equal(out.armed, 'openArmed');
  // forcedRoundsRemaining = 1 with RemoveRound undecremented: the entry
  // must NOT expire on its own - only the door (or a recast) ends it
  assert.equal(e.activeEffects[0].permanent, true);
  assert.deepEqual(doorSpellFor(e), { kind: 'open', casterLevel: 5, skeletonKey: false });
  // Lock arms its own marker
  const e2 = entity();
  assert.equal(castTouch(e2, 16).armed, 'lockArmed');
  assert.equal(doorSpellFor(e2).kind, 'lock');
  // nothing armed = nothing to hand the door
  assert.equal(doorSpellFor(entity()), null);
});

test('X1 Open: the lock yields only to a caster whose LEVEL reaches it (Open.cs:118-121)', () => {
  const weak = door(9);
  assert.deepEqual(triggerOpen(weak, 5), { unlocked: false, opened: false, alert: 'openFailed' });
  assert.equal(weak.currentLockValue, 9, 'a lock too powerful is untouched');
  const yields = door(3);
  const r = triggerOpen(yields, 5);
  assert.equal(r.unlocked, true);
  assert.equal(yields.currentLockValue, 0);
  assert.equal(r.opened, true, 'an unlocked, closed door swings');
  // the level test is <=, so an exactly-matching lock yields
  const exact = door(5);
  assert.equal(triggerOpen(exact, 5).unlocked, true);
  // the Skeleton's Key ignores the level rule entirely
  const artifact = door(99);
  assert.equal(triggerOpen(artifact, 1, { castBySkeletonKey: true }).unlocked, true);
  // an already-open door is not re-opened
  assert.equal(triggerOpen(door(0, 'end'), 5).opened, false);
});

test('X1 Lock: no level test, locks to the CASTER\'s level, refuses an already-locked door (Lock.cs:116)', () => {
  const open = door(0);
  assert.deepEqual(triggerLock(open, 7), { locked: true, closed: false, alert: 'doorLocked' });
  assert.equal(open.currentLockValue, 7, 'the caster\'s own level becomes the lock');
  const already = door(4);
  assert.deepEqual(triggerLock(already, 9), { locked: false, closed: false, alert: 'doorAlreadyLocked' });
  assert.equal(already.currentLockValue, 4, 'refused, not re-locked harder');
  // a standing-open door is swung shut
  assert.equal(triggerLock(door(0, 'end'), 3).closed, true);
});

test('X1 door spells: the armed effect is CONSUMED by the door, spent whether or not the lock gave', () => {
  const e = entity();
  castTouch(e, 17);
  const said = [];
  const actions = { onDoorSpell: null, toggleDoor: () => {} };
  wireDoorSpells(actions, e, (t) => said.push(t));
  // a lock too powerful still spends the cast
  actions.onDoorSpell(door(99), 'open', triggerOpen(door(99), 5));
  assert.deepEqual(said, [DOOR_SPELL_TEXT.openFailed]);
  assert.equal(doorSpellFor(e), null, 'CancelEffect on trigger - the cast is spent');
  // and consuming what was never armed is harmless
  consumeDoorSpell(entity(), 'lock');
});

test('X1 door spells: a failed chance roll wastes the cast and arms nothing', () => {
  const e = entity();
  const out = applySpell(
    buildCustomSpell({ slots: [{ type: 17, subType: 255, settings: { ...blankEffectSettings(), chanceBase: 1 } }], rangeType: 1 }),
    1, e, {}, () => 0.99, null, {});
  assert.equal(out.chanceFailed, 1);
  assert.equal(out.armed, undefined);
  assert.equal(doorSpellFor(e), null);
  // the catalog now lists both as live
  assert.equal(effectByKey('16,255').ported, true);
  assert.equal(effectByKey('17,255').ported, true);
});

// ── X1c: the magic defences ───────────────────────────────────────
import { elementalResistanceChance, savingThrow } from '../src/systems/spellcast.js';
import { spellAbsorptionChance, effectCastingCost } from '../src/systems/absorption.js';
import { spellResistanceChance } from '../src/systems/effects.js';

// a NORD - Bretons carry racial magic resistance, which would mask
// every defence test behind a saving throw of its own
const target = (over = {}) => ({
  stats: { luck: 50, willpower: 50 }, skills: [], activeEffects: [], race: 'Nord',
  level: 1, health: 50, maxHealth: 50, magicka: 0, maxMagicka: 300, ...over,
});
const grant = (ent, type, chance = 100) => applySpell(
  buildCustomSpell({ slots: [{ type, subType: 255, settings: { ...blankEffectSettings(), durationBase: 10, chanceBase: chance } }], rangeType: 0 }),
  1, ent, {}, () => 0.5, null, {});
const incoming = (ent, rangeType = 2, mag = 10) => applySpell(
  buildCustomSpell({ slots: [{ type: 4, subType: 0, settings: { ...blankEffectSettings(), magnitudeBaseLow: mag, magnitudeBaseHigh: mag } }], rangeType }),
  5, ent, {}, () => 0.5, { level: 5 }, {});

test('X1 Elemental Resistance: a successful roll drops the effect WHOLE, per element, stacking additively', () => {
  const e = target();
  const out = applySpell(
    buildCustomSpell({ slots: [{ type: 8, subType: 0, settings: { ...blankEffectSettings(), durationBase: 10, chanceBase: 100 } }], rangeType: 0 }),
    1, e, {}, () => 0.5, null, {});
  assert.equal(out.skipped, 0);
  assert.equal(e.activeEffects[0].element, 0, 'the subType IS the element');
  assert.ok(elementalResistanceChance(e, 0) >= 100);
  assert.equal(elementalResistanceChance(e, 1), 0, 'resisting Fire is not resisting Frost');
  // the saving throw returns 0 - resisted whole, not scaled - and only
  // for the element resisted. A roll that would NOT save normally.
  assert.equal(savingThrow(0, 8, e, 0, () => 0.99), 0, 'Fire is resisted outright');
  assert.equal(savingThrow(1, 16, e, 0, () => 0.99), 100, 'Frost lands in full');
  // a like-kind recast (SAME element) merges: AddState stacks ROUNDS
  // onto the incumbent and touches nothing else, so the incumbent
  // keeps its OWN chance (ElementalResistance.cs:148-157)
  const s = target();
  const half = buildCustomSpell({ slots: [{ type: 8, subType: 3, settings: { ...blankEffectSettings(), durationBase: 5, chanceBase: 30 } }], rangeType: 0 });
  applySpell(half, 1, s, {}, () => 0.5, null, {});
  const chance1 = elementalResistanceChance(s, 3);
  const rounds1 = s.activeEffects[0].roundsRemaining;
  applySpell(half, 1, s, {}, () => 0.5, null, {});
  assert.equal(s.activeEffects.length, 1, 'like-kind merges into one incumbent');
  assert.ok(s.activeEffects[0].roundsRemaining > rounds1, 'rounds STACK');
  assert.equal(elementalResistanceChance(s, 3), chance1, 'the chance is the incumbent\'s, unchanged');
  // a DIFFERENT element is not like-kind - its own instance
  applySpell(buildCustomSpell({ slots: [{ type: 8, subType: 1, settings: { ...blankEffectSettings(), durationBase: 5, chanceBase: 30 } }], rangeType: 0 }), 1, s, {}, () => 0.5, null, {});
  assert.equal(s.activeEffects.length, 2);
});

test('X1 Spell Absorption: the effect arm swallows the spell and credits its cost as magicka', () => {
  const e = target();
  grant(e, 20);
  assert.ok(spellAbsorptionChance(e) >= 100);
  const cost = effectCastingCost(
    buildCustomSpell({ slots: [{ type: 4, subType: 0, settings: { ...blankEffectSettings(), magnitudeBaseLow: 10, magnitudeBaseHigh: 10 } }] }).effects[0], 2, e);
  const out = incoming(e);
  assert.equal(out.absorbed, cost, 'the points absorbed ARE the recomputed casting cost');
  assert.equal(out.damage, 0, 'and the effect never lands');
  assert.equal(e.magicka, cost, 'credited to the target');
  // without it the same spell hurts
  assert.ok(incoming(target()).damage > 0);
});

test('X1 Spell Absorption: all-or-nothing - no room for the whole cost means no absorption at all', () => {
  // DFU refuses a PARTIAL absorb (EEM:1180-1182): if the cost exceeds
  // the free magicka the effect passes through untouched.
  const e = target({ magicka: 295, maxMagicka: 300 });
  grant(e, 20);
  const out = incoming(e);
  assert.equal(out.absorbed, undefined, 'nothing absorbed');
  assert.ok(out.damage > 0, 'the spell lands in full');
  assert.equal(e.magicka, 295, 'and no magicka was gained');
});

test('X1 Spell Resistance: the effect is silently DROPPED, and a self-cast is never resisted', () => {
  const e = target();
  grant(e, 22);
  assert.ok(spellResistanceChance(e) >= 100);
  const out = incoming(e, 2);
  assert.equal(out.resisted, 1);
  assert.equal(out.damage, 0, 'dropped, not reduced');
  assert.equal(out.absorbed, undefined, 'resistance grants no magicka');
  assert.equal(e.magicka, 0);
  // TargetTypes.CasterOnly is never resisted (:1256) - your own buff
  // cannot be refused by your own resistance
  assert.ok(incoming(e, 0).damage > 0, 'a self-cast lands');
  // the catalog marks all seven live; Reflection still pends
  for (const k of ['8,0', '8,1', '8,2', '8,3', '8,4', '20,255', '22,255']) {
    assert.equal(effectByKey(k).ported, true, `${k} is live`);
  }
  assert.equal(effectByKey('21,255').ported, false, 'Spell Reflection still pends its re-target path');
});

// ── X1d: Shield's damage pool ─────────────────────────────────────
import { hurtPlayer, damageShieldPool } from '../src/characters/playerEntity.js';

const shieldSpell = (mag) => buildCustomSpell({
  slots: [{ type: 35, subType: 255, settings: { ...blankEffectSettings(), durationBase: 10, magnitudeBaseLow: mag, magnitudeBaseHigh: mag } }],
  rangeType: 0,
});
const shielded = (mag = 20) => {
  const e = target({ health: 100, maxHealth: 100 });
  applySpell(shieldSpell(mag), 1, e, {}, () => 0.5, null, {});
  return [e, e.activeEffects.find((a) => a.kind === 'shield')];
};

test('X1 Shield: all-or-overflow per hit - the magnitude IS the pool, one point per hit point', () => {
  const [e, a] = shielded();
  assert.equal(a.shieldRemaining, a.startingShield, 'the pool opens full');
  const pool = a.shieldRemaining;
  // a hit no larger than the pool is reduced to ZERO
  hurtPlayer(e, pool - 5);
  assert.equal(e.health, 100, 'fully absorbed - no health lost');
  assert.equal(a.shieldRemaining, 5);
  // the hit that empties it passes ONLY its excess
  hurtPlayer(e, 25);
  assert.equal(e.health, 80, 'the 5-point pool ate 5 of the 25');
  assert.equal(a.shieldRemaining, 0);
  assert.equal(a.ended, true, 'running out ends the effect at once');
  // a busted pool absorbs nothing further
  hurtPlayer(e, 10);
  assert.equal(e.health, 70);
});

test('X1 Shield: exactly zeroing the pool still BUSTS it, and passes zero through', () => {
  const [e, a] = shielded();
  hurtPlayer(e, a.startingShield);
  assert.equal(e.health, 100, 'nothing got through');
  assert.equal(a.ended, true, 'but the shield is spent');
  assert.equal(a.shieldRemaining, 0);
});

test('X1 Shield: a recast tops the pool up, capped at the ORIGINAL starting pool', () => {
  const [e, a] = shielded();
  const start = a.startingShield;
  hurtPlayer(e, 5);
  assert.equal(a.shieldRemaining, start - 5);
  const rounds = a.roundsRemaining;
  applySpell(shieldSpell(20), 1, e, {}, () => 0.5, null, {});
  assert.equal(e.activeEffects.filter((x) => x.kind === 'shield').length, 1, 'one incumbent');
  assert.equal(a.shieldRemaining, start, 'topped up to the cap, never above');
  assert.equal(a.startingShield, start, 'and startingShield itself never rises');
  assert.ok(a.roundsRemaining > rounds, 'rounds stack');
});

test('X1 Shield: the pool sits on the ONE damage door, so every source is covered', () => {
  // damageShieldPool is the primitive hurtPlayer calls; anything that
  // reaches the player's health goes through it
  const [, a] = shielded();
  assert.equal(damageShieldPool({ activeEffects: [a] }, 3), 0, 'absorbed');
  assert.equal(damageShieldPool({ activeEffects: [] }, 7), 7, 'no shield: damage passes unchanged');
  // and hurtPlayer really routes through it: a shielded entity takes
  // no health loss from a hit the pool covers, whatever the source
  const [e2, a2] = shielded();
  const before = e2.health;
  assert.equal(hurtPlayer(e2, a2.shieldRemaining - 1), false, 'no death transition');
  assert.equal(e2.health, before, 'the one door consulted the pool');
  assert.equal(effectByKey('35,255').ported, true);
});

test('X1 REVIEW: a busted Shield resigns - a recast makes a NEW live pool, and the corpse stays dead', () => {
  // The review's P0/P1, found by two reviewers independently: findInc
  // matched the busted entry, so a recast refilled a pool that
  // damageShieldPool skips (ended) while pushing rounds back above 0
  // so the ticker never swept it. Shield stopped absorbing for good
  // after its first bust, and every later cast fed the corpse.
  const [e, dead] = shielded();
  hurtPlayer(e, dead.startingShield + 5);
  assert.equal(dead.ended, true);
  applySpell(shieldSpell(20), 1, e, {}, () => 0.5, null, {});
  const live = e.activeEffects.filter((a) => a.kind === 'shield' && !a.ended);
  assert.equal(live.length, 1, 'the recast is its own live incumbent');
  assert.notEqual(live[0], dead);
  assert.equal(dead.roundsRemaining, 0, 'the corpse was never revived');
  // and the fresh pool really absorbs
  const h = e.health;
  hurtPlayer(e, 10);
  assert.equal(e.health, h, 'the new shield works');
});

test('X1 REVIEW: SetHealth(0) bypasses the shield - drowning and the collapse still kill', () => {
  // DFU's drowning and lethal exhaustion SET health to zero rather
  // than dealing damage, so no pool stands between them and the
  // player. The port routes them through the one damage door (so the
  // death presenter fires once), which made a Shield survive them.
  const [e] = shielded();
  hurtPlayer(e, e.health, { bypassShield: true });
  assert.equal(e.health, 0, 'the collapse is not absorbable');
  // and the ordinary door still shields
  const [e2, a2] = shielded();
  hurtPlayer(e2, 5);
  assert.equal(e2.health, 100);
  assert.ok(a2.shieldRemaining < a2.startingShield);
});

test('X1 REVIEW: the four SetHealth(0) callers all say bypassShield, and dungeon drowning passes its ENTITY', () => {
  // The dungeon drown call had lost its entity argument entirely -
  // health went in as `entity`, damage was undefined, and the guard
  // at the top of hurtPlayer returned at once: dungeon drowning never
  // dealt a point. Pre-dates X1; found reviewing the shield's door.
  const rd = (p) => readFileSync(join(ROOT, p), 'utf8');
  for (const p of ['src/scenes/worldModes.js', 'src/scenes/world.js', 'src/scenes/exterior.js', 'src/scenes/dungeonContext.js']) {
    assert.match(rd(p), /hurtPlayer\(playerEntity, playerEntity\.health, \{ bypassShield: true \}\)/, `${p} kills rather than damages`);
  }
  assert.doesNotMatch(rd('src/scenes/dungeonContext.js'), /hurtPlayer\(playerEntity\.health\)/, 'the entity-less call is gone');
});
