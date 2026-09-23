// ARREST-SHIELD (2026-09-22, Revverie on Discord: "I think I found a
// bug while playing online, when guards come to arrest you and you go
// to trial, you still can die which happened to me (idk if a guard
// continue to aggro me or if it was a bandit of sorts, no idea). The
// game crashed when that happened - not crashed crashed, just froze
// and I had to kill it").
//
// THE GUARD ARM WAS RIGHT ABOUT THE SITUATION AND TOO NARROW ABOUT THE
// ATTACKER. `arrestFlow.onGuardHit` already withheld a guard's blow
// while a trial is up online, and its own note says why: online the
// court sequence cannot pause the world - WORLD5 makes the clock the
// room's - so the boxes are read STANDING IN THE STREET. But a town's
// foes hunt every player in the cell (WORLD6b-ii), and a bandit is not
// a guard. Neither is a spell, a fall, or drowning.
//
// AND THE FREEZE IS THE SECOND HALF OF THE SAME SENTENCE. Dying inside
// the court sequence puts a death screen and a modal trial on one
// window, each waiting for the other. Revverie's "just froze" is what
// that looks like from the outside. Withholding the blow is what stops
// the two ever meeting - which is also the narrowest fix, because the
// trial is a cutscene the player cannot act during.
import './modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hurtPlayer, registerPlayerDamageVeto, playerDamageWithheld } from '../src/characters/playerEntity.js';

const body = () => ({ health: 50, maxHealth: 50, level: 1, stats: {}, items: [] });
const rd = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('ARREST-SHIELD: the veto withholds EVERY blow, not a guard\'s - including the SetHealth(0) door', () => {
  const e = body();
  registerPlayerDamageVeto(null);
  hurtPlayer(e, 10);
  assert.equal(e.health, 40, 'with no veto a blow lands, as always');

  registerPlayerDamageVeto(() => true);
  assert.equal(playerDamageWithheld(), true);
  // The bandit Revverie suspects.
  assert.equal(hurtPlayer(e, 10), false);
  assert.equal(e.health, 40, 'a bandit\'s blow is withheld');
  // ...and the collapses that do not go through the shield pool at
  // all. Drowning during your own sentencing is exactly as wrong as
  // the bandit was, so the veto sits in FRONT of bypassShield too.
  assert.equal(hurtPlayer(e, 999, { bypassShield: true }), false);
  assert.equal(e.health, 40, 'a SetHealth(0) collapse is withheld as well');

  registerPlayerDamageVeto(null);
  hurtPlayer(e, 10);
  assert.equal(e.health, 30, 'and the veto lets go cleanly');
});

test('ARREST-SHIELD: a blow is WITHHELD, never queued - the trial does not end in a delayed death', () => {
  // onGuardHit's own law, now the whole door's: "every guard swing
  // that landed WHILE the box was up is simply never delivered, not
  // queued for later". A queue would just move the death to the
  // moment the player regains control, which is the same bug wearing
  // a delay.
  const e = body();
  registerPlayerDamageVeto(() => true);
  for (let i = 0; i < 20; i++) hurtPlayer(e, 25);
  assert.equal(e.health, 50, 'twenty killing blows, all withheld');
  registerPlayerDamageVeto(null);
  assert.equal(e.health, 50, 'and nothing lands when the trial ends');
  hurtPlayer(e, 5);
  assert.equal(e.health, 45, 'only what comes after');
});

test('ARREST-SHIELD: a broken veto never costs a blow, and a torn-down flow takes its veto with it', () => {
  // A veto that throws must not take the damage door with it - the
  // door is on every hit in the game.
  const e = body();
  registerPlayerDamageVeto(() => { throw new Error('a dead entity'); });
  assert.equal(playerDamageWithheld(), false, 'a throwing veto reads as "no veto"');
  assert.doesNotThrow(() => hurtPlayer(e, 10));
  assert.equal(e.health, 40, 'and the blow lands rather than being lost');
  registerPlayerDamageVeto(null);

  // A non-function is not a veto either - a host that hands rubbish
  // does not silently make the player immortal.
  registerPlayerDamageVeto('yes');
  assert.equal(playerDamageWithheld(), false);
  hurtPlayer(e, 10);
  assert.equal(e.health, 30);
  registerPlayerDamageVeto(null);
});

test('ARREST-SHIELD by source: ONE predicate answers "am I in a trial", and the guard arm reads it', () => {
  const af = rd('src/scenes/arrestFlow.js');
  // The question is named once. A second copy is a second chance to
  // disagree with the first - which is exactly how the guard arm and
  // the rest of the world came to disagree in the first place.
  assert.match(af, /const inCourt = \(\) => sharedClockOn\(\) && \(awaitingSurrenderAnswer \|\| playerEntity\.arrested\);/);
  assert.match(af, /registerPlayerDamageVeto\(inCourt\);/, 'the one damage door consults the flow that owns the question');
  assert.match(af, /if \(inCourt\(\)\) return true;/, 'and the guard arm reads the SAME predicate, not a copy');
  assert.equal((af.match(/sharedClockOn\(\) && \(awaitingSurrenderAnswer/g) ?? []).length, 1, 'said once');
  // The teardown: a stale closure over a dead entity must never shield
  // a live one.
  assert.match(af, /function dispose\(\) \{ registerPlayerDamageVeto\(null\); \}/);

  // The veto is the FIRST thing the door does - ahead of the shield
  // pool and ahead of the bypassShield branch both.
  const pe = rd('src/characters/playerEntity.js');
  const fn = pe.slice(pe.indexOf('export function hurtPlayer(entity, dmg'));
  const veto = fn.indexOf('playerDamageWithheld()');
  const shield = fn.indexOf('damageShieldPool(entity, dmg)');
  const bypass = fn.indexOf('if (!bypassShield)');
  assert.ok(veto > 0 && veto < bypass && veto < shield, 'the veto is read before the shield pool and before the bypass branch');
});
