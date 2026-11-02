// RPT1026-PROGRESS (private reports, 2026-10-26): the player's cast engine (scenes/hostMagic.js createPlayerMagic) - the
// one every host builds - driven through its own doors: a ready and its release (readySpell, castInput, the parked
// animation's release frame), a party mate's gift through the receiver's door (applySpellToPlayer with `allyCast`), a
// foe's spell landing on me. The record is the batch's Field-Bugs page.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createPlayerMagic } from '../../src/scenes/hostMagic.js';
import { createCharacter } from '../../src/systems/chargen.js';
import { buildCustomCareer } from '../../src/systems/customClass.js';
import { buildCustomSpell, blankEffectSettings } from '../../src/systems/spell/spellMaker.js';
import { calculateCastCost, registerSpellCostMod } from '../../src/systems/spellcost.js';
import { spellResistanceChance, spellReflectionChance, comprehendLanguagesChance } from '../../src/systems/effects.js';
import { SKILLS } from '../../src/systems/skills.js';
import { playerEntity as PLAYER } from '../../src/characters/playerEntity.js';

const STATS = { strength: 50, intelligence: 100, willpower: 50, agility: 50, endurance: 50, personality: 50, speed: 50, luck: 50 };
const career = {
  ...buildCustomCareer({
    name: 'Mage', hp: 8, stats: STATS,
    skills: [SKILLS.Thaumaturgy, SKILLS.Mysticism, SKILLS.Destruction, SKILLS.Alteration, SKILLS.Restoration, SKILLS.Illusion,
      SKILLS.Medical, SKILLS.Etiquette, SKILLS.Streetwise, SKILLS.Lockpicking, SKILLS.Stealth, SKILLS.Dodging],
  }),
  abilityFlagsAndSpellPointsBitfield: 0,   // SpellPointMultipliers.Times_3_00: a pool of 300 the casts fit in
};
/** A level-20 mage at 80 in Thaumaturgy and Mysticism (the report's skills), half her pool spent. */
function mage() {
  const p = structuredClone(PLAYER);
  createCharacter(p, career, -1, { rolls: () => 0.5 });
  p.chargenDone = true; p.level = 20;
  p.skills[SKILLS.Thaumaturgy] = 80; p.skills[SKILLS.Mysticism] = 80;
  p.magicka = Math.floor(p.maxMagicka / 2); p.health = p.maxHealth;
  return p;
}
/** The engine, as the hosts build it; the casting hands held until the test lets them go (`release()`). */
function rig(player, { rolls = () => 0.5 } = {}) {
  const parked = [];
  const identified = [];
  const magic = createPlayerMagic({
    renderer: { createBillboardBatch: () => ({}), destroyBillboardBatch() {} },
    audio: { playOneShot() {}, playOneShotId() {}, play3d() {}, play3dId() {} },
    getTexture: async () => ({ getSize: () => [16, 16], getScale: () => [0, 0] }),
    uploadRecord() {}, uploadRecordFrame() {},
    collider: { raycast: () => Infinity },
    playerEntity: player,
    playerSinks: { hurt(n) { player.health -= n; }, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {}, say() {} },
    say() {}, surfacePlayer() {},
    foes: () => [],
    foeSinks: () => ({ hurt() {}, heal() {}, drainMagicka() {}, restoreMagicka() {}, drainFatigue() {}, restoreFatigue() {} }),
    absorbCtx: () => ({ inside: true, day: false }),
    rolls,
    startCastAnim: (_sp, release) => { parked.push(release); return true; },
    onIdentify: (d) => identified.push(d),
  });
  magic.firePending([0, 0.9, 0], [0, 0, 1]);
  return { magic, identified, release: () => parked.splice(0).forEach((fn) => fn()) };
}
const slot = (type, settings) => ({ type, subType: 255, settings: { ...blankEffectSettings(), ...settings } });
/** An Identify the player casts on themself (a 30% base chance, so its price fits the pool). */
const IDENTIFY = buildCustomSpell({ slots: [slot(40, { chanceBase: 30, chanceMod: 0, chancePerLevel: 1 })], rangeType: 0, name: 'Identify' });
/** One cast of it, through the ready and the release: the magicka before and after, and the window's charge. */
function castIdentify(player, r, between = () => {}) {
  const before = player.magicka;
  assert.equal(r.magic.readySpell(IDENTIFY), true);
  between();
  r.release();
  return { before, after: player.magicka, window: r.identified.at(-1)?.refund };
}

test('RPT1026-PROGRESS (Identify\'s refund): with a 30% discount a cast gives back what it spent, never more - five casts leave the pool where it was (the report\'s profit, closed by 2000334cd and held here); the window charges the discounted price', () => {
  const p = mage();
  const r = rig(p);
  registerSpellCostMod('rpt1026-focus', (_e, sp) => sp * 0.7);
  try {
    const paid = calculateCastCost(IDENTIFY, p).sp;
    assert.ok(paid > 5, `the fixture's cast costs ${paid}`);
    for (let i = 0; i < 5; i++) {
      const c = castIdentify(p, r);
      assert.equal(c.after, c.before, `cast ${i + 1}: spent ${paid} and given ${paid} back - no profit`);
      assert.equal(c.window, paid, 'the window charges the price the cast was priced at');
    }
  } finally { registerSpellCostMod('rpt1026-focus', null); }
});

