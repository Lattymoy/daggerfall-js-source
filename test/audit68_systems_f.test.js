// AUDIT 68 (2026-09-24), cluster systems_f - src/systems (save.js,
// quickslots, reverbPresets, the spellbook rename both skins share).
// Each pin drives the producer's own output and failed on the base:
// the online dead-load revive, the enhanced book's rename, the disarmed
// quickslot's lamp and the reverb's high band.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { snapshotPlayer, restorePlayer } from '../src/systems/save.js';
import { respawnHealth } from '../src/systems/deathRespawn.js';
import { startPoison, POISONS } from '../src/systems/poisons.js';
import { newSurvival } from '../src/systems/survival/needs.js';
import { assignSkillSpells, RRI_SPELLS } from '../src/systems/rriKits.js';
import { SKILLS } from '../src/systems/skills.js';
import { resetQuickslotHolds, tickQuickslotHold, quickslotCycling } from '../src/systems/quickslots.js';
import { REVERB_PRESET, reverbImpulseSamples } from '../src/systems/reverbPresets.js';

const withSearch = (search, fn) => {
  const had = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: { search, pathname: '/' }, configurable: true, writable: true });
  try { return fn(); } finally {
    if (had) Object.defineProperty(globalThis, 'location', had); else delete globalThis.location;
  }
};

test('AUDIT 68 S31-online-dead-load-revive-before-restore: an online load of a dead save ends the SAVE\'s drains and exposure, not the outgoing session\'s', () => {
  // The dead character as the exit autosave writes it: the poison that did it, soaked and frozen.
  const dead = {
    name: 'Tester', health: 0, maxHealth: 80, magicka: 10, maxMagicka: 10, fatigue: 100,
    stats: { strength: 50, endurance: 50 }, skills: [], skillUses: [], items: [], career: {}, activeEffects: [],
    survival: { ...newSurvival(1000), exposure: 50, wet: 10 },
  };
  assert.ok(startPoison(dead, POISONS.Nux_Vomica, 1000, () => 0.5), 'a real poison entry');
  const snap = JSON.parse(JSON.stringify(snapshotPlayer(dead, {})));
  assert.equal(snap.activeEffects[0].kind, 'poison');
  // The session being loaded over: its own records are the ones the base revive cleared.
  const into = { items: [], stats: {}, activeEffects: [], survival: newSurvival(0) };
  withSearch('?online=1&load=1', () => assert.ok(restorePlayer(into, snap)));
  assert.equal(into.health, respawnHealth(80), 'revived at the respawn health');
  assert.deepEqual(into.activeEffects.map((a) => a.kind), [], 'the save\'s poison is ended with the revive');
  assert.equal(into.survival.exposure, 0, 'and its exposure');
  assert.equal(into.survival.wet, 0, 'and its wet');
  // Offline keeps the save as saved - the revive is the online lane's.
  const off = { items: [], stats: {}, activeEffects: [], survival: null };
  withSearch('?load=1', () => restorePlayer(off, snap));
  assert.equal(off.health, 0);
  assert.deepEqual(off.activeEffects.map((a) => a.kind), ['poison']);
  assert.equal(off.survival.exposure, 50);
});

// The enhanced book is DOM; the same shim discord5.test.js drives it with.
const mkEl = (tag = 'div') => ({
  tag, className: '', textContent: '', id: '', children: [], dataset: {}, onclick: null, value: '',
  get innerHTML() { return ''; }, set innerHTML(v) { this.children = []; },
  style: { setProperty() {}, removeProperty() {} },
  classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
  attrs: {}, setAttribute(k, v) { this.attrs[k] = String(v); }, getAttribute(k) { return this.attrs[k]; }, removeAttribute() {}, remove() {},
  append(...c) { this.children.push(...c); }, appendChild(c) { this.children.push(c); return c; }, replaceChildren(...c) { this.children = c; },
  addEventListener() {}, removeEventListener() {}, querySelector() { return null; }, querySelectorAll() { return []; }, focus() {},
});
const findAll = (n, pred, out = []) => { if (pred(n)) out.push(n); for (const c of n.children ?? []) findAll(c, pred, out); return out; };

