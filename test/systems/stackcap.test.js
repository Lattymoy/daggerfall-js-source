// STACK-CAP (2026-10-11, the owner: "the ability to keep accumulating spell times to max out spells and never have to
// refresh" - answered "Refresh, never stack"). A like-kind re-cast RENEWS its incumbent to what the cast would stand at
// as a new instance, never adds to it and never shortens it (systems/effects.js renewRounds). DFU's AddState adds the
// rounds up, so a caster with magicka to spare banked a Shield Group at 11,397 rounds (BUFF-END, systems/mysticism.js).
// Recorded departure: Port-Ledger section A.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applySpell, renewRounds, tickActiveEffects, BUFF_KINDS } from '../../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../../src/systems/spell/spellMaker.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const being = () => ({
  stats: { luck: 50, willpower: 50, strength: 50, intelligence: 50, agility: 50, endurance: 50, personality: 50, speed: 50 },
  skills: [], activeEffects: [], race: 'Breton', level: 1, health: 50, maxHealth: 50, magicka: 100, maxMagicka: 100,
});
// blankEffectSettings puts every spinner at 1, so a level-1 cast of durationBase N rolls N + 1 rounds and stands at N
// after the initial round (effects.js pushActive)
const cast = (ent, type, subType, durationBase) => applySpell(
  buildCustomSpell({ slots: [{ type, subType, settings: { ...blankEffectSettings(), durationBase, chanceBase: 100, magnitudeBaseLow: 5, magnitudeBaseHigh: 5 } }], rangeType: 0 }),
  1, ent, {}, () => 0.5, null, {});
const lasting = (ent) => ent.activeEffects.filter((a) => !a.instant && !a.ended && a.roundsRemaining > 0);

// every incumbent family applySpell merges a like-kind re-cast into, by its classic key (the self-castable ones - Soul
// Trap needs a monster and has its own case below)
const FAMILIES = [
  ...Object.keys(BUFF_KINDS).map((k) => k.split(',').map(Number)),
  [1, 0], [1, 1], [1, 2],          // Continuous Damage - Health, Fatigue, Spell Points
  [9, 0],                          // Fortify Strength (same settings: like-kind)
  [18, 255],                       // Regenerate
  [0, 255],                        // Paralyze
  [35, 255],                       // Shield
  [20, 255], [21, 255], [22, 255], // Spell Absorption, Reflection, Resistance
  [44, 255],                       // Comprehend Languages
  [8, 0],                          // Elemental Resistance (Fire)
];

test('STACK-CAP renewRounds: an incumbent is topped up to the fresh value and never shortened (mutants: rounds added; rounds overwritten)', () => {
  const low = { roundsRemaining: 3 };
  renewRounds(low, 10);
  assert.equal(low.roundsRemaining, 10, 'a run-down incumbent is renewed to a fresh cast\'s rounds');
  renewRounds(low, 10);
  assert.equal(low.roundsRemaining, 10, 'and a second renewal adds nothing');
  const high = { roundsRemaining: 40 };
  renewRounds(high, 10);
  assert.equal(high.roundsRemaining, 40, 'a shorter cast never cuts a longer incumbent short');
});

test('STACK-CAP every incumbent family: fifty casts in a row stand at ONE cast\'s rounds, a run-down buff is renewed to them, and a shorter cast leaves a longer one be (mutants: any arm back on `+= rounds`; the renewal at the arrival\'s whole duration)', () => {
  for (const [type, subType] of FAMILIES) {
    const key = `${type},${subType}`;
    const e = being();
    cast(e, type, subType, 10);
    const [entry] = lasting(e);
    assert.ok(entry, `${key}: the cast lands a lasting entry`);
    assert.equal(entry.roundsRemaining, 10, `${key}: a fresh cast stands at 10 (11 rolled, the initial round taken)`);
    for (let i = 0; i < 50; i++) cast(e, type, subType, 10);
    assert.equal(lasting(e).length, 1, `${key}: one incumbent`);
    assert.equal(entry.roundsRemaining, 10, `${key}: fifty re-casts bank nothing - DFU's AddState would stand at 520`);
    for (let i = 0; i < 6; i++) tickActiveEffects(e, {}, () => 0.5);
    assert.equal(entry.roundsRemaining, 4, `${key}: six rounds run`);
    cast(e, type, subType, 10);
    assert.equal(entry.roundsRemaining, 10, `${key}: a re-cast renews it to a fresh cast's 10 - never 4 + 11`);
    cast(e, type, subType, 2);
    assert.equal(entry.roundsRemaining, 10, `${key}: a shorter re-cast never shortens it`);
  }
});

