// STATS-CARD: the flip side's numbers, pinned against the combat core they claim to describe. Small on purpose:
// the exact-expectation model is checked against many seeded swings through the real roll code, plus the plain
// arithmetic (the strength term, the swing table, the reference foes) and the bare-hand and bow arms.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeCombatStats, referenceFoe, REFERENCE_FOES, strikingWeaponOf, criticalModel, activeCore } from '../../src/combat/combatStats.js';
import { calculateAttackDamage, damageModifier } from '../../src/combat/formulas.js';
import {
  pcaaoModules, pcaaoSuccessfulHit, pcaaoWeaponToHit, pcaaoWeaponAttackDamage, pcaaoStruckBodyPart, pcaaoProficiencyModifiers,
  pcaaoRacialModifiers, uninstallPcaao,
} from '../../src/combat/pcaao.js';
import { SKILLS } from '../../src/systems/skills.js';
import { EQUIP_SLOTS } from '../../src/systems/equip.js';
import { SWING_MODS } from '../../src/combat/playerWeapon.js';
import { STATS_CARD_CSS, FLIP_EDGE_MS, flipEdgeMs } from '../../src/ui/statsCard.js';   // FIREFOX-FLIP

const stats = (o = {}) => ({ strength: 50, intelligence: 50, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50, ...o });
const skillsAll = (v, o = {}) => ({ ...Object.fromEntries(Array.from({ length: 35 }, (_, i) => [i, v])), ...o });
const mkPlayer = (o = {}) => ({
  isPlayer: true, level: 5, raceId: 1, stats: stats(), skills: skillsAll(40), health: 50, maxHealth: 60, items: [],
  career: { weaponArmorShieldsBitfield: 0, abilityFlagsAndSpellPointsBitfield: 0 }, armorValues: new Array(7).fill(100),
  reflexes: 2, biographyAvoidHitMod: 0, ...o,
});
const longsword = () => ({ group: 'Weapons', templateIndex: 120, material: 1, flags: 0, maxCondition: 1e9, currentCondition: 1e9, name: 'Longsword' });
const mulberry = (a) => () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const N = 40000;

test('classic core: hit rate and mean damage match the real calculateAttackDamage', () => {
  uninstallPcaao();
  const p = mkPlayer({ stats: stats({ strength: 70, agility: 60, luck: 55 }), skills: skillsAll(40, { [SKILLS.LongBlade]: 62, [SKILLS.CriticalStrike]: 30, [SKILLS.Dodging]: 10 }) });
  const w = longsword();
  const s = computeCombatStats(p, { core: 'classic', weapon: w });
  assert.equal(s.core, 'classic');
  for (const idx of [0, 2, 3]) {   // soft, armoured, human
    const foe = referenceFoe(p.level, REFERENCE_FOES[idx]);
    const rolls = mulberry(1234 + idx);
    let hits = 0; let total = 0;
    for (let i = 0; i < N; i++) {
      const d = calculateAttackDamage(p, { ...foe }, { weapon: w, damageMod: 0, toHitMod: 0, rolls });
      total += d; if (d > 0) hits++;
    }
    const m = s.head.byFoe[idx];
    assert.ok(Math.abs(hits / N - m.hit) < 0.012, `hit ${hits / N} vs ${m.hit} (foe ${idx})`);
    assert.ok(Math.abs(total / N - m.perSwing) < 0.35, `per swing ${total / N} vs ${m.perSwing} (foe ${idx})`);
  }
});

test('overhaul core: hit chance and pre-armour damage match pcaao\'s own roll code', () => {
  const p = mkPlayer({ stats: stats({ strength: 66, agility: 58, speed: 54, luck: 47 }), skills: skillsAll(40, { [SKILLS.LongBlade]: 55, [SKILLS.CriticalStrike]: 36, [SKILLS.Dodging]: 12 }) });
  const w = longsword();
  const modules = pcaaoModules((k) => ({ Enabled: true, armorHitFormulaRedone: true, criticalStrikesIncreaseDamage: false })[k], () => undefined);
  const s = computeCombatStats(p, { core: 'overhaul', weapon: w, modules });
  const foe = referenceFoe(p.level, REFERENCE_FOES[1]);
  const rolls = mulberry(99);
  const prof = pcaaoProficiencyModifiers(p, w); const racial = pcaaoRacialModifiers(p, w, p);
  const chanceMod = Math.ceil(Math.fround(55 * 1.5)) + prof.toHitMod + racial.toHitMod + pcaaoWeaponToHit(w);
  let hits = 0; let dmg = 0;
  for (let i = 0; i < N; i++) {
    const part = pcaaoStruckBodyPart(rolls());
    if (pcaaoSuccessfulHit(p, foe, chanceMod, part, rolls, modules)) { hits++; dmg += pcaaoWeaponAttackDamage(p, foe, prof.damageMod + racial.damageMod, 0, w, rolls, modules); }
  }
  const m = s.head.byFoe[1];
  assert.ok(Math.abs(hits / N - m.hit) < 0.012, `hit ${hits / N} vs ${m.hit}`);
  assert.ok(Math.abs(dmg / hits - m.dmg.avg) < 0.12, `damage ${dmg / hits} vs ${m.dmg.avg}`);
});

