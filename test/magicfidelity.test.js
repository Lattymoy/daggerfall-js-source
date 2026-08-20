// L2-slice (AUDIT 23 magic-3/8/9/10/11/12): the magic-fidelity laws.
// The buff family's landing gates, the trap CastSpell arms, the
// manager-level paralysis immunity, the Magic save element for the
// magic-only families, and Transfer-onto-Drain incumbency.
// (magic-7's aim-directed touch cast is pinned in spellcast.test.js.)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySpell, isEntityImmuneToParalysis, hasActiveEffect } from '../src/systems/effects.js';
import { EFFECT_FLAGS } from '../src/systems/spellcast.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
const mkTarget = (extra = {}) => ({ stats: { willpower: 0 }, career: {}, ...extra });
const silence = (chanceBase) => ({ type: 19, subType: 255, durationBase: 5, durationMod: 0, durationPerLevel: 1, chanceBase, chanceMod: 0, chancePerLevel: 1 });
const invis = () => ({ type: 13, subType: 0, durationBase: 5, durationMod: 0, durationPerLevel: 1 });

test('magicfidelity magic-3: the buff landing gates - silence chance, the full save, the stack quirk', () => {
  // a CasterOnly silence with a failed chance: message, nothing lands
  const t1 = mkTarget();
  const r1 = applySpell({ rangeType: 0, element: 4, effects: [silence(10)] }, 1, t1, {}, seq(0.99));
  assert.equal(r1.chanceFailed, 1, 'the OnCast chance gate rolls for Silence');
  assert.ok(!hasActiveEffect(t1, 'silenced'));
  // the chance passes on a CasterOnly cast: lands with NO save roll
  const t2 = mkTarget();
  applySpell({ rangeType: 0, element: 4, effects: [silence(90)] }, 1, t2, {}, seq(0.1));
  assert.ok(hasActiveEffect(t2, 'silenced'), 'self-casts never save');
  // an EXTERNAL silence against a magic-immune career: the full save
  // eats the ENTIRE effect (no magnitude to scale)
  const t3 = mkTarget({ career: { immunityFlags: EFFECT_FLAGS.Magic } });
  const r3 = applySpell({ rangeType: 2, element: 4, effects: [silence(90)] }, 1, t3, {}, seq(0.1));
  assert.equal(r3.saved, 1, 'the no-magnitude full save (EntityEffectManager :560-579)');
  assert.ok(!hasActiveEffect(t3, 'silenced'));
  // the AddState quirk: an incumbent re-cast stacks its rounds INSIDE
  // Start, BEFORE the chance gate - the fail message still fires
  const t4 = mkTarget();
  applySpell({ rangeType: 0, element: 4, effects: [silence(90)] }, 1, t4, {}, seq(0.1));
  const rounds0 = t4.activeEffects.find((a) => a.kind === 'silenced').roundsRemaining;
  const r4 = applySpell({ rangeType: 0, element: 4, effects: [silence(10)] }, 1, t4, {}, seq(0.99));
  assert.equal(r4.chanceFailed, 1);
  assert.equal(t4.activeEffects.find((a) => a.kind === 'silenced').roundsRemaining, rounds0 + 5,
    'the stack landed before the failed chance (verbatim gate order)');
  // concealments carry NO chance - a terrible roll cannot fail them
  const t5 = mkTarget();
  applySpell({ rangeType: 0, element: 4, effects: [invis()] }, 1, t5, { }, seq(0.999));
  assert.ok(hasActiveEffect(t5, 'invisNormal'), 'only Silence supports chance among the buffs');
});

test('magicfidelity magic-11: the magic-only families SAVE AS MAGIC, whatever the spell element', () => {
  // a FIRE-element hostile spell carrying a concealment: the target
  // immune to MAGIC saves it in full (GetElementType returns Magic
  // for magic-only effects)...
  const t1 = mkTarget({ career: { immunityFlags: EFFECT_FLAGS.Magic } });
  const r1 = applySpell({ rangeType: 2, element: 0, effects: [invis()] }, 1, t1, {}, seq(0.1));
  assert.equal(r1.saved, 1, 'the concealment saved as MAGIC inside a fire spell');
  // ...while a FIRE immunity does NOT cover it (the element the save
  // reads is the effect's, not the bundle's)
  const t2 = mkTarget({ career: { immunityFlags: EFFECT_FLAGS.Fire } });
  applySpell({ rangeType: 2, element: 0, effects: [invis()] }, 1, t2, {}, seq(0.999));
  assert.ok(hasActiveEffect(t2, 'invisNormal'), 'fire immunity is blind to a Magic-element save');
});