test('STACK-CAP the soul trap on a monster renews too, and keeps its chance (mutants: the trap arm stacking)', () => {
  const m = { ...being(), mobileType: 15 };
  const trap = (chanceBase) => applySpell(
    buildCustomSpell({ slots: [{ type: 12, subType: 255, settings: { ...blankEffectSettings(), durationBase: 10, chanceBase, chanceMod: 0 } }], rangeType: 1 }),
    1, m, {}, () => 0.99, null, {});
  trap(20);
  const t = m.activeEffects.find((a) => a.kind === 'soulTrap');
  for (let i = 0; i < 20; i++) trap(90);
  assert.equal(t.roundsRemaining, 10, 'twenty re-casts bank nothing');
  assert.equal(t.chance, 20, 'and the incumbent keeps its own chance');
});

test('STACK-CAP the ally lane: a party mate\'s re-casts renew the mate\'s bundle and never stack on it (mutants: the ally lane stacking)', () => {
  const e = being();
  const sp = buildCustomSpell({ slots: [{ type: 35, subType: 255, settings: { ...blankEffectSettings(), durationBase: 10, magnitudeBaseLow: 5, magnitudeBaseHigh: 5 } }], rangeType: 0 });
  for (let i = 0; i < 30; i++) applySpell(sp, 1, e, {}, () => 0.5, null, { allyCast: true });
  const gifts = e.activeEffects.filter((a) => a.kind === 'shield' && a.bundleAlly);
  assert.equal(gifts.length, 1);
  assert.equal(gifts[0].roundsRemaining, 10, 'thirty gifts stand at one gift\'s rounds');
});

// THE ONE CONSTRUCTION SEAM, swept: no door in src/ adds rounds onto a live entry - every like-kind merge goes through
// renewRounds. A new door that writes `roundsRemaining +=` (or `roundsRemaining = x.roundsRemaining + n`) brings back the
// bank; the two timers that kept a buff's time outside an entry (the torch's light, the gate court's trap) are pinned by
// name - camp fuel and the like add to their own timers by design, so `until +=` is not swept.
test('STACK-CAP sweep: nothing in src/ adds to an entry\'s roundsRemaining, and the gate court\'s trap timer renews (mutants: a stacking door added anywhere)', () => {
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (f.endsWith('.js')) files.push(p);
    }
  };
  walk(join(ROOT, 'src'));
  const hits = [];
  for (const p of files) {
    const lines = readFileSync(p, 'utf8').split('\n');
    // AUDIT STACK-CAP: both spellings of an addition - `+=`, and an assignment that reads the rounds back plus more
    lines.forEach((l, i) => { if (/\broundsRemaining\s*(\+=|=\s*[\w.?]*roundsRemaining\s*\+)/.test(l) && !/^\s*(\/\/|\*)/.test(l)) hits.push(`${p.slice(ROOT.length + 1)}:${i + 1}`); });
  }
  assert.deepEqual(hits, [], 'a door that stacks rounds');
  const court = readFileSync(join(ROOT, 'src/scenes/gate/gateCourt.js'), 'utf8');
  assert.match(court, /if \(trapMark && t < trapMark\.until\) trapMark\.until = Math\.max\(trapMark\.until, t \+ rounds \* COURT_ROUND_MS\);/);
  assert.doesNotMatch(court, /trapMark\.until \+=/);
  const torches = readFileSync(join(ROOT, 'src/scenes/droppedTorches.js'), 'utf8');
  assert.match(torches, /if \(inc\) renewRounds\(inc, st\.fireDuration\);/);
});

test('AUDIT STACK-CAP an ACTING incumbent renewed in its last listed round runs the round a fresh cast would have run - a Regenerate, a Continuous Damage - so a re-cast at the tail buys what letting it lapse and casting again buys (mutants: the tail round never run; run on every renewal)', () => {
  const heals = (waitTicks) => {
    const e = being();
    let n = 0;
    const sinks = { heal: () => { n++; } };
    const regen = buildCustomSpell({ slots: [{ type: 18, subType: 255, settings: { ...blankEffectSettings(), durationBase: 4, magnitudeBaseLow: 4, magnitudeBaseHigh: 4 } }], rangeType: 0 });
    applySpell(regen, 1, e, sinks, () => 0.5, null, {});
    for (let i = 0; i < waitTicks; i++) tickActiveEffects(e, sinks, () => 0.5);
    const before = n;
    applySpell(regen, 1, e, sinks, () => 0.5, null, {});
    for (let i = 0; i < 12; i++) tickActiveEffects(e, sinks, () => 0.5);
    return n - before;
  };
  assert.equal(heals(6), 5, 'lapsed, then cast: the five rounds a fresh cast heals');
  assert.equal(heals(4), 5, 'renewed at its tail (0 left, still listed): the same five');
  assert.equal(heals(1), 4, 'renewed with three rounds still standing: no round run now - topped up to a fresh cast\'s four, never stacked (3 + 5)');
});
