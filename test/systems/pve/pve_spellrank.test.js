// FIXED-PVE SPELL-RANK (bible/05-Combat/Fixed-PvE.md section 17, 2026-10-31: Normals only): a killing or
// holding spell lands on a Normal template foe as Daggerfall has it; a ranked one is immune to every one of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spellRanked, spellHold, spellSwayRefused, spellDispel } from '../../../src/systems/pve/pveSpellRank.js';
import { applySpell } from '../../../src/systems/effects.js';
import { buildCustomSpell, blankEffectSettings } from '../../../src/systems/spell/spellMaker.js';
import { killIfAnyLiveStatZero, REFRESH_MODS_DELAY } from '../../../src/systems/statMods.js';

const foe = (over = {}) => ({ stats: { luck: 50, willpower: 50, personality: 50 }, skills: new Array(35).fill(0),
  activeEffects: [], race: 'Nord', level: 30, health: 1000, maxHealth: 1000, magicka: 0, maxMagicka: 0, ...over });
const tpl = (category, over = {}) => foe({ pveTemplate: 'probe', pveCategory: category, ...over });
const RANKED = ['strong', 'elite', 'champion', 'boss', 'raidBoss'];
const cast = (ent, type, subType, settings, sinks = {}) => applySpell(
  buildCustomSpell({ slots: [{ type, subType, settings: { ...blankEffectSettings(), ...settings } }], rangeType: 2 }),
  1, ent, sinks, () => 0.5, { level: 5, entity: {} }, {});
const hurtOf = (e) => { const got = { n: 0 }; return { got, sinks: { hurt: (n) => { got.n += n; e.health -= n; } } }; };

test('SPELL-RANK ranked: every template foe above Normal, an elite Normal too; a Normal or a plain foe is not', () => {
  assert.equal(spellRanked(foe()), false);
  assert.equal(spellRanked(tpl('normal')), false);
  for (const c of RANKED) assert.equal(spellRanked(tpl(c)), true, c);
  assert.equal(spellRanked(tpl('normal', { eliteFoe: true })), true);
});

test('SPELL-RANK Disintegrate: a Normal and a plain foe die whole; a ranked foe saves', () => {
  for (const e of [foe(), tpl('normal')]) {
    const { got, sinks } = hurtOf(e);
    assert.equal(cast(e, 5, 255, { chanceBase: 100 }, sinks).disintegrated, 1);
    assert.equal(got.n, 1000);
  }
  for (const c of RANKED) {
    const e = tpl(c), { got, sinks } = hurtOf(e);
    const out = cast(e, 5, 255, { chanceBase: 100 }, sinks);
    assert.deepEqual([out.disintegrated, out.saved, got.n], [undefined, 1, 0], c);
  }
});

test('SPELL-RANK Paralyze: a Normal is held, a ranked foe never', () => {
  const held = (e) => { cast(e, 0, 255, { chanceBase: 100, durationBase: 10 }); return e.activeEffects.some((a) => a.kind === 'paralyze'); };
  assert.equal(held(tpl('normal')), true);
  for (const c of RANKED) assert.equal(held(tpl(c)), false, c);
  assert.equal(spellHold(foe(), 7), 7);
});

test('SPELL-RANK Pacify and Charm: a ranked foe refuses both before any roll; a Normal may be swayed', () => {
  assert.equal(spellSwayRefused(tpl('normal')), false);
  for (const c of RANKED) assert.equal(cast(tpl(c, { mobileType: 128 + 5 }), 34, 255, { chanceBase: 100 }).swayRefused, 1, c);
});

test('SPELL-RANK a drained stat: a Normal dies, a ranked foe does not', () => {
  const tick = (e, sinks) => killIfAnyLiveStatZero(e, sinks, REFRESH_MODS_DELAY + 0.1);
  const norm = tpl('normal', { stats: { strength: 0 } }), n = hurtOf(norm);
  assert.equal(tick(norm, n.sinks), true);
  assert.equal(n.got.n, 1000);
  const boss = tpl('boss', { stats: { strength: 0 } }), b = hurtOf(boss);
  assert.equal(tick(boss, b.sinks), false);
  assert.equal(b.got.n, 0);
});

test('SPELL-RANK Dispel: a Normal template foe is killed (it drops its loot), a ranked one untouched, any other removed', () => {
  const calls = [];
  const pool = { removeFoe: (f) => calls.push(['remove', f.id]), damageFoe: (f, n, feet, dir, o) => calls.push(['hit', f.id, n, o.whole]) };
  spellDispel({ id: 1, entity: foe() }, pool, [0, 0, 0]);
  spellDispel({ id: 2, entity: tpl('normal') }, pool, [0, 0, 0]);
  spellDispel({ id: 3, entity: tpl('boss') }, pool, [0, 0, 0]);
  assert.deepEqual(calls, [['remove', 1], ['hit', 2, 1000, true]]);
  assert.match(readFileSync(new URL('../../../src/scenes/world.js', import.meta.url), 'utf8'), /for \(const f of gone\) spellDispel\(f, exteriorFoes, player\.pos\);/);
});
