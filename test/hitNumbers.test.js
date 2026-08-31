// HN1: DAMAGE NUMBERS - the formula reports once per player attack;
// the enhanced HUD draws exactly what it was told; classic never
// registers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { numberFor, showNumber, mountHitNumbers, unmountHitNumbers } from '../src/ui/hitNumbers.js';
import { calculateAttackDamage, setPlayerAttackHook, skillsToHit, calculateSuccessfulHit } from '../src/combat/formulas.js';
import { SKILLS } from '../src/systems/skills.js';

const sk = (o) => ({ skillOverrides: Object.fromEntries(Object.entries(o).map(([k, v]) => [SKILLS[k], v])) });

test('HN1: numberFor names every resolution the formula can report', () => {
  assert.deepEqual(numberFor({ hit: false }), { kind: 'miss', text: 'Miss', tag: null });
  assert.deepEqual(numberFor({ ineffective: true, hit: false }), { kind: 'ineffective', text: 'Ineffective', tag: null });
  assert.deepEqual(numberFor({ hit: true, damage: 0 }), { kind: 'absorbed', text: '0', tag: null });
  assert.deepEqual(numberFor({ hit: true, damage: 7 }), { kind: 'hit', text: '7', tag: null });
  assert.deepEqual(numberFor({ hit: true, damage: 7, critical: true }), { kind: 'crit', text: '7', tag: null });
  assert.deepEqual(numberFor({ hit: true, damage: 21, backstab: true }), { kind: 'crit', text: '21', tag: 'Backstab' });
  // ineffective outranks everything (no roll was ever made); a miss outranks a damage figure
  assert.equal(numberFor({ ineffective: true, hit: true, damage: 9 }).kind, 'ineffective');
  assert.equal(numberFor({ hit: false, damage: 9 }).kind, 'miss');
  assert.equal(numberFor(null), null);
});

test('HN1: the formula reports once per player attack, with the flags, and nothing for enemies', () => {
  const reports = [];
  setPlayerAttackHook((r) => reports.push(r));
  const mk = (isPlayer) => ({
    isPlayer, level: 5, raceId: 0, stats: { strength: 50, agility: 50, luck: 50 },
    ...sk({ CriticalStrike: 100, Backstabbing: 100, HandToHand: 60, LongBlade: 60, Dodging: 10 }),
    armorValues: [60, 60, 60, 60, 60, 60, 60], items: [],
  });
  const p = mk(true); const e = mk(false);
  // rolls: the hit roll's dice100 uses rolls(); force everything to succeed
  const dmgHit = calculateAttackDamage(p, e, { rolls: () => 0.01, backstabChance: 100, say: () => {} });
  assert.equal(reports.length, 1, 'one report per attack');
  assert.equal(reports[0].attacker, p);
  assert.equal(reports[0].target, e);
  assert.equal(reports[0].damage, dmgHit, 'the report carries the returned damage');
  assert.equal(reports[0].hit, true);
  // an enemy's attack is not reported
  calculateAttackDamage(e, p, { rolls: () => 0.01, say: () => {} });
  assert.equal(reports.length, 1, 'an enemy attack must not report');
  // a miss: rolls at 0.99 fail the hit roll
  calculateAttackDamage(p, e, { rolls: () => 0.99, say: () => {} });
  assert.equal(reports.length, 2);
  assert.equal(reports[1].hit, false);
  assert.equal(reports[1].damage, 0);
  // an ineffective material reports without a roll
  calculateAttackDamage(p, { ...e, minMetalToHit: 9 }, { weapon: { templateIndex: 115, material: 0 }, rolls: () => 0.01, say: () => {} });
  assert.equal(reports[2].ineffective, true);
  assert.equal(reports[2].hit, false);
  setPlayerAttackHook(null);
});

