// WORN-CONCEAL (FIELD BUGS 2026-10-30g, #bug-reports: "Permanent effect from trinket randomly disappears after
// travel/rest" - a Mark of Skill's Cast When Held: Chameleon gone, the Mark still worn). A landed blow ends a worn
// piece's normal-power concealment (HELD-CONCEAL); DFU brings it back at the piece's 6-hour reroll. Here the piece casts
// it again WORN_CONCEAL_BACK_ROUNDS on. The fixtures are test/systems/fb1019f_heldconceal.test.js's, on the same
// producers: the equip door, a real blow, the real magic-round pump.
import '../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCHANTMENT_TYPES as T, setDefaultEnchantCtx, REROLL_MINIMUM_HOURS, WORN_CONCEAL_BACK_ROUNDS } from '../../src/systems/enchantments.js';
import { applySpell, isBlending, isInvisible } from '../../src/systems/effects.js';
import { equipItem } from '../../src/systems/equip.js';
import { calculateAttackDamage } from '../../src/combat/formulas.js';
import { claimMagicRounds, runMagicRoundsFor, resetMagicRoundMarker } from '../../src/systems/worldTick.js';
import { activeSpellIcons } from '../../src/ui/hud/hudActiveSpells.js';
import { ITEM_GROUPS } from '../../src/characters/equipRules.js';

const seq = (...v) => { let i = 0; return () => v[Math.min(i++, v.length - 1)]; };
/** A concealment in SPELLS.STD's field shape (the enchantload pins' convention), duration only, caster only. The
 *  normal three by their classic indices, as CastWhenHeld.cs's classicSpellIDs list them (6 Invisibility, 44 Chameleon,
 *  45 Shadow Form); the true three a spellbook's own. */
const rec = (index, name, type, subType) => ({
  index, name, rangeType: 0, element: 4,
  effects: [{
    type, subType, durationBase: 3, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1,
    magnitudeBaseLow: 0, magnitudeBaseHigh: 0, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1,
  }],
});
const INVIS = rec(6, 'Invisibility', 13, 0), CHAM = rec(44, 'Chameleon', 23, 0), SHADOW = rec(45, 'Shadow Form', 24, 0);
const INVIS_T = rec(90, 'True Invisibility', 13, 1), CHAM_T = rec(91, 'True Chameleon', 23, 1), SHADOW_T = rec(92, 'True Shadow', 24, 1);
const SPELLS = new Map([INVIS, CHAM, SHADOW, INVIS_T, CHAM_T, SHADOW_T].map((r) => [r.index, r]));
/** A worn piece whose powers are Cast-When-Held, as the item maker stores them (enchanting.js applyEnchantments). */
const piece = (templateIndex, ...spells) => ({
  name: 'Made Piece', templateIndex, group: ITEM_GROUPS.Jewellery, currentCondition: 3000, maxCondition: 3000,
  enchantments: spells.map((r) => ({ type: T.CastWhenHeld, param: r.index })),
});
const RING = 135, AMULET = 133;
const wearer = (items) => ({
  name: 'W', isPlayer: true, health: 50, maxHealth: 50, items, level: 5,
  stats: { strength: 50, agility: 50, luck: 50, speed: 50, willpower: 50, endurance: 50, intelligence: 50, personality: 50 },
  skills: new Array(35).fill(40), skillUses: new Array(35).fill(0), career: {}, magicka: 5, maxMagicka: 10, activeEffects: [],
});
const foe = () => ({ isPlayer: false, isClass: true, level: 2, skills: 40, stats: { strength: 50, agility: 50, luck: 50 }, health: 30, maxHealth: 30, activeEffects: [] });
/** A bare-handed blow from `w` at a foe: `land` rolls a hit (the class arm's 3% floor decides), else a miss. */
const blow = (w, land = true) => calculateAttackDamage(w, foe(), { dfRand: () => 0, rolls: land ? seq(0, 0.99, 0.02, 0) : seq(0.5, 0.01, 0.5) });
/** The worn entries as the readers see them: kind, ended, rounds when ended. */
const pins = (w) => w.activeEffects.filter((a) => a.heldItem).map((a) => (a.ended ? [a.kind, 'ended', a.roundsRemaining] : [a.kind]));
const icons = (w) => activeSpellIcons(w).self.map((i) => [i.displayName, i.isItem]);

const EQUIPPED_AT = 100_000;
function world(fn) {
  const clock = { now: EQUIPPED_AT };
  setDefaultEnchantCtx({ spellsByIndex: () => SPELLS, now: () => clock.now, sinks: {} });
  resetMagicRoundMarker(clock.now);
  /** The magic-round pump to minute `to`, as the ticker runs it (the reroll rides it). */
  const until = (to) => {
    const win = claimMagicRounds(clock.now, to);
    clock.now = to;
    if (win) runMagicRoundsFor(clock.w, win.from, win.to, { sinks: {} });
  };
  try { fn(clock, until); } finally { setDefaultEnchantCtx(null); resetMagicRoundMarker(null); }
}
const REROLL_AT = EQUIPPED_AT + REROLL_MINIMUM_HOURS * 60;

