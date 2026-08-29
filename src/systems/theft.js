// PT1 - STEALING HAD NO CONSEQUENCE.
//
// Two flags stood in worldModes' interior arm, both routed to "the
// crime arc": the shop-shelf stealing roll beside SetShopShelfStealing,
// and the theft basket behind `loot.houseOwned`. Every dependency they
// were waiting on has shipped - CG2's TallyCrimeGuildRequirements, G1's
// SpawnCityGuards, the crime table, TallySkill - so what was left was
// the two laws themselves, which live here.
//
// THEY ARE NOT THE SAME LAW, and the shop-shelf flag said they were:
// it promised "the shoplifting ROLL and its crime tally". DFU's
// shop-shelf arm has NO ROLL. Reading both members side by side
// (DaggerfallInventoryWindow.cs):
//
//   SHOP SHELF (:681-687, at the window's own teardown)
//       if (shopShelfStealing && remoteItems.Count < lootTargetStartCount)
//           playerEntity.TallyCrimeGuildRequirements(true, 1);
//   - a COUNT comparison against the shelf as it stood when the window
//     opened, and nothing else. No chance, no guards, no crime record.
//     Robbing a closed shop earns you Thieves Guild credit and no
//     trouble at all, which is classic's own answer.
//
//   PRIVATE PROPERTY (:2277-2281 -> AttemptPrivatePropertyTheft :1848-1863)
//       TallyCrimeGuildRequirements(true, 1);
//       weightAndNumItems = (int)basket.GetWeight() + basket.Count;
//       chance = CalculateShopliftingChance(player, buildingQuality, weightAndNumItems);
//       if (!Dice100.FailedRoll(chance)) { CrimeCommitted = Theft; SpawnCityGuards(true); }
//       else                             { TallySkill(Pickpocket, 1); }
//   - the tally FIRST and unconditionally, then the roll. The guards
//     come for you in someone's house; they do not come for a shelf.
//
// THE BASKET, and why this port does not need one. DFU accumulates
// `theftBasket` as the player clicks - added on a take, removed on a
// put-back - because the window must WEIGH what was taken. The set it
// ends up holding is exactly "present in the container when the window
// opened, absent when it closed", so a snapshot diff answers the same
// question from the same two facts. Putting one of your OWN items into
// the container does not enter it either way (DFU's RemoveItem finds
// nothing to remove; the diff sees a gain, not a loss).
//
// AND THE NEAR-MISS THAT WROTE ITSELF DOWN. The tree had
// `Math.floor(rolls() * 100) >= chance` written out inline in three
// places, each commented "Dice100.FailedRoll", and this slice set out
// to give that member one home - by adding a fourth export. formulas.js
// has had `dice100` since T3a, one screen above where the new one went,
// and `!dice100(chance, roll)` IS FailedRoll. Reading the neighbouring
// pickpocket call site is what caught it, which is the same way SD1's
// duplicate module was caught. The three sites now route through the
// export that already existed.
import { calculateShopliftingChance, dice100 } from '../combat/formulas.js';
import { totalWeight } from './inventory.js';

/** The theft basket, as a diff. `before` is the container's contents
 *  when the window opened, `after` when it closed; the answer is what
 *  left. Identity is by REFERENCE, which is the port's item identity
 *  everywhere else - two Iron Daggers are two objects. */
export function theftBasket(before, after) {
  const kept = new Set(after ?? []);
  return (before ?? []).filter((it) => !kept.has(it));
}

/** `(int)theftBasket.GetWeight() + theftBasket.Count` (:1852). The
 *  TRUNCATION is the law and it is load-bearing: a pocketful of
 *  featherweight trinkets contributes its count and almost no weight,
 *  while one heavy breastplate contributes both. */
export const shopliftingLoad = (basket) => Math.trunc(totalWeight(basket ?? [])) + (basket ?? []).length;

/** AttemptPrivatePropertyTheft (:1848-1863), as a DECISION. The host
 *  owns the effects; this owns the order and the arithmetic.
 *
 *  Answers null when the basket is empty - the window's own gate
 *  (:2277, `theftBasket.Count != 0`), kept here rather than at the
 *  call site so a second host cannot forget it.
 *
 *  `detected` is `!Dice100.FailedRoll(chance)`: the roll landing UNDER
 *  the chance is the bad outcome, because `chance` is the chance of
 *  being SEEN. */
export function privatePropertyTheft({ basket, pickpocketSkill = 0, shopQuality = 0, rolls = Math.random } = {}) {
  const load = shopliftingLoad(basket);
  if (!(basket ?? []).length) return null;
  const chance = calculateShopliftingChance(pickpocketSkill, shopQuality, load);
  return {
    // The tally is not conditional and does not wait for the roll -
    // it is the first line of the member.
    tally: true,
    weightAndNumItems: load,
    chance,
    detected: dice100(chance, rolls()),
  };
}

/** The shop-shelf arm (:681-687). DFU compares the shelf's COUNT with
 *  what it held when the window opened, so putting an item of your own
 *  onto the shelf can mask a theft of one - kept, because the count
 *  comparison IS the member. */
export const shopShelfTheft = (beforeCount, afterCount) => afterCount < beforeCount;