test('magicfidelity magic-10: the manager paralysis gate - career, racial, the override, the flag', () => {
  // career Immune -> hard immune
  assert.equal(isEntityImmuneToParalysis({ career: { immunityFlags: EFFECT_FLAGS.Paralysis } }), true);
  // the DFCareer.GetTolerance precedence quirk: Resistant reads FIRST,
  // so a career flagged Resistant+Immune is merely Resistant here
  assert.equal(isEntityImmuneToParalysis({ career: { resistanceFlags: EFFECT_FLAGS.Paralysis, immunityFlags: EFFECT_FLAGS.Paralysis } }), false);
  // the PLAYER's racial bit (High Elf) -> immune...
  assert.equal(isEntityImmuneToParalysis({ isPlayer: true, race: 'HighElf', career: {} }), true);
  // ...unless the career overrides with LowTolerance/CriticalWeakness
  assert.equal(isEntityImmuneToParalysis({ isPlayer: true, race: 'HighElf', career: { lowToleranceFlags: EFFECT_FLAGS.Paralysis } }), false);
  // a NON-player never reads the racial arm
  assert.equal(isEntityImmuneToParalysis({ race: 'HighElf', career: {} }), false);
  // the FreeAction effect flag still counts
  assert.equal(isEntityImmuneToParalysis({ career: {}, activeEffects: [{ kind: 'freeAction', roundsRemaining: 3 }] }), true);
  // ...and the assign gate consumes it: an incoming Paralyze on a
  // career-immune target is dropped SILENTLY (no message channels)
  const t = mkTarget({ career: { immunityFlags: EFFECT_FLAGS.Paralysis } });
  const r = applySpell({ rangeType: 2, element: 4, effects: [{ type: 0, subType: 255, durationBase: 5, durationMod: 0, durationPerLevel: 1, chanceBase: 100, chanceMod: 0, chancePerLevel: 1 }] }, 1, t, {}, seq(0.1));
  assert.ok(!hasActiveEffect(t, 'paralyze'));
  assert.ok(!r.chanceFailed && !r.saved, 'dropped before Start - no chance, no save, no message');
});

test('magicfidelity magic-12: a DRAIN incumbent claims an incoming TRANSFER - never the reverse', () => {
  const drain = { type: 7, subType: 0, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  const transfer = { type: 11, subType: 0, magnitudeBaseLow: 3, magnitudeBaseHigh: 3, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 };
  // drain first, then transfer: ONE entry (the drain claims it), the
  // magnitudes sum, and the caster's heal-back still fires
  const t1 = mkTarget({ stats: { willpower: 0, strength: 50 } });
  const caster = { entity: { stats: { strength: 40 }, activeEffects: [{ kind: 'drainAttribute', stat: 'strength', magnitude: 10, permanent: true }] }, sinks: {} };
  applySpell({ rangeType: 0, element: 4, effects: [drain] }, 1, t1, {}, seq(0), null);
  applySpell({ rangeType: 0, element: 4, effects: [transfer] }, 1, t1, {}, seq(0), caster);
  const entries1 = t1.activeEffects.filter((a) => a.stat === 'strength');
  assert.equal(entries1.length, 1, 'the transfer joined the drain incumbent');
  assert.equal(entries1[0].kind, 'drainAttribute', 'the claimed entry keeps its own kind');
  assert.equal(entries1[0].magnitude, 8, '5 + 3 stacked');
  assert.equal(caster.entity.activeEffects[0].magnitude, 7, 'the caster healed 3 of its own drain');
  // transfer first, then drain: TWO entries (a Transfer incumbent
  // never claims a plain Drain - its like-kind needs a TransferEffect)
  const t2 = mkTarget({ stats: { willpower: 0, strength: 50 } });
  applySpell({ rangeType: 0, element: 4, effects: [transfer] }, 1, t2, {}, seq(0), null);
  applySpell({ rangeType: 0, element: 4, effects: [drain] }, 1, t2, {}, seq(0), null);
  const entries2 = t2.activeEffects.filter((a) => a.stat === 'strength');
  assert.equal(entries2.length, 2, 'the drain minted its own incumbent beside the transfer');
  assert.deepEqual(entries2.map((a) => a.kind).sort(), ['drainAttribute', 'transferAttribute']);
});

test('magicfidelity magic-8/9: the trap arms and the enemy AoC wiring', () => {
  const dc = readFileSync(join(root, 'src/scenes/dungeonContext.js'), 'utf8');
  const i = dc.indexOf('function fireCast');
  const fn = dc.slice(i, i + 1400);
  assert.ok(fn.includes("magic.readySpell(spell, { free: true })"), 'a CasterOnly trap readies FREE on the player (:497-502)');
  assert.ok(fn.includes('trap AreaAroundCaster has no caster'), 'the casterless AoC no-op is loud');
  assert.ok(fn.includes('{ ...spell, rangeType: 2 }'), 'a ByTouch trap payload retargets to SingleTargetAtRange (:512-517)');
  // X3: the executor is SHARED - the AoC law lives in enemyCasting.js
  const ec = readFileSync(join(root, 'src/characters/enemyCasting.js'), 'utf8');
  assert.ok(ec.includes('spell.rangeType === 3') && ec.includes('excludeFoe: f'),
    'an enemy AoC explodes AT THE CASTER instantly, excluding the caster (DoAreaOfEffect ignoreCaster)');
  assert.ok(dc.includes('castEnemySpell: castShared'), 'the dungeon binds the ONE executor');
  const hm = readFileSync(join(root, 'src/scenes/hostMagic.js'), 'utf8');
  assert.ok(hm.includes('let readiedFree = false;'), 'the engine carries readySpellDoesNotCostSpellPoints');
  assert.ok(hm.includes('!readiedFree && silenceBlocksCast'), 'a free ready bypasses the cast silence gate (:404)');
  assert.ok(hm.includes('readiedFree ? 0 : calculateCastCost'), 'and spends nothing');
  assert.ok(hm.includes('excludeFoe && t === excludeFoe'), 'explodeAt honors the caster exclusion');
});
