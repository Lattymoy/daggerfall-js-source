// AUDIT 24, wave 32: one broker, many subscribers - the exterior foe pools
// were not subscribed to anything.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  claimMagicRounds, runMagicRoundsFor, tickPlayerMinutes, resetMagicRoundMarker,
  setWorldMinutes, worldMinutes, MAX_CATCHUP_ROUNDS, CLASSIC_MINUTES_PER_SECOND,
} from '../src/systems/worldTick.js';
import { createPlayerTicker, subscribeFoePools } from '../src/scenes/shared.js';
import { STAT_KEYS_ORDER } from '../src/systems/statMods.js';

const rd = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');
const bleed = (rounds) => ({
  kind: 'continuousDamage', roundsRemaining: rounds, casterLevel: 1, saveScaled: false,
  effect: { magnitudeBaseLow: 1, magnitudeBaseHigh: 1, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 },
});
const sinksFor = (e) => ({
  hurt: (n) => { e.health -= n; }, heal: () => {},
  drainMagicka: () => {}, restoreMagicka: () => {},
  drainFatigue: () => {}, restoreFatigue: () => {}, say: () => {},
});

test('audit24 wave32: the marker is CLAIMED once and the window serves every subscriber', () => {
  // EntityEffectBroker.Update advances its lastGameMinute once and then raises
  // one event per elapsed minute; every EntityEffectManager in the scene
  // handles all of them. A per-entity function that also owned the marker
  // could only ever serve its FIRST caller.
  resetMagicRoundMarker(1000);
  const w = claimMagicRounds(1000, 1030);
  assert.deepEqual(w, { from: 1000, to: 1030, rounds: 30 });
  assert.deepEqual(claimMagicRounds(1030, 1030), { from: 1030, to: 1030, rounds: 0 },
    'the second claim in the same frame gets nothing - the marker moved');

  // and running the window is marker-free, so N subscribers each get all 30
  const a = { health: 500, maxHealth: 500, level: 1, skills: {}, activeEffects: [bleed(90)] };
  const b = { health: 500, maxHealth: 500, level: 1, skills: {}, activeEffects: [bleed(90)] };
  assert.equal(runMagicRoundsFor(a, w.from, w.to, { sinks: sinksFor(a) }), 30);
  assert.equal(runMagicRoundsFor(b, w.from, w.to, { sinks: sinksFor(b) }), 30);
  assert.equal(a.activeEffects[0].roundsRemaining, 60);
  assert.equal(b.activeEffects[0].roundsRemaining, 60, 'the SECOND subscriber got the same 30 rounds');
  assert.equal(a.health, 470);
  assert.equal(b.health, 470);

  // the cap and the half-open window are the broker's, and stay on the claim
  resetMagicRoundMarker(0);
  assert.equal(claimMagicRounds(0, 30240).rounds, MAX_CATCHUP_ROUNDS);
  resetMagicRoundMarker(100);
  assert.equal(claimMagicRounds(100, 100.99).rounds, 0, 'a partial minute is no round');
  assert.equal(runMagicRoundsFor(a, 5, 5, { sinks: sinksFor(a) }), 0, 'an empty window runs nothing');
  assert.equal(runMagicRoundsFor(null, 0, 10, { sinks: {} }), 0, 'and a missing entity is a no-op');

  // AN EQUIVALENT MUTANT, recorded rather than dressed up as a kill: making
  // runMagicRoundsFor ALSO advance the marker (to `to + 1`) survives every pin
  // here and in the suite, and it is genuinely unobservable. The load
  // re-anchor is why - the next claim's `fromMinute` is the clock before that
  // frame's step, which can never exceed the previous claim's `to`, so an
  // overshot marker always satisfies `here < _lastMagicRoundMinute` and is
  // re-anchored back to the truth before it can skip a round. The split still
  // matters for reasons a test cannot reach: a subscriber that owns the marker
  // is a subscriber that only works when it is called first.
});

