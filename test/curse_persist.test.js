// CURSE-PERSIST1 + CURSE-REPAIR1 (2026-09-24, the contributor's report: players "getting lycanthropy or vampirism
// and losing it again").
//
// Driven through the real doors: the curse is made by its own constructor, saved by snapshotPlayer, carried through
// JSON as the slot stores it, loaded by restorePlayer and ticked by runMagicRoundsFor - the path that pruned it.
import './modsOff.js';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createLycanthropyCurse, liveLycanthropy, cureLycanthropy, LYCANTHROPY_SPELL_TAG, VAMPIRE_SPELL_TAG } from '../src/systems/lycanthropy.js';
import { createVampirismCurse, liveVampirism, cureVampirism, VAMPIRE_CLAN_SPELLS, VAMPIRE_BASE_SPELLS } from '../src/systems/vampirism.js';
import { LYCANTHROPY_TYPES, VAMPIRE_CLANS, INFECTION, createInfection, liveInfection } from '../src/systems/infection.js';
import { tickActiveEffects } from '../src/systems/effects.js';
import { repairLostCurses, inferVampireClan } from '../src/systems/curseRepair.js';
import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { setSpellRecordsByIndex } from '../src/systems/loot.js';
import { runMagicRoundsFor } from '../src/systems/worldTick.js';

const rd = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const records = new Map();
for (const i of [92, ...VAMPIRE_BASE_SPELLS, ...Object.values(VAMPIRE_CLAN_SPELLS).flat()]) records.set(i, { index: i, name: `!Spell${i}`, effects: [] });
beforeEach(() => setSpellRecordsByIndex(records));
const P = () => ({ isPlayer: true, level: 5, activeEffects: [], health: 60, maxHealth: 60, items: [], spells: [], stats: {}, skills: {} });
const NOW = 500000;
const TODAY = Math.floor(NOW / 1440);   // an infection caught today - hours from turning, so the rounds below keep it an infection
/** save, carry through JSON as the slot does, load into a fresh entity */
const reload = (p, at = NOW) => { const q = { isPlayer: true }; restorePlayer(q, JSON.parse(JSON.stringify(snapshotPlayer(p, { classicMinutes: at })))); return q; };

test('CURSE-PERSIST1: a curse and an infection survive a save, a load and the magic rounds after it - they are lifelong, flagged `permanent` as a disease and a poison already are (mutants: the flag dropped from either curse or the infection)', () => {
  const wolf = P(); createLycanthropyCurse(wolf, LYCANTHROPY_TYPES.Werewolf, { now: NOW });
  const vamp = P(); createVampirismCurse(vamp, VAMPIRE_CLANS.Selenu, { now: NOW });
  const sick = P(); sick.activeEffects.push(createInfection(INFECTION.Werewolf, { day: TODAY }));
  for (const p of [wolf, vamp, sick]) assert.equal(p.activeEffects.at(-1).permanent, true, 'made lifelong');
  for (const [name, p, live] of [['werewolf', wolf, liveLycanthropy], ['vampire', vamp, liveVampirism], ['infection', sick, liveInfection]]) {
    tickActiveEffects(p, {});   // a round in the session that caught it
    let q = reload(p);
    runMagicRoundsFor(q, NOW, NOW + 30, { sinks: {} });   // the rounds after the load - the prune ran on the first
    assert.ok(live(q), `${name}: still there after a load and thirty minutes`);
    q = reload(q, NOW + 30);
    runMagicRoundsFor(q, NOW + 30, NOW + 60, { sinks: {} });
    assert.ok(live(q), `${name}: and after a second one`);
  }
});

test('CURSE-PERSIST1: a save written BEFORE the fix - the curse with no flag and a null round budget, as JSON wrote its NaN - is given the flag at the load door and survives the ticks (mutants: the migration dropped; it keyed on the wrong kind)', () => {
  const wolf = P(); createLycanthropyCurse(wolf, LYCANTHROPY_TYPES.Wereboar, { now: NOW });
  wolf.activeEffects.push(createInfection(INFECTION.Vampirism, { day: TODAY }));
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(wolf, { classicMinutes: NOW })));
  for (const a of snap.activeEffects) { delete a.permanent; a.roundsRemaining = null; }   // the old save's shape exactly
  const q = { isPlayer: true };
  restorePlayer(q, snap);
  runMagicRoundsFor(q, NOW, NOW + 30, { sinks: {} });
  assert.equal(liveLycanthropy(q)?.infectionType, LYCANTHROPY_TYPES.Wereboar, 'the curse, with its own strain - nothing was lost, so nothing is assumed');
  assert.ok(liveInfection(q), 'and the infection');
  const src = rd('src/systems/effects.js');
  assert.match(src, /^ {4}if \(a\.permanent\) return !a\.ended;$/m, 'tickActiveEffects keeps its one law and learns no kind by name');
});

