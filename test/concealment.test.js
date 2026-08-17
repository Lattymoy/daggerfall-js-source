// S21: the concealment family - Invisibility (13,0/13,1), Shadow
// (24,0/24,1), Chameleon true (23,1) joining the S8 normal. Laws
// verbatim from ConcealmentEffect + DaggerfallEntity +
// EnemySenses.BlockedByIllusionEffect: kinds keyed on the classic
// byte-cast, normal/true powers FOLDING for detection, the start
// message once on NEW incumbency (a stacking re-cast is silent), the
// Illusion duration costs, and the gate wiring end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buffKind, hasActiveEffect, isInvisible, isBlending, isAShade,
  applySpell, tickActiveEffects, CONCEALMENT_START_TEXT,
} from '../src/systems/effects.js';
import { EFFECT_COST_TABLE as SPELL_COST } from '../src/systems/spellcost.js';
import { blockedByIllusionEffect } from '../src/characters/enemyMotor.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
const T = () => ({ stats: { willpower: 50 }, career: {}, health: 30, maxHealth: 40 });

test('concealment: the classic keys land as kinds (byte-cast spellings included)', () => {
  assert.equal(buffKind({ type: 13, subType: 0 }), 'invisNormal');
  assert.equal(buffKind({ type: 13, subType: 1 }), 'invisTrue');
  assert.equal(buffKind({ type: 24, subType: 0 }), 'shadeNormal');
  assert.equal(buffKind({ type: 24, subType: 1 }), 'shadeTrue');
  assert.equal(buffKind({ type: 23, subType: 1 }), 'chameleonTrue');
  assert.equal(buffKind({ type: 23, subType: 0 }), 'chameleonNormal');   // S8, unchanged
  // The Illusion duration costs, verbatim MakeEffectCosts pairs
  assert.deepEqual(SPELL_COST['13,0'].duration, { A: 40, B: 120, offset: 0 });
  assert.deepEqual(SPELL_COST['13,1'].duration, { A: 60, B: 140, offset: 0 });
  assert.deepEqual(SPELL_COST['24,0'].duration, { A: 20, B: 80, offset: 0 });
  assert.deepEqual(SPELL_COST['24,1'].duration, { A: 40, B: 120, offset: 0 });
  assert.deepEqual(SPELL_COST['23,1'].duration, { A: 40, B: 120, offset: 0 });
  for (const k of ['13,0', '13,1', '24,0', '24,1', '23,1']) assert.equal(SPELL_COST[k].skill, 24);   // Illusion
});

test('concealment: IsInvisible/IsBlending/IsAShade fold normal + true powers', () => {
  const en = (kind) => ({ activeEffects: [{ kind, roundsRemaining: 3 }] });
  assert.ok(isInvisible(en('invisNormal')) && isInvisible(en('invisTrue')));
  assert.ok(isBlending(en('chameleonNormal')) && isBlending(en('chameleonTrue')));
  assert.ok(isAShade(en('shadeNormal')) && isAShade(en('shadeTrue')));
  const bare = { activeEffects: [] };
  assert.ok(!isInvisible(bare) && !isBlending(bare) && !isAShade(bare));
  assert.ok(!isInvisible(en('shadeTrue')) && !isAShade(en('invisNormal')));
});

test('concealment: cast lands the buff, says the start line ONCE, stacks silently', () => {
  const invis = { type: 13, subType: 0, durationBase: 3, durationMod: 1, durationPerLevel: 1 };
  const t = T();
  const said = [];
  applySpell({ element: 4, rangeType: 0, effects: [invis] }, 2, t, { say: (l) => said.push(l) }, seq(0));
  assert.ok(hasActiveEffect(t, 'invisNormal'));
  assert.equal(t.activeEffects[0].roundsRemaining, 4);       // 3 + 1*2, round 1 consumed at cast (F17)
  assert.deepEqual(said, ['You are invisible.']);
  // The re-cast STACKS (ConcealmentEffect.AddState) and stays silent:
  // 4 remaining + the full 5-round joining duration (no tick between)
  applySpell({ element: 4, rangeType: 0, effects: [invis] }, 2, t, { say: (l) => said.push(l) }, seq(0));
  assert.equal(t.activeEffects.length, 1);
  assert.equal(t.activeEffects[0].roundsRemaining, 9);
  assert.deepEqual(said, ['You are invisible.']);
  assert.equal(CONCEALMENT_START_TEXT.shadeTrue, 'You are a shade.');
  assert.equal(CONCEALMENT_START_TEXT.chameleonTrue, 'You are blending.');
});

test('concealment: the P13 gate consumes the folded flags end to end', () => {
  const flags = (en) => ({ invisible: isInvisible(en), blending: isBlending(en), shade: isAShade(en) });
  const en = (kind) => ({ activeEffects: [{ kind, roundsRemaining: 3 }] });
  const never = () => { throw new Error('rolled for an invisible/unconcealed target'); };
  // Invisible: always blocked, NO roll; the 13 seers exempt.
  assert.equal(blockedByIllusionEffect(false, flags(en('invisTrue')), never), true);
  assert.equal(blockedByIllusionEffect(true, flags(en('invisTrue')), never), false);
  // Shade: the 4% see-through - a 0.9 roll (90 >= 4) stays blocked,
  // a 0.01 roll (1 < 4) sees through.
  assert.equal(blockedByIllusionEffect(false, flags(en('shadeNormal')), () => 0.9), true);
  assert.equal(blockedByIllusionEffect(false, flags(en('shadeNormal')), () => 0.01), false);
  // Blending true rides the same 8% branch as the S8 normal.
  assert.equal(blockedByIllusionEffect(false, flags(en('chameleonTrue')), () => 0.9), true);
  // Unconcealed: no roll, not blocked.
  assert.equal(blockedByIllusionEffect(false, flags({ activeEffects: [] }), never), false);
  // Expiry lifts it: 4 rounds then gone -> the gate opens.
  const t = T();
  applySpell({ element: 4, rangeType: 0, effects: [{ type: 24, subType: 1, durationBase: 3, durationMod: 1, durationPerLevel: 1 }] }, 2, t, {}, seq(0));
  assert.ok(isAShade(t));
  for (let i = 0; i < 5; i++) tickActiveEffects(t, {});
  assert.ok(!isAShade(t));
  assert.equal(blockedByIllusionEffect(false, flags(t), never), false);
});