test('RPT1026-PROGRESS (Identify\'s refund, the two leftovers): a cast a modifier took to 1 gives back 1, not the floor\'s 5; a discount gone between the ready and the release gives back the stored price, not the new one (mutants: the floor before the cap; the price re-read at the release)', () => {
  const p = mage();
  const r = rig(p);
  registerSpellCostMod('rpt1026-focus', () => 1);
  try {
    const c = castIdentify(p, r);
    assert.equal(c.before - c.after, 0, 'paid 1, given 1');
    assert.equal(c.window, 5, 'the window keeps Identify.cs:54-55\'s floor of 5 - it is the effect\'s price');
  } finally { registerSpellCostMod('rpt1026-focus', null); }
  const full = calculateCastCost(IDENTIFY, p).sp;
  registerSpellCostMod('rpt1026-focus', (_e, sp) => sp * 0.5);
  let off = false;
  try {
    const c = castIdentify(p, r, () => { registerSpellCostMod('rpt1026-focus', null); off = true; });
    assert.equal(off, true);
    assert.equal(c.after, c.before, `the ready stored half of ${full}; the release priced the whole - given back what was spent`);
    assert.equal(c.window, full, 'the window charges the price at the landing');
  } finally { registerSpellCostMod('rpt1026-focus', null); }
});

test('RPT1026-PROGRESS (Identify\'s refund): a free ready spent nothing and is given nothing (DFU\'s own TODO, Identify.cs); the window still charges', () => {
  const p = mage();
  const r = rig(p);
  const before = p.magicka;
  assert.equal(r.magic.readySpell(IDENTIFY, { free: true }), true);
  r.release();
  assert.equal(p.magicka, before, 'no magicka made from a free cast');
  assert.ok(r.identified.at(-1)?.refund > 0, 'the window is told its price');
});

test('RPT1026-PROGRESS (a mate\'s lesser ward): a level-one mate\'s Spell Resistance gift, then my own 100%: a foe\'s spell rolling 50 is resisted - the gift no longer masks my ward; Reflection and Comprehend Languages read the best the same way (mutants: the first entry read again)', () => {
  const p = mage();
  p.magicka = p.maxMagicka;
  const r = rig(p, { rolls: () => 0.5 });
  const ward = (type, base) => buildCustomSpell({ slots: [slot(type, { chanceBase: base, chanceMod: 1, chancePerLevel: 1, durationBase: 5, durationMod: 0, durationPerLevel: 1 })], rangeType: 0, name: 'Ward' });
  // the mate's gift lands first, through the receiver's door, at their level 1: 5 + 1
  r.magic.applySpellToPlayer(ward(22, 5), 1, null, { allyCast: true });
  r.magic.applySpellToPlayer(ward(44, 5), 1, null, { allyCast: true });
  assert.equal(spellResistanceChance(p), 6, 'the gift alone');
  // then my own, readied and cast
  assert.equal(r.magic.readySpell(ward(22, 80)), true); r.release();
  p.magicka = p.maxMagicka;
  assert.equal(r.magic.readySpell(ward(44, 80)), true); r.release();
  const kinds = (k) => p.activeEffects.filter((a) => a.kind === k && !a.ended).map((a) => [!!a.bundleAlly, a.chance]);
  assert.deepEqual(kinds('spellResistance'), [[true, 6], [false, 100]], 'two entries: the gift never merges with mine (AUDIT ALLY-CAST C2)');
  assert.equal(spellResistanceChance(p), 100, 'the ward read is my own 100, not the gift\'s 6');
  const mine = p.activeEffects.find((a) => a.kind === 'spellResistance' && !a.bundleAlly);
  mine.ended = true;
  assert.equal(spellResistanceChance(p), 6, 'an ended ward is read by nobody - the gift is what stands');
  mine.ended = false;
  assert.equal(comprehendLanguagesChance(p), 100);
  // a foe's bolt: the resistance gate rolls 50 against it
  const bolt = buildCustomSpell({ slots: [{ type: 4, subType: 0, settings: { ...blankEffectSettings(), magnitudeBaseLow: 10, magnitudeBaseHigh: 10 } }], rangeType: 2, element: 3, name: 'Bolt' });
  const foe = { level: 10, mobileType: 5, health: 50, maxHealth: 50, activeEffects: [], stats: { ...STATS }, skills: new Array(40).fill(50) };
  const hp = p.health;
  const out = r.magic.applySpellToPlayer(bolt, 10, { entity: foe, sinks: {} });
  assert.equal(out.resisted, 1, 'resisted');
  assert.equal(p.health, hp, 'and nothing landed');
  // Spell Reflection, the same way: the gift first, then my own
  const q = mage();
  q.magicka = q.maxMagicka;
  const rq = rig(q);
  rq.magic.applySpellToPlayer(ward(21, 5), 1, null, { allyCast: true });
  assert.equal(rq.magic.readySpell(ward(21, 80)), true); rq.release();
  assert.equal(spellReflectionChance(q), 100);
  const back = rq.magic.applySpellToPlayer(bolt, 10, { entity: foe, sinks: {} });
  assert.equal(back.reflected, 1, 'turned back at the foe by my own reflection');
});