const MARK = 137;   // the Mark (lootRarity.js's Mark of the Hist's template)
/** A Shield in SPELLS.STD's field shape (effects.js isShieldEffect: type 35, subtype 255), an index of the fixtures' own. */
const SHIELD = { index: 200, name: 'Shield', rangeType: 0, element: 4, effects: [{ type: 35, subType: 255, durationBase: 3, durationMod: 0, durationPerLevel: 1, chanceBase: 0, chanceMod: 0, chancePerLevel: 1, magnitudeBaseLow: 5, magnitudeBaseHigh: 5, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 1 }] };

test('WORN-CONCEAL: a worn Mark\'s Chameleon a blow ended stands again two rounds on, not six hours - in place, no condition spent, no reroll (mutants: the six-hour wait; the count never reached; at once)', () => world((clock, until) => {
  assert.equal(WORN_CONCEAL_BACK_ROUNDS, 2);
  const mark = piece(MARK, CHAM);
  const w = clock.w = wearer([mark]);
  equipItem(w, mark);
  const entry = w.activeEffects.find((a) => a.heldItem === mark), cond = mark.currentCondition;
  assert.equal(isBlending(w), true, 'worn: blending');
  assert.ok(blow(w) > 0);
  assert.equal(isBlending(w), false, 'a landed blow ends it (HELD-CONCEAL, DFU\'s law)');
  assert.deepEqual(icons(w), []);
  until(EQUIPPED_AT + 1);
  assert.equal(isBlending(w), false, 'a round on: still down');
  until(EQUIPPED_AT + 2);
  assert.equal(isBlending(w), true, 'two rounds on: it stands again');
  assert.deepEqual(icons(w), [['Chameleon', true]], 'its icon back, the item\'s');
  assert.equal(w.activeEffects.find((a) => a.heldItem === mark), entry, 'the same entry');
  assert.equal(mark.currentCondition, cond, 'no condition spent');
  assert.equal(mark.timeEffectsLastRerolled, EQUIPPED_AT, 'no reroll: the six-hour clock stands');
  assert.ok(EQUIPPED_AT + 2 < EQUIPPED_AT + REROLL_MINIMUM_HOURS * 60);
}));

test('AUDIT WORN-CONCEAL C2: in a fight it stays down - each landed blow starts the two rounds again (mutants: counted from the first blow)', () => world((clock, until) => {
  const mark = piece(MARK, INVIS);
  const w = clock.w = wearer([mark]);
  equipItem(w, mark);
  let t = EQUIPPED_AT;
  for (let i = 0; i < 6; i++) {
    assert.ok(blow(w) > 0);
    until(++t);
    assert.equal(isInvisible(w), false, `a blow every round: still down after ${i + 1}`);
  }
  until(++t);
  assert.equal(isInvisible(w), true, 'two rounds after the last blow it stands');
}));

test('AUDIT WORN-CONCEAL C1: a piece with a second power keeps that power as it was - a busted Shield on the same piece stays busted, and a Shield alone waits for its reroll; a spell\'s Invisibility stays broken (mutants: every ended pin stood up; a reroll)', () => world((clock, until) => {
  const SPELLS_SHIELD = new Map([...SPELLS, [SHIELD.index, SHIELD]]);
  setDefaultEnchantCtx({ spellsByIndex: () => SPELLS_SHIELD, now: () => clock.now, sinks: {} });
  const both = piece(MARK, CHAM, SHIELD), alone = piece(RING, SHIELD);
  const w = clock.w = wearer([both, alone]);
  equipItem(w, both);
  equipItem(w, alone);
  const shields = w.activeEffects.filter((a) => a.kind === 'shield');
  assert.equal(shields.length, 2, 'both Shields stand');
  for (const sh of shields) { sh.ended = true; sh.roundsRemaining = 0; sh.shieldRemaining = 0; }   // busted (playerEntity.js damageShieldPool's end)
  assert.ok(blow(w) > 0);
  until(EQUIPPED_AT + 10);
  assert.equal(isBlending(w), true, 'the Chameleon stands again');
  assert.deepEqual(w.activeEffects.filter((a) => a.kind === 'shield').map((a) => [a.ended, a.shieldRemaining]), [[true, 0], [true, 0]], 'both Shields still busted');
  assert.equal(both.timeEffectsLastRerolled, EQUIPPED_AT, 'no reroll');
  applySpell(INVIS, w.level, w, {}, seq(0), { entity: w, sinks: {} });
  assert.ok(blow(w) > 0);
  until(EQUIPPED_AT + 20);
  assert.equal(isInvisible(w), false, 'a spell\'s concealment is no worn piece\'s');
}));