test('audit24 wave32: the tick hands its claimed window back, and the ticker fans it out', () => {
  const player = { health: 500, maxHealth: 500, level: 1, skills: {}, stats: {}, activeEffects: [bleed(90)] };
  setWorldMinutes(2000);
  resetMagicRoundMarker(2000);
  const r = tickPlayerMinutes({
    entity: player, classicMinutes: 2000, dt: 10 / CLASSIC_MINUTES_PER_SECOND, sinks: sinksFor(player),
  });
  assert.deepEqual(r.magicRoundWindow, { from: 2000, to: 2010, rounds: 10 }, 'the window comes back out');
  assert.equal(r.rounds, 10);

  // ...and a real ticker fans exactly that window to its pools
  const p = { health: 500, maxHealth: 500, level: 1, skills: {}, stats: {}, activeEffects: [] };
  const foe = { entity: { health: 100, maxHealth: 100, level: 1, skills: {}, stats: {}, activeEffects: [bleed(90)] }, dead: false };
  const gone = { entity: { health: 100, level: 1, skills: {}, stats: {}, activeEffects: [bleed(90)] }, dead: true };
  setWorldMinutes(3000);
  resetMagicRoundMarker(3000);
  const ticker = createPlayerTicker(p, {});
  const off = subscribeFoePools(ticker, [() => [foe, gone]], (f) => sinksFor(f.entity));
  ticker.tick(10 / CLASSIC_MINUTES_PER_SECOND);
  assert.equal(foe.entity.activeEffects[0].roundsRemaining, 80, 'the live foe took the same ten rounds');
  assert.equal(foe.entity.health, 90);
  assert.equal(gone.entity.activeEffects[0].roundsRemaining, 90, 'a dead foe is not a subscriber');

  off();
  ticker.tick(10 / CLASSIC_MINUTES_PER_SECOND);
  assert.equal(foe.entity.activeEffects[0].roundsRemaining, 80, 'and unsubscribing really unsubscribes');
});

test('audit24 wave32: a subscribed pool gets the stat-zero kill too', () => {
  const p = { health: 500, maxHealth: 500, level: 1, skills: {}, stats: {}, activeEffects: [] };
  const foe = {
    dead: false,
    entity: {
      health: 40, maxHealth: 40, level: 1, skills: {}, activeEffects: [{ kind: 'drainAttribute', stat: 'strength', magnitude: 60 }],
      stats: Object.fromEntries(STAT_KEYS_ORDER.map((k) => [k, 40])),
    },
  };
  setWorldMinutes(4000);
  resetMagicRoundMarker(4000);
  const ticker = createPlayerTicker(p, {});
  subscribeFoePools(ticker, [() => [foe]], (f) => sinksFor(f.entity));
  // UpdateEntityMods runs on its own 0.2 REAL second cadence, not on a round
  ticker.tick(0.1);
  assert.equal(foe.entity.health, 40, 'not yet');
  ticker.tick(0.2);
  assert.equal(foe.entity.health, 0, 'a foe drained to zero Strength dies, like any other entity');
});