test('the plain arithmetic: strength term, material, swing table, foes', () => {
  uninstallPcaao();
  const p = mkPlayer({ stats: stats({ strength: 80 }) });
  const s = computeCombatStats(p, { core: 'classic', weapon: longsword() });
  // Longsword 2..16, steel +0, strength (80-50)/5 = +6
  assert.equal(damageModifier(80), 6);
  assert.equal(s.head.byFoe[0].dmg.min, 2 + 6);
  assert.equal(s.head.byFoe[0].dmg.max, 16 + 6);
  const up = s.swings.find((x) => x.key === 'StrikeUp');
  assert.equal(up.byFoe[0].dmg.min, 2 + 6 + SWING_MODS.StrikeUp.damage);
  assert.equal(up.mods.toHit, 10);
  assert.equal(s.foes.length, 4);
  assert.ok(s.head.byFoe[0].hit >= s.head.byFoe[2].hit, 'more armour never raises the hit chance');
});

test('bare hands, bows, and the critical model', () => {
  uninstallPcaao();
  const p = mkPlayer({ skills: skillsAll(40, { [SKILLS.HandToHand]: 50, [SKILLS.CriticalStrike]: 40 }) });
  const fists = computeCombatStats(p, { core: 'classic', weapon: null });
  assert.equal(fists.weapon, null);
  assert.equal(fists.head.byFoe[0].dmg.min, Math.floor(50 / 10) + 1);
  assert.equal(fists.head.byFoe[0].dmg.max, Math.floor(50 / 5) + 1);
  const bow = computeCombatStats(p, { core: 'classic', weapon: { group: 'Weapons', templateIndex: 130, material: 0, flags: 0 } });
  assert.equal(bow.isBow, true);
  assert.equal(bow.headlineKey, 'StrikeDown');
  assert.equal(bow.swings.length, 1);
  const c = criticalModel(p, { overhaul: false, modules: pcaaoModules() });
  assert.deepEqual([c.chance, c.hitBonus, c.damageMult], [0.4, 4, 1]);
  const o = criticalModel(p, { overhaul: true, modules: { criticalStrikesIncreaseDamage: true } });
  assert.equal(o.kind, 'damage');
  assert.ok(o.damageMult > 1);
});

test('the striking weapon defaults to the right hand, or nothing', () => {
  const w = longsword();
  const slots = []; slots[EQUIP_SLOTS.RightHand] = w;
  assert.equal(strikingWeaponOf({ equip: { slots } }), w);
  assert.equal(strikingWeaponOf({ equip: { slots: [] } }), null);
  assert.equal(typeof activeCore().overhaul, 'boolean');
});