test('CURSE-REPAIR1: a curse the old prune took is given back on load - the vampire with the clan its spells name, for every clan, Anthotis by its base three alone; the werewolf as a werewolf, the strain said to be assumed; the spells never granted twice (mutants: the clan inferred wrong; the spells doubled)', () => {
  const pruned = (p) => { const b = JSON.parse(JSON.stringify(p)); b.activeEffects = []; b.racialOverride = null; return b; };
  for (const clan of [...Object.keys(VAMPIRE_CLAN_SPELLS).map(Number), VAMPIRE_CLANS.Anthotis]) {
    const e = P(); createVampirismCurse(e, clan, { now: 0 });
    const q = reload(pruned(e));
    assert.equal(liveVampirism(q)?.clan, clan, `clan ${clan} given back by the load itself`);
    assert.equal(q.spells.filter((s) => s.tag === VAMPIRE_SPELL_TAG).length, e.spells.filter((s) => s.tag === VAMPIRE_SPELL_TAG).length, 'no spell granted twice');
  }
  assert.equal(inferVampireClan([]), VAMPIRE_CLANS.Anthotis);
  // the inference is EXACT because no spell is two clans', or a clan's and the base three's
  const all = [...VAMPIRE_BASE_SPELLS, ...Object.values(VAMPIRE_CLAN_SPELLS).flat()];
  assert.equal(new Set(all).size, all.length, 'the clans\' lists and the base three are disjoint');
  const w = P(); createLycanthropyCurse(w, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
  const q = reload(pruned(w), NOW);
  assert.equal(liveLycanthropy(q)?.infectionType, LYCANTHROPY_TYPES.Werewolf);
  assert.equal(liveLycanthropy(q).lastKilledInnocent, NOW, 'the urge\'s clock starts at the save\'s clock, not at zero');
  assert.equal(q.spells.filter((s) => s.tag === LYCANTHROPY_SPELL_TAG).length, 1);
  assert.equal(q.racialOverride, liveLycanthropy(q), 'the marker the gates read is the curse');
});

test('CURSE-REPAIR1: giving a curse back does NOT replay its onset - the buffs and drains running now and a disease caught since stay (the onset\'s CureAll is for the day the curse is caught) (mutant: the repair through the full Start)', () => {
  const b = P();
  b.spells.push({ index: 92, name: 'Spell92', tag: LYCANTHROPY_SPELL_TAG, custom: true });
  b.activeEffects.push({ kind: 'fortifyAttribute', stat: 'strength', magnitude: 10, roundsRemaining: 20 });
  assert.equal(repairLostCurses(b, { now: 9 }), 'lycanthropy');
  const buff = b.activeEffects.find((a) => a.kind === 'fortifyAttribute');
  assert.ok(buff && !buff.ended, 'the running buff is this life\'s, and stays');
  // the onset itself still ends the old life, as VampirismEffect.Start / LycanthropyEffect.Start do
  const c = P();
  c.activeEffects.push({ kind: 'fortifyAttribute', stat: 'strength', magnitude: 10, roundsRemaining: 20 });
  createLycanthropyCurse(c, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
  assert.equal(c.activeEffects.find((a) => a.kind === 'fortifyAttribute').ended, true, 'a curse CAUGHT still ends the old life');
});

test('CURSE-REPAIR1: nothing is given back where nothing was lost - a live curse, a cured player, a curse waiting to deploy, an infection that will deploy one; a second load gives nothing twice (mutants: the cured player re-cursed; the pending marker ignored)', () => {
  const live = P(); createLycanthropyCurse(live, LYCANTHROPY_TYPES.Werewolf, { now: 0 });
  assert.equal(repairLostCurses(live, { now: 1 }), null, 'a live curse');
  const cured = P(); createVampirismCurse(cured, VAMPIRE_CLANS.Lyrezi, { now: 0 }); cureVampirism(cured);
  assert.equal(cured.spells.some((s) => s.tag === VAMPIRE_SPELL_TAG), false, 'the cure takes the spells - the fingerprint the repair reads');
  assert.equal(repairLostCurses(cured, { now: 1 }), null, 'a cured vampire stays cured');
  const curedWolf = P(); createLycanthropyCurse(curedWolf, LYCANTHROPY_TYPES.Werewolf, { now: 0 }); cureLycanthropy(curedWolf);
  assert.equal(repairLostCurses(curedWolf, { now: 1 }), null, 'a cured werewolf stays cured');
  const pending = P(); pending.spells.push({ index: 92, tag: LYCANTHROPY_SPELL_TAG }); pending.racialOverridePending = { lycanthropyType: 1 };
  assert.equal(repairLostCurses(pending, { now: 1 }), null, 'a curse about to deploy');
  const infected = P(); infected.spells.push({ index: 92, tag: LYCANTHROPY_SPELL_TAG }); infected.activeEffects.push(createInfection(INFECTION.Werewolf, { day: TODAY }));
  assert.equal(repairLostCurses(infected, { now: 1 }), null, 'an infection that will deploy one');
  const again = P(); again.spells.push({ index: 92, tag: LYCANTHROPY_SPELL_TAG });
  assert.equal(repairLostCurses(again, { now: 1 }), 'lycanthropy');
  assert.equal(repairLostCurses(again, { now: 2 }), null, 'idempotent');
  // the hook sits AFTER the spellbook and the effect list are restored
  const save = rd('src/systems/save.js');
  assert.ok(save.indexOf('repairLostCurses(entity, {') > save.indexOf('seedCustomSpellIndex(entity.spells);'), 'after the spellbook');
  assert.ok(save.indexOf('repairLostCurses(entity, {') > save.indexOf("entity.racialOverride = entity.activeEffects.find("), 'after the effect list and its marker');
});
