// X1: THE EFFECT LIBRARY'S MISSING ARMS - the effects the spell maker
// could sell but the runtime could not honour. Each slice moves rows
// out of spellEffects.js's inert set, so the maker's "(no effect
// yet)" marks disappear as the arms land.

import { test } from 'node:test';
import assert from 'node:assert/strict';
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