test('AUDIT 68 S31-enhanced-rename-mutates-shared-spell: the enhanced book renames a COPY - a frozen RRI spell does not throw, the shared record keeps its name, and the save keeps the rename', async () => {
  const prevD = globalThis.document, prevW = globalThis.window;
  globalThis.document = { createElement: mkEl, createTextNode: (t) => ({ text: t, className: '' }), getElementById: () => null, head: mkEl('head'), body: mkEl('body'), addEventListener() {}, removeEventListener() {} };
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  try {
    const { mountEnhancedSpellbook } = await import('../src/ui/enhancedSpellbook.js');
    // Two characters' books from RRI's own AssignSkillSpells: both hold the one frozen Candle.
    const mine = [], theirs = [];
    assignSkillSpells(mine, SKILLS.Illusion, false, null);
    assignSkillSpells(theirs, SKILLS.Illusion, false, null);
    assert.equal(mine[0], RRI_SPELLS.candle);
    assert.ok(Object.isFrozen(mine[0]));
    const host = mkEl('div');
    const book = mountEnhancedSpellbook(host, { spells: () => mine, castCost: () => 5, entity: { magicka: 20 } });
    findAll(host, (n) => n.textContent === 'Rename')[0].onclick();
    const input = findAll(host, (n) => n.tag === 'input')[0];
    const form = findAll(host, (n) => n.tag === 'form')[0];
    input.value = 'Night Lamp';
    input.oninput();
    assert.doesNotThrow(() => form.onsubmit({ preventDefault() {} }), 'the submit does not write into a frozen record');
    book.destroy();
    assert.equal(mine[0].name, 'Night Lamp', 'the player\'s book carries the rename');
    assert.equal(mine[0].custom, true, 'marked custom, as the classic book marks it');
    assert.equal(RRI_SPELLS.candle.name, 'Candle', 'the shared record is untouched');
    assert.equal(theirs[0].name, 'Candle', 'and so is every other book holding it');
    // The rename survives a save: a custom entry is written whole, never as the bare index.
    const snap = snapshotPlayer({ stats: {}, skills: [], skillUses: [], items: [], spells: mine }, {});
    assert.equal(snap.spells[0].name, 'Night Lamp');
  } finally { globalThis.document = prevD; globalThis.window = prevW; }
});

test('AUDIT 68 S31-quickslot-disarm-raises-lamp: a blocked stretch with no key down lights no cycle lamp and performs nothing', () => {
  resetQuickslotHolds();
  const taps = [];
  const up = () => false;
  tickQuickslotHold(1 / 60, { isHeld: up, blocked: true, onTap: (s) => taps.push(s) });
  tickQuickslotHold(1 / 60, { isHeld: up, onTap: (s) => taps.push(s) });
  assert.equal(quickslotCycling(), null, 'no slot was cycled, so no chip wears the cycling border');
  assert.deepEqual(taps, []);
  // A key HELD through the window and released after it: still nothing - the F2 law, and no lamp either.
  resetQuickslotHolds();
  const spellDown = (a) => a === 'QuickSpell';
  tickQuickslotHold(1 / 60, { isHeld: spellDown, blocked: true, onTap: (s) => taps.push(s) });
  tickQuickslotHold(1 / 60, { isHeld: spellDown, onTap: (s) => taps.push(s) });
  tickQuickslotHold(1 / 60, { isHeld: up, onTap: (s) => taps.push(s) });
  assert.equal(quickslotCycling(), null);
  assert.deepEqual(taps, []);
  resetQuickslotHolds();
});

// The fraction of the tail's energy that lands in its last half: a faster-decaying
// high band leaves less there, a slower one more.
const lateShare = (p) => {
  const [l] = reverbImpulseSamples(p, 44100);
  const mid = Math.floor((p.reverbDelay + p.decayTime / 2) * 44100);
  let all = 0, late = 0;
  for (let i = 0; i < l.length; i++) { all += l[i] * l[i]; if (i >= mid) late += l[i] * l[i]; }
  return late / all;
};

test('AUDIT 68 S31-reverb-hf-decay-ratio-inverted: the high band decays over decayTime x decayHFRatio - I3DL2\'s HF-to-mid ratio, not its inverse', () => {
  // Stoneroom's 0.64 damps the highs: they die BEFORE the mid band, so its late tail is darker than the
  // same room at ratio 1. Cave's 1.30 is the reverse. The base divided by the ratio and flipped both.
  const { Stoneroom, Cave } = REVERB_PRESET;
  assert.ok(Stoneroom.decayHFRatio < 1 && Cave.decayHFRatio > 1);
  assert.ok(lateShare(Stoneroom) < lateShare({ ...Stoneroom, decayHFRatio: 1 }), 'a ratio under 1 shortens the high band');
  assert.ok(lateShare(Cave) > lateShare({ ...Cave, decayHFRatio: 1 }), 'a ratio over 1 lengthens it');
});
