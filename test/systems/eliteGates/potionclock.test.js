// POTION-CLOCK (2026-10-31, the owner: "Allow potions in Elite Breach"; asked, "Cooldown per kind"; bible/11-Multiplayer/
// Elite-Gates.md section 17.4): in an Elite Breach every potion is drunk, and each kind waits PVP_POTION_MS after the last
// of its kind - the PvP fight's clock (combat/pvpPotions.js), run by the made level's law (systems/eliteGates/spireKit.js).
// It replaced THE POTION LAW's two restoring potions a hall.
import '../../modsOff.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerMadeLevelHere, MADE_LEVEL_RULES } from '../../../src/systems/madeLevel.js';
import { spirePotionsTimed } from '../../../src/systems/eliteGates/spireKit.js';
import { PVP_POTION_MS, POTION_KINDS, pvpPotionRefusal, pvpPotionDrunk, pvpPotionBundle, potionWaits, registerPotionClockHere, setPvpFight, resetPvpPotions } from '../../../src/combat/pvpPotions.js';
import { pendingDeclares, resetPvpDeclares } from '../../../src/combat/pvpDeclare.js';
import { POTION_RECIPES, potionRecipeKey } from '../../../src/systems/potionRecipes.js';
import { useItem } from '../../../src/systems/useItem.js';
import { TEMPLATES } from '../../../src/systems/item/itemKinds.js';
import { egPotionPip } from '../../../src/ui/eliteGates/egHud.js';
import { madeRulesLines } from '../../../src/ui/hud/statusTips.js';

const key = (name) => potionRecipeKey(POTION_RECIPES.find((r) => r.name === name).ingredients);
const bottle = (name) => ({ group: 'UselessItems1', templateIndex: TEMPLATES.Glass_Bottle, potionRecipeKey: key(name), name });
/** Use a bottle of `name` from a pack of its own; answers the use's kind and the pack's length after it. */
const drink = (name) => { const it = bottle(name), pack = [it]; return [useItem(it, pack, { drinkPotion: () => name }).kind, pack.length]; };
const here = (level) => registerMadeLevelHere(() => level);
const clean = () => { resetPvpPotions(); resetPvpDeclares(); setPvpFight(false); registerMadeLevelHere(null); };

test('POTION-CLOCK THE LAW: the Spire\'s row times potions and no other row does; the clock is the PvP fight\'s own 15 s, three kinds (mutants: the Spire\'s row counting, another row timing, the wait shortened)', () => {
  assert.equal(MADE_LEVEL_RULES.spire.potions, 'timed');
  for (const lv of ['court', 'hour', 'ketch']) assert.equal(MADE_LEVEL_RULES[lv].potions, null, lv);
  assert.equal(PVP_POTION_MS, 15_000);
  assert.deepEqual(POTION_KINDS, ['health', 'magicka', 'other']);
  try {
    for (const [lv, timed] of [['spire', true], ['court', false], ['hour', false], ['ketch', false], [null, false]]) { here(lv); assert.equal(spirePotionsTimed(), timed, String(lv)); }
  } finally { clean(); }
});