test('audit24 wave32: every foe pool in the port is a subscriber, and the dungeon runs its own', () => {
  // tickActiveEffects / updatePoisons for foes used to appear in exactly ONE
  // file. The gate is the ratio: a pool that drives foes must reach the
  // broker somehow, or its foes age at nothing.
  const w = rd('src/scenes/world.js');
  assert.ok(w.includes('subscribeFoePools(playerTicker, [() => cityGuards.guards, () => exteriorFoes.foes], foeSinks);'),
    'the streaming host subscribes both of its pools');
  const x = rd('src/scenes/exterior.js');
  assert.ok(x.includes('subscribeFoePools(playerTicker, [() => cityGuards.guards], foeSinks);'),
    'the town host subscribes its watch');
  // ...through ONE set of doors per entity, the same set the cast engine takes
  for (const [name, src] of [['world.js', w], ['exterior.js', x]]) {
    assert.equal((src.match(/const foeSinks = \(g\) => \(\{/g) ?? []).length, 1, `${name}: one foeSinks`);
    assert.ok(src.includes('    foeSinks,\n'), `${name}: and the cast engine takes the same one`);
  }
  // the dungeon host owns its foe list inside a closure the ticker never sees,
  // so it runs the fan-out inline - on the window the tick CLAIMED, not on
  // arithmetic of its own (which had neither catch-up nor the 2880 cap).
  const d = rd('src/scenes/dungeonContext.js');
  assert.ok(d.includes('runMagicRoundsFor(f.entity, _tick.magicRoundWindow.from, _tick.magicRoundWindow.to, { sinks: foeSinks(f) });'),
    'the dungeon frame body rides the claimed window');
  assert.ok(!/for \(let r = _prevMinute;/.test(d), 'and its old private minute loop is gone');
});

test('audit24 wave32: paralysis reaches the exterior pools', () => {
  // EnemyMotor.HandleParalysis (:247-260) drops CanAct; EnemyAttack returns at
  // the top of Update (:91-94) and FixedUpdate (:55-57). Both exterior pools
  // passed the literal `false` for the motor's paralyzed argument and ran the
  // attack machine unconditionally, so a paralysed foe kept walking and kept
  // swinging - and until this wave gave them magic rounds the paralysis never
  // expired either, which made it permanent.
  const xf = rd('src/scenes/exteriorFoes.js');
  assert.ok(xf.includes('const _fParalyzed = entityIsParalyzed(f.entity);'), 'exteriorFoes reads it');
  // MT-ii wrapped the context (_armed adds the targeting closure when
  // the host supplies candidates); the paralysis argument is untouched.
  assert.ok(xf.includes('f.ai.update(dt, playerFeet, _armed(f, senses), _fParalyzed, _fPaused);'), 'the motor is told');
  // MT-ii: the component aims at the SELECTED target (EnemyAttack
  // reads senses.Target, :199-209) and holds when there is none.
  assert.ok(xf.includes('if (!_fParalyzed && _tgt) f.attack.update(dt, f.ai, _tgt, _fPaused);'), 'the attack machine holds');
  // MT-ii: the caster aims at the target too, so a foe duelling
  // another foe stops hurling its fireballs at the player.
  assert.ok(xf.includes('if (_tgt && f.caster && !_fParalyzed && !_fPaused && f.ai.isHostile) {'), 'and so does casting');
  // and no DAMAGE FRAME resolves. EnemyAttack.Update returns at the top while
  // paralysed, so MeleeDamage/BowDamage never run. The dungeon host gets this
  // free by suppressing the whole mobile update; these pools resolve off the
  // mobile's own frames, so without the gate freezing the attack MACHINE would
  // still have let a mid-swing animation land its blow.
  // MT-ii: both frames gate on a live TARGET (`_tgt`) instead of the
  // player's feet - EnemyAttack's MeleeDamage and BowDamage both
  // return at `senses.Target == null` (:136-137).
  assert.ok(xf.includes('if (!_fParalyzed && f.mobile.doMeleeDamage && _tgt) {'), 'no melee lands');
  assert.ok(xf.includes('if (!_fParalyzed && f.mobile.shootArrow && _tgt && onArrow) {'), 'no arrow looses');
  assert.equal(xf.includes('senses, false)'), false, 'no literal false left behind');

  const cg = rd('src/scenes/cityGuards.js');
  assert.ok(cg.includes('const _gParalyzed = entityIsParalyzed(g.entity);'), 'cityGuards reads it');
  assert.ok(cg.includes('g.ai.update(dt, playerFeet, _armed(g, senses), _gParalyzed);'), 'the motor is told');   // MT-ii: same wrap
  assert.ok(cg.includes('const events = (_gParalyzed || !_tgt) ? [] : g.attack.update(dt, g.ai, _tgt);'), 'the attack machine holds');   // MT-ii: same
  assert.ok(cg.includes('if (!_gParalyzed && g.mobile.doMeleeDamage && _tgt) {'), 'and no blow lands');   // MT-ii: target-gated
  assert.equal(cg.includes('senses, false)'), false, 'no literal false left behind');
});

test('audit24 wave32: PlayerEntity\'s per-minute loop is its OWN, uncapped and un-plus-oned', () => {
  const src = rd('src/systems/worldTick.js');
  // it is not the broker's: no 2880 cap, its own marker, and the minute VALUE
  // tested with no +1 (PlayerEntity.cs:454-459).
  assert.ok(src.includes('for (let i = lastMinutes; i < nowMinutes; i++)'), 'over the whole elapsed window');
  assert.ok(src.includes('i % NORMALIZE_INTERVAL_MINUTES === 0'), 'on the minute value');
  assert.ok(src.includes('entity.lastGameMinutes = nowMinutes;'), 'PlayerEntity.cs:521');
  const claim = src.slice(src.indexOf('export function claimMagicRounds'), src.indexOf('export function runMagicRoundsFor'));
  assert.ok(!claim.includes('NORMALIZE_INTERVAL_MINUTES'), 'and it is NOT inside the broker\'s claim');
  const run = src.slice(src.indexOf('export function runMagicRoundsFor'), src.indexOf('export function runMagicRounds('));
  assert.ok(!run.includes('NORMALIZE_INTERVAL_MINUTES'), 'nor inside a subscriber\'s round - foes have no reputation');

  // BEHAVIOURALLY: a jump far past the broker's 2880-round cap still steps
  // every one of its minutes here, which is how a 21-day sentence works.
  let normalized = 0;
  const N = 161280;
  const entity = { stats: {}, skills: [], level: 1, legalRep: [40], factionRep: null };
  // The boundary must sit MORE than MAX_CATCHUP_ROUNDS behind the new clock,
  // or the broker's cap would still reach it and the probe would prove
  // nothing: N is 3000 minutes back, the cap only looks 2880.
  entity.lastGameMinutes = N - 100;
  setWorldMinutes(N + 3000);
  resetMagicRoundMarker(N + 3000);
  const before = entity.legalRep[0];
  tickPlayerMinutes({ entity, classicMinutes: N - 100, dt: 3100 / CLASSIC_MINUTES_PER_SECOND, sinks: {}, activity: {} });
  if (entity.legalRep[0] !== before) normalized++;
  assert.ok(3000 > MAX_CATCHUP_ROUNDS - 100, 'the probe really is outside the broker cap');
  assert.equal(normalized, 1, 'the boundary is still reached - no 2880 cap on THIS loop');
  assert.equal(entity.lastGameMinutes, N + 3000, 'and the marker lands on the new minute');
  void worldMinutes();
});
