// FIELD BUGS 2026-10-19f HELD-CONCEAL (a player's private report: an item that makes its wearer invisible stopped
// working after Overworld travel, and worked again only once it was taken off and put on again).
//
// One landed blow did it, wherever it landed (a journey's ambush is the likely one). The break of a NORMAL-power
// concealment (EntityEffectManager.BreakNormalPowerConcealmentEffects, systems/concealment.js) deleted the worn item's
// entry with the spells', its pin with it - and the reroll that recasts a worn item's spell (RerollItemEffects,
// enchantments.js enchantmentMagicRound) only visits an item that still holds a pin. DFU ENDS the effect
// (EndIncumbentEffect: RoundsRemaining = 0, End()) and keeps the item's bundle while the item is worn (DoMagicRound
// :1739-1742), so the reroll recasts it. Driven on the real producers: the equip table's Cast-When-Held door (equip.js
// equipItem -> enchantments.js assignHeldSpell -> effects.js applySpell), a real blow (combat/formulas.js
// calculateAttackDamage), a real spell's damage door (applySpell's HandleAttackFromSource), the real magic-round pump
// (worldTick.js runMagicRoundsFor, the reroll inside it) and the HUD's own icon row (ui/hud/hudActiveSpells.js).
import '../modsOff.js';   // the blow is the stock core's
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENCHANTMENT_TYPES as T, setDefaultEnchantCtx, REROLL_MINIMUM_HOURS } from '../../src/systems/enchantments.js';
import { applySpell, isInvisible, isBlending, isAShade, concealBits, hasActiveEffect } from '../../src/systems/effects.js';
import { breakNormalPowerConcealment } from '../../src/systems/concealment.js';
import { equipItem, unequipSlot } from '../../src/systems/equip.js';
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

test('HELD-CONCEAL: a worn Invisibility a landed blow broke is broken now - unread by isInvisible, the wire\'s bits and the HUD - and stands ENDED on its item; the reroll recasts it once the item\'s six hours are out, still worn (mutants: the held entry ended; kept on its item; hasActiveEffect\'s ended skip; the HUD\'s)', () => world((clock, until) => {
  const ring = piece(RING, INVIS);
  const w = clock.w = wearer([ring]);
  equipItem(w, ring);
  assert.equal(isInvisible(w), true, 'worn: invisible');
  assert.deepEqual(icons(w), [['Invisibility', true]], 'and its icon up, an item\'s');
  assert.equal(blow(w, false), 0, 'the fixture misses');
  assert.equal(isInvisible(w), true, 'a miss breaks nothing (`damage > 0`)');
  assert.ok(blow(w) > 0, 'the fixture lands');
  assert.equal(isInvisible(w), false, 'WeaponManager.cs:549-552 - the blow broke it');
  assert.equal(concealBits(w), 0, 'and the pose\'s bits say so to every peer');
  assert.deepEqual(pins(w), [['invisNormal', 'ended', 0]], 'EndIncumbentEffect: RoundsRemaining = 0, End() - the entry stays on its item');
  assert.deepEqual(icons(w), [], 'the HUD shows no concealment that is not there');
  assert.equal(breakNormalPowerConcealment(w), false, 'an ended one is nothing left to break');
  until(REROLL_AT - 1);
  assert.equal(isInvisible(w), false, 'within the item\'s six hours it stays broken (rerollMinimumHours)');
  assert.deepEqual(pins(w), [['invisNormal', 'ended', 0]]);
  until(REROLL_AT);
  assert.equal(isInvisible(w), true, 'the reroll recast it - it stood broken for as long as the ring was worn');
  assert.deepEqual(pins(w), [['invisNormal']], 'fresh, the ended one stripped first');
  assert.equal(ring.timeEffectsLastRerolled, REROLL_AT);
  assert.deepEqual(icons(w), [['Invisibility', true]]);
}));

test('HELD-CONCEAL: a spell\'s Invisibility a blow broke stays broken - removed, as DFU\'s spell bundle goes at the next round - and with a worn one beside it, one blow ends both and the reroll brings back only the worn one (mutant: the spell kept)', () => world((clock, until) => {
  const w = clock.w = wearer([]);
  applySpell(INVIS, w.level, w, {}, seq(0), { entity: w, sinks: {} });
  assert.equal(isInvisible(w), true, 'cast: invisible');
  assert.ok(blow(w) > 0);
  assert.deepEqual(w.activeEffects.map((a) => a.kind), [], 'the spell\'s entry is gone');
  assert.equal(isInvisible(w), false);

  const ring = piece(RING, INVIS);
  w.items.push(ring);
  equipItem(w, ring);
  applySpell(INVIS, w.level, w, {}, seq(0), { entity: w, sinks: {} });
  assert.deepEqual(w.activeEffects.map((a) => [a.kind, !!a.heldItem]), [['invisNormal', true], ['invisNormal', false]], 'the worn one and the spell\'s stand side by side (the pin never merges)');
  assert.ok(blow(w) > 0);
  assert.equal(isInvisible(w), false, 'one blow ends every live one - DFU\'s first-found would leave the spell\'s up');
  assert.deepEqual(w.activeEffects.map((a) => [a.kind, !!a.heldItem, !!a.ended]), [['invisNormal', true, true]]);
  until(REROLL_AT);
  assert.deepEqual(w.activeEffects.map((a) => [a.kind, !!a.heldItem, !!a.ended]), [['invisNormal', true, false]], 'the worn one is back; the spell is not');
  assert.equal(isInvisible(w), true);
}));