test('POTION-CLOCK IN AN ELITE BREACH: every kind of potion is drunk; a second of one kind waits its 15 s - refused in its own words, the bottle kept - while another kind is drunk at once; at 15 s it is drunk again; the bottle lands whole and the referee hears nothing (mutants: the clock not run in the Spire; a refused bottle drunk; one clock for every kind; the first effect alone; the referee told)', () => {
  clean();
  here('spire');
  try {
    assert.deepEqual(drink('healing'), ['potion', 0], 'a health potion');
    assert.deepEqual(drink('healTrue'), ['refused', 1], 'a second health potion waits, its bottle kept');
    assert.equal(pvpPotionRefusal(bottle('healing')), 'You can drink another health potion in 15 s.');
    assert.deepEqual(drink('restorePower'), ['potion', 0], 'a magicka potion is another kind');
    assert.deepEqual(drink('stamina'), ['potion', 0], 'and so is any other');
    assert.deepEqual(drink('levitation'), ['refused', 1], 'a second other one waits');
    // the clock itself, timed by hand
    resetPvpPotions();
    const t0 = 1_000_000;
    pvpPotionDrunk(bottle('healing'), t0);
    assert.match(pvpPotionRefusal(bottle('healing'), t0 + 14_001), /in 1 s\.$/);
    assert.equal(pvpPotionRefusal(bottle('healing'), t0 + PVP_POTION_MS), null, 'drinkable at 15 s');
    assert.equal(pvpPotionRefusal(bottle('restorePower'), t0 + 1), null, 'its own clock, a kind');
    const whole = { effects: [{ key: 'a' }, { key: 'b' }] };
    assert.equal(pvpPotionBundle(whole), whole, 'whole in the Spire - the first effect alone is a fight\'s');
    assert.deepEqual(pendingDeclares(), [], 'nothing declared: no referee holds a breach');
  } finally { clean(); }
});

test('POTION-CLOCK OUTSIDE IT: no made level, and a made level that times nothing, run no clock - two of a kind drunk at once; the PvP fight keeps its own clock and its referee (mutants: the clock everywhere; the fight\'s clock lost)', () => {
  clean();
  try {
    assert.deepEqual([drink('healing'), drink('healing')], [['potion', 0], ['potion', 0]], 'the open world');
    here('court');
    assert.deepEqual([drink('healing'), drink('healing')], [['potion', 0], ['potion', 0]], 'the Burning Court');
    registerMadeLevelHere(null);
    setPvpFight(true);
    assert.deepEqual([drink('healing'), drink('healing')], [['potion', 0], ['refused', 1]], 'a fight with a player');
    assert.equal(pendingDeclares().length, 1, 'the referee told of the one drunk');
  } finally { clean(); }
});

test('POTION-CLOCK THE PIP: each kind still waiting and its whole seconds, in the kinds\' order; none where no clock runs or nothing waits; the HUD\'s words (mutants: the pip shown with no clock; a kind left out; the seconds floored)', () => {
  clean();
  const t0 = 2_000_000;
  try {
    assert.deepEqual(potionWaits(t0), []);
    pvpPotionDrunk(bottle('healing'), t0);
    assert.deepEqual(potionWaits(t0 + 1000), [], 'no clock ran: nothing started');
    here('spire');
    pvpPotionDrunk(bottle('restorePower'), t0);
    pvpPotionDrunk(bottle('healing'), t0 + 4000);
    assert.deepEqual(potionWaits(t0 + 4200), [['health', 15], ['magicka', 11]]);
    assert.deepEqual(potionWaits(t0 + PVP_POTION_MS), [['health', 4]]);
    assert.deepEqual(potionWaits(t0 + 4000 + PVP_POTION_MS), []);
    assert.equal(egPotionPip([]), '');
    assert.equal(egPotionPip([['health', 15], ['magicka', 4], ['other', 2]]), ['Health potion 15 s', 'Magicka potion 4 s', 'Potion 2 s'].map((w) => w.replace(/ /g, '\u00a0')).join(' · '), 'a kind\'s words never part (AUDIT POTION-MIGHT C5)');
    // the registration is a door: one that throws runs no clock
    registerPotionClockHere(() => { throw new Error('x'); });
    assert.deepEqual(potionWaits(t0 + 4200), []);
  } finally { registerPotionClockHere(spirePotionsTimed); clean(); }
});

test('POTION-CLOCK THE RULES TILE: the Spire\'s tile says the clock in its seconds, and no tile counts potions (mutants: the line dropped; its seconds not the clock\'s)', () => {
  const spire = madeRulesLines('spire');
  assert.ok(spire.includes('Each kind of potion waits 15 seconds after the last one.'), spire.join(' | '));
  assert.ok(!spire.some((l) => /restoring potions a hall/.test(l)));
  for (const lv of ['court', 'hour', 'ketch']) assert.ok(!madeRulesLines(lv).some((l) => /potion/i.test(l)), lv);
});