test('HN1: the notes channel reports the critical strike without changing a roll or a value', () => {
  const a = { ...sk({ CriticalStrike: 100, Dodging: 0 }), stats: {} };
  const t = { ...sk({ Dodging: 0 }), stats: {} };
  const notes = {};
  const withNotes = skillsToHit(a, t, 0.01, notes);
  const without = skillsToHit(a, t, 0.01);
  assert.equal(withNotes, without, 'the notes channel must not change the modifier');
  assert.equal(notes.critical, true, 'a succeeding critical strike roll must be noted');
  const failed = {};
  skillsToHit({ ...sk({ CriticalStrike: 5, Dodging: 0 }), stats: {} }, t, 0.99, failed);
  assert.equal(failed.critical, undefined, 'a failed roll notes nothing');
  // the roll stream through calculateSuccessfulHit is identical with and without notes
  const seq = () => { let i = 0; const s = [0.3, 0.4, 0.5, 0.6]; return () => s[i++ % s.length]; };
  const A = { isPlayer: true, stats: { luck: 50, agility: 50 }, ...sk({ CriticalStrike: 40, Dodging: 0 }) };
  const T = { stats: { luck: 50, agility: 50 }, ...sk({ Dodging: 20 }), armorValues: [70, 70, 70, 70, 70, 70, 70], isClass: false };
  const r1 = calculateSuccessfulHit(A, T, 60, 0, seq());
  const r2 = calculateSuccessfulHit(A, T, 60, 0, seq(), {});
  assert.equal(r1, r2);
});

test('HN1: the overlay is enhanced-only, one node per number, removed when done', async () => {
  const hud = readFileSync('src/ui/enhancedHud.js', 'utf8');
  assert.match(hud, /mountHitNumbers\(\);/, 'the enhanced HUD must register the numbers');
  const classic = readFileSync('src/ui/hud.js', 'utf8');
  assert.ok(!/hitNumbers|mountHitNumbers/.test(classic), 'the classic HUD path must not register the numbers');
  const css = readFileSync('src/ui/enhancedStyle.js', 'utf8');
  assert.match(css, /#enhanced-hitnums \{ position: fixed; inset: 0; pointer-events: none;/);
  assert.match(css, /\.hitnum-crit \{ font-size: calc\(36px \* var\(--hud-scale, 1\)\); color: #f1c04f;/, 'the crit must be brass and larger');
  assert.match(css, /\.hitnum-miss, \.hitnum-ineffective, \.hitnum-absorbed \{ font-size: calc\(20px \* var\(--hud-scale, 1\)\);/);
  assert.match(hud, /getElementById\('enhanced-hitnums'\)\?\.style\.setProperty\('--hud-scale'/, 'the numbers must follow the HUD scale');
  // without a document nothing is created and nothing throws
  assert.equal(showNumber({ kind: 'hit', text: '3', tag: null }), null);
  // a minimal document: the node lands in the layer and leaves on animationend
  const nodes = [];
  const fakeEl = (tag) => {
    const el = { tag, children: [], style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, className: '', textContent: '', listeners: {},
      append(...c) { this.children.push(...c); for (const x of c) x.parent = this; }, isConnected: true,
      addEventListener(n, f) { this.listeners[n] = f; }, remove() { this.isConnected = false; this.parent?.children.splice(this.parent.children.indexOf(this), 1); },
      setAttribute() {} };
    nodes.push(el); return el;
  };
  globalThis.document = { createElement: fakeEl, getElementById: () => null, body: fakeEl('body') };
  try {
    const n = showNumber({ kind: 'crit', text: '21', tag: 'Backstab' }, { scatter01: () => 0.5 });
    assert.ok(n, 'a number node is made');
    assert.equal(n.className, 'hitnum hitnum-crit');
    assert.equal(n.style['--dx'], '0px', 'a 0.5 scatter is dead centre');
    assert.equal(n.children[0].textContent, 'Backstab');
    assert.equal(n.parent.id, 'enhanced-hitnums');
    n.listeners.animationend();
    assert.equal(n.isConnected, false, 'the node must leave when its animation ends');
    // register/unregister is idempotent and clears the hook
    mountHitNumbers(); mountHitNumbers();
    unmountHitNumbers();
  } finally { delete globalThis.document; }
});