test('HELD-CONCEAL: taking the piece off clears its broken concealment, and putting it on again casts it at once - a piece no longer worn is never rerolled', () => world((clock, until) => {
  const ring = piece(RING, INVIS);
  const w = clock.w = wearer([ring]);
  equipItem(w, ring);
  assert.ok(blow(w) > 0);
  assert.deepEqual(pins(w), [['invisNormal', 'ended', 0]]);
  unequipSlot(w, ring.equipSlot);
  assert.deepEqual(w.activeEffects, [], 'UnequipHeldItem\'s sweep takes the ended entry with its item');
  until(REROLL_AT + 60);
  assert.equal(isInvisible(w), false, 'off, nothing recasts it');
  assert.equal(ring.timeEffectsLastRerolled, EQUIPPED_AT);
  equipItem(w, ring);
  assert.equal(isInvisible(w), true, 'on again: cast at once');
  assert.deepEqual(pins(w), [['invisNormal']]);
}));

test('HELD-CONCEAL: every concealment kind - a blow ends the worn NORMAL three (Invisibility, Chameleon, Shadow) on their item and leaves the TRUE three; the reroll restores the three (mutant: the TRUE powers broken)', () => world((clock, until) => {
  const normal = piece(AMULET, INVIS, CHAM, SHADOW), truePower = piece(AMULET, INVIS_T, CHAM_T, SHADOW_T);
  const w = clock.w = wearer([normal, truePower]);
  equipItem(w, normal);
  equipItem(w, truePower);
  assert.notEqual(normal.equipSlot, truePower.equipSlot, 'both amulets worn');
  assert.deepEqual(pins(w), [['invisNormal'], ['chameleonNormal'], ['shadeNormal'], ['invisTrue'], ['chameleonTrue'], ['shadeTrue']]);
  assert.ok(blow(w) > 0);
  assert.deepEqual(pins(w), [['invisNormal', 'ended', 0], ['chameleonNormal', 'ended', 0], ['shadeNormal', 'ended', 0], ['invisTrue'], ['chameleonTrue'], ['shadeTrue']]);
  assert.deepEqual([isInvisible(w), isBlending(w), isAShade(w)], [true, true, true], 'the true powers still conceal (IsInvisible folds normal OR true)');
  unequipSlot(w, truePower.equipSlot);
  assert.deepEqual([hasActiveEffect(w, 'invisNormal'), hasActiveEffect(w, 'chameleonNormal'), hasActiveEffect(w, 'shadeNormal')], [false, false, false]);
  assert.equal(concealBits(w), 0, 'the true amulet off: nothing conceals');
  until(REROLL_AT);
  assert.deepEqual(pins(w), [['invisNormal'], ['chameleonNormal'], ['shadeNormal']]);
  assert.equal(concealBits(w), 7, 'invisible, blending and a shade again');
}));

test('HELD-CONCEAL: every breaker is the one door - a spell\'s damage the wearer lands (DamageHealthFromSource -> HandleAttackFromSource) ends the worn one exactly as a blow does', () => world((clock, until) => {
  const ring = piece(RING, CHAM);
  const w = clock.w = wearer([ring]);
  equipItem(w, ring);
  assert.equal(isBlending(w), true);
  const dmg = { type: 4, subType: 0, magnitudeBaseLow: 10, magnitudeBaseHigh: 10, magnitudeLevelBase: 0, magnitudeLevelHigh: 0, magnitudePerLevel: 0 };
  let hurt = 0;
  applySpell({ element: 0, rangeType: 0, effects: [dmg] }, 1, foe(), { hurt: (n) => { hurt += n; } }, seq(0), { entity: w, sinks: {} });
  assert.equal(hurt, 10, 'the spell landed');
  assert.equal(isBlending(w), false);
  assert.deepEqual(pins(w), [['chameleonNormal', 'ended', 0]]);
  until(REROLL_AT);
  assert.equal(isBlending(w), true);
}));