// ── the card (a minimal stand-in for the DOM: enough to build the page and press the button) ──
class FakeEl {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.style = { setProperty() {} }; this.className = ''; this._t = ''; this.inert = false; this.id = ''; }
  set textContent(v) { this._t = String(v); } get textContent() { return this._t + this.children.map((c) => c.textContent).join(' '); }
  append(...n) { this.children.push(...n); } replaceChildren(...n) { this.children = n; }
  setAttribute(k, v) { this.attrs[k] = v; } addEventListener() {} get offsetWidth() { return 0; }
  get classList() {
    const self = this;
    const set = () => new Set(self.className.split(/\s+/).filter(Boolean));
    const put = (s) => { self.className = [...s].join(' '); };
    return { add: (...c) => { const s = set(); c.forEach((x) => s.add(x)); put(s); }, remove: (...c) => { const s = set(); c.forEach((x) => s.delete(x)); put(s); },
      toggle: (c, on) => { const s = set(); (on ?? !s.has(c)) ? s.add(c) : s.delete(c); put(s); }, contains: (c) => set().has(c) };
  }
  find(pred) { if (pred(this)) return this; for (const c of this.children) { const r = c.find?.(pred); if (r) return r; } return null; }
}
test('the Stats button turns the card, builds the back, and the turn survives a repaint', async () => {
  const head = new FakeEl('head');
  globalThis.document = { createElement: (t) => new FakeEl(t), getElementById: () => null, head };
  const { statFlip } = await import('../../src/ui/statsCard.js');
  const p = mkPlayer();
  const slots = []; slots[EQUIP_SLOTS.RightHand] = longsword();
  p.equip = { slots };
  const front = new FakeEl('div');
  const card = statFlip(front, p);
  assert.ok(head.children.some((c) => c.id === 'statflip-css'), 'the dress is injected once');
  const btn = card.find((n) => n.tag === 'button' && n.className.includes('statflip-btn'));
  assert.equal(btn.textContent, 'Stats');
  assert.ok(!card.classList.contains('is-back'));
  btn.onclick({ stopPropagation() {}, preventDefault() {} });
  assert.ok(card.classList.contains('is-back'));
  assert.equal(btn.textContent, 'Paperdoll');
  const text = card.textContent;
  for (const word of ['Combat Stats', 'Damage', 'Hit chance', 'Critical', 'Backstab', 'Swing directions', 'Defence', 'Attributes']) assert.ok(text.includes(word), word);
  // a repaint while turned builds the back already facing you
  const again = statFlip(new FakeEl('div'), p);
  assert.ok(again.classList.contains('is-back'));
  assert.ok(again.textContent.includes('Combat Stats'));
  // a failure must never take the pack with it
  const plain = new FakeEl('div');
  assert.equal(statFlip(plain, null), plain);
  delete globalThis.document;
});

test('FIREFOX-FLIP: in Firefox alone (two tests, either enough) the turned-away face is hidden by visibility, swapped at the moment the card is EDGE-ON - the first leg\'s eased rotation crossing 90 degrees (~226ms of 900), not half the turn, where it is already 25 degrees past and showing its back; reduced motion keeps its crossfade (mutants: the swap at half the turn; the back never hidden; reduced motion swapped too; the keyframes off the constants)', () => {
  // the eased first leg, evaluated forward (an independent spelling of cubic-bezier(.3,.7,.25,1) on 0..45% -> 0..96deg)
  const bez = (t, p1, p2) => 3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  const angleAt = (ms) => {
    const x = ms / (900 * 0.45);
    let lo = 0, hi = 1;
    for (let i = 0; i < 40; i++) { const s = (lo + hi) / 2; if (bez(s, 0.3, 0.25) < x) lo = s; else hi = s; }
    return 96 * bez(lo, 0.7, 1);
  };
  assert.equal(FLIP_EDGE_MS, flipEdgeMs());
  assert.ok(Math.abs(angleAt(FLIP_EDGE_MS) - 90) < 0.6, `edge-on at ${FLIP_EDGE_MS}ms (${angleAt(FLIP_EDGE_MS).toFixed(2)}deg)`);
  assert.ok(angleAt(900 * 0.45) > 95.9 && 900 * 0.45 < 450, 'the first leg ends past edge-on, before half the turn - a swap at half shows a face from behind');
  assert.ok(FLIP_EDGE_MS > 200 && FLIP_EDGE_MS < 250);
  const css = STATS_CARD_CSS;
  const ff = css.slice(css.indexOf('@supports (-moz-appearance: none) or selector(:-moz-focusring) {'));
  assert.ok(ff.length > 0 && css.includes('@supports (-moz-appearance: none) or selector(:-moz-focusring) {'), 'Firefox alone');
  assert.match(ff, /^@supports \(-moz-appearance: none\) or selector\(:-moz-focusring\) \{\s*\n\s*@media \(prefers-reduced-motion: no-preference\) \{/, 'never under reduced motion');
  assert.match(ff, new RegExp(`\\.pack-shell \\.statflip-front, \\.pack-shell \\.statflip-back \\{ transition: visibility 0s ${FLIP_EDGE_MS}ms; \\}`), 'the swap at the edge');
  assert.match(ff, /\.pack-shell \.statflip-back \{ visibility: hidden; \}\s*\n\s*\.pack-shell \.statflip\.is-back \.statflip-back \{ visibility: visible; \}\s*\n\s*\.pack-shell \.statflip\.is-back \.statflip-front \{ visibility: hidden; \}/);
  // the keyframes and the swap read one set of numbers
  assert.match(css, /45% \{ transform: rotateY\(96deg\) translateZ\(70px\)/);
  assert.match(css, /45% \{ transform: rotateY\(84deg\) translateZ\(70px\)/);
  assert.match(css, /animation: sf-to-back 900ms cubic-bezier\(0\.3,0\.7,0\.25,1\) both;/);
});
