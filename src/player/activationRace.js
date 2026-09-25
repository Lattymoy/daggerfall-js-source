// @ts-check
// HARD2 - THE ACTIVATION RACE, ONE HOME (2026-09-14, Mac: "make
// everything clean, hardened and not spaghetti ... refactor where
// absolutely needed").
//
// DFU fires ONE ray on an activation (PlayerActivate.cs:314) and the
// NEAREST thing it strikes is the hit. Everything that can be struck
// above ground - a corpse, a dropped pile, a dropped torch, and the
// door / bulletin board / static-NPC set the interior transition picks
// from, with the street's townsfolk beside them - has to be raced
// against the others before any of them may act.
//
// That race is pure arithmetic over distances, and it was written out
// by hand in BOTH exterior hosts, character for character. Which is how
// AUDIT 66 F7 happened: the torch's line was added to one arm of it and
// compared against the corpse and the pile alone, so a torch anywhere
// under the ray (the picks publish the ray's 76.8, reach 3.2) ate the
// click a shop door at arm's length was owed and answered "You are too
// far away". The law was right in three places and short a term in the
// fourth, in two files at once.
//
// Four copies of a law is four chances to omit a term. This is the one
// copy. The hosts keep their ladders - the ARMS are theirs, because
// what each host does with a win differs - and ask this who won.
//
// THE LAW, as the audits settled it:
//   - AUDIT 24 (wave 38): both corpse pools are ONE pick before they
//     reach here, so which body opens is the ray's nearest hit and not
//     which pool the host asked first.
//   - AUDIT 65 MC-2: the body and the pile are decided by DISTANCE.
//     The old `_lootPick ? null : pick(piles)` precedence was inert
//     while each pick dropped its own out-of-reach target; once both
//     reach for the ray so their handlers can speak (:868-873 the
//     container, :936-941 the corpse), a body across the room would
//     have suppressed the pile outright and refused a pile at arm's
//     length. The TIE goes to the body - the pre-MC-2 precedence, which
//     DFU cannot contradict, because one ray has one hit.
//   - AUDIT 65 MC-2 again: the rival is SPLIT in two. The person arm
//     needs a rival that does not include the persons themselves
//     (townTalk.tryActivate measures its own), while the foe arm
//     measures against everything, the townsfolk included.
//   - AUDIT 66 F7: the torch races the door, not just the corpse and
//     the pile.

/**
 * ONE PICK under the ray: what the host's pickers hand over.
 * @typedef {object} RayPick
 * @property {string} key       the host's own handle for the thing struck
 * @property {number} distance  along the ray
 * @property {number} reach     how near the ARM needs it; the race does not read this
 */

/**
 * WHO WON.
 *   `loot`           - the body, when it beat the pile (the host's `_lootPick`)
 *   `drop`           - the pile, when it beat the body (the host's `_dropPick`)
 *   `torchWins`      - the torch beat the body, the pile AND the door
 *   `nonPersonRival` - what a PERSON arm must beat (the persons left out)
 *   `rival`          - what the FOE arm must beat (the townsfolk included)
 *
 * @typedef {object} RaceResult
 * @property {RayPick|null} loot
 * @property {RayPick|null} drop
 * @property {boolean} torchWins
 * @property {boolean} wagonWins      the cart beat the body, the pile, the torch AND the door (EOTB-IL)
 * @property {boolean} horseCartWins  Horse Cart and Cargo's parked wagon, following team or standing horse beat everything above (HCC)
 * @property {boolean} gateWins       an Oblivion Gate's fire beat everything (WB2)
 * @property {boolean} campWins       a camp's fire or tent beat everything above (SURV3)
 * @property {boolean} waterWins      a fountain, well or trough beat everything above (SURV3)
 * @property {number} nonPersonRival
 * @property {number} rival
 */

/**
 * Race everything the one ray struck.
 *
 * HARD3 rewrote this block. It documented FIVE `@param`s for a function
 * with ONE - the options bag - and gave each `@returns` field a prose
 * clause where its type belongs, so every line of it described a
 * signature this function does not have. Nothing had ever read it but a
 * person, and a person reads past that.
 *
 * @param {object} [opts]
 * @param {RayPick|null} [opts.corpse]  the nearest body (both pools, one pick)
 * @param {RayPick|null} [opts.pile]    the nearest dropped pile
 * @param {RayPick|null} [opts.torch]   the nearest dropped light
 * @param {RayPick|null} [opts.wagon]   Eye Of The Beholder's cart (EOTB-IL: RegisterCustomActivation(41239, 3.2)), when the lane has one
 * @param {RayPick|null} [opts.horseCart]  Horse Cart and Cargo's nearest activator (HCC: the parked wagon's box, the following team's, the standing horse's - the same 3.2)
 * @param {RayPick|null} [opts.camp]    the nearest camp (SURV3: a tent or a fire, RegisterCustomActivation's 3.2)
 * @param {RayPick|null} [opts.water]   the nearest water source (SURV3: the mod's fountains, wells and troughs)
 * @param {RayPick|null} [opts.gate]    an Oblivion Gate's fire (WB2: scenes/gatePool.js targets)
 * @param {number} [opts.doorDistance]  the door / board / static-NPC set's nearest, or Infinity
 * @param {number[]} [opts.personDistances]  the street's townsfolk, by the host's own cylinder pick
 * @returns {RaceResult}
 */
export function raceActivation({
  corpse = null, pile = null, torch = null, wagon = null, horseCart = null, camp = null, water = null, gate = null, doorDistance = Infinity, personDistances = [],
} = {}) {
  // the body and the pile, by distance, the tie to the body
  const pileNearer = !!pile && !(corpse && corpse.distance <= pile.distance);
  const body = pileNearer ? null : corpse;
  const heap = pileNearer ? pile : null;

  const lootD = body?.distance ?? Infinity;
  const dropD = heap?.distance ?? Infinity;
  const torchD = torch?.distance ?? Infinity;
  const wagonD = wagon?.distance ?? Infinity;
  const horseCartD = horseCart?.distance ?? Infinity;
  const campD = camp?.distance ?? Infinity;
  const waterD = water?.distance ?? Infinity;
  const gateD = gate?.distance ?? Infinity;   // WB2: an Oblivion Gate's fire

  // what the ground must beat: everything that is not a person
  const nonPersonRival = Math.min(lootD, dropD, torchD, wagonD, horseCartD, campD, waterD, gateD, doorDistance);
  const rival = Math.min(nonPersonRival, ...personDistances);

  // ── ONE PRECEDENCE, AND IT IS `raceWinner`'S ─────────────────────
  //
  // AUDIT-WH H1 (Mac's call, 2026-09-21: "b"). This function used to
  // answer six independent booleans, each its own `<= Math.min(...)`,
  // and the four custom activations compared themselves against
  // `doorDistance` while the BODY and the PILE did not. The hosts'
  // ladder is `if (lootKey) ... else if (dropKey) ... else tryEnter()`,
  // so a corpse anywhere under the 76.8 ray beat a door at your feet -
  // and a corpse at twelve metres beat it and then refused itself with
  // "You are too far away." DFU casts ONE ray (PlayerActivate.cs:314)
  // and dispatches to the NEAREST hit; nothing in it lets a far body
  // out-rank a near door.
  //
  // It was found because the world hover needed the race's WINNER, not
  // its flags, and the two answers disagreed on 9.3% of pick sets. The
  // fix is not to teach the plaque the press's quirk: it is to have
  // ONE ordering law and derive both readers from it, so they cannot
  // drift again. `raceWinner` below is that law - nearest wins, ties by
  // the hosts' own arm order - and this function is now its first
  // reader. The plaque is its second.
  const ground = Number.isFinite(doorDistance) ? { key: GROUND_KEY, distance: doorDistance } : null;
  const won = raceWinner({ gate, camp, water, wagon, horseCart, torch, corpse: body, pile: heap, ground });
  const is = (p) => !!won && !!p && won === p;

  return {
    loot: is(body) ? body : null,
    drop: is(heap) ? heap : null,
    torchWins: is(torch),
    wagonWins: is(wagon),
    horseCartWins: is(horseCart),
    gateWins: is(gate),   // WB2
    campWins: is(camp),
    waterWins: is(water),
    nonPersonRival,
    rival,
  };
}

/** The door/board/static-NPC set's stand-in inside the race. It is the
 *  one competitor the press knows only as a DISTANCE (the plaque knows
 *  it as a hit), so it needs a key to be told apart from the families
 *  that carry one. */
export const GROUND_KEY = '__ground__';

/**
 * WORLD-HOVER: THE RACE'S WINNER, AS A HIT.
 *
 * `raceActivation` above answers WHO BEAT WHOM - which arm the press
 * should take - because that is all a press needs: it dispatches into
 * the winning arm and the arm knows its own subject. A plaque needs
 * something the press never asks for: the winner ITSELF, so it can say
 * what the thing is called.
 *
 * That could have been a second race written out in the hover. It is
 * not, and HARD2 is the reason: the race WAS written by hand in
 * world.js and exterior.js, character for character, which is how
 * AUDIT 66 F7 shipped a torch that had to beat the pile but not the
 * door. A third copy - one that only a readout reads, so nobody would
 * ever notice it drifting - is the same bug with a longer fuse.
 *
 * So the ordering law is spelled ONCE, here, and both readers take it:
 * NEAREST WINS, AND A TIE GOES TO WHOEVER COMES FIRST IN THIS LIST.
 *
 * The order is not a guess. `raceActivation` answers each custom
 * activation with `<= Math.min(...)`, so on an exact tie MORE THAN ONE
 * of its flags is true, and which one takes the press is decided by
 * the order the host TESTS them in - `campWins`, then `waterWins`,
 * then `wagonWins`, then the torch, then the body, then the pile, then
 * the door/person/board set. That ladder is the precedence, and it is
 * what this list is. A pin drives the two against each other over the
 * same picks, including at exact ties, so a change to one that the
 * other does not follow goes red.
 *
 * The door/person/board set arrives as a HIT rather than a distance,
 * because unlike the press the plaque has to name which door.
 *
 * TWO COMPETITORS THE PRESS RACES ELSEWHERE, at the tail (AUDIT-WH H2).
 * A walking townsperson and a LIVE foe are not in any host's target
 * list - they are picked by their own cylinder and their own AABB
 * sweep, and the press races them in the two arms ABOVE
 * `raceActivation`:
 *
 *   else if (_enemyArm(RAY_DISTANCE, _race.rival))        // the foe
 *   else if (!townTalk.tryActivate(.., _race.nonPersonRival))  // the person
 *
 * Both of those arms take their subject only when it is STRICTLY
 * nearer than its rival (`hit.distance < nearerThan`,
 * mobileEnemyActivate.js:167; `bestDist < nearerThan`,
 * townTalk.js:689), and the person's rival leaves the persons out
 * while the foe's does not. Written out as one tie order that is
 * exactly what those two strict tests produce: everything in a target
 * list beats a person, a person beats a foe, and a foe loses every
 * tie it is in. So they go here, last, in that order - and the plaque
 * stops naming the shopfront behind the townsperson the press would
 * have talked to.
 *
 * @returns {RayPick|null} the winning pick, with its own key and reach
 */
export function raceWinner({
  corpse = null, pile = null, torch = null, wagon = null, horseCart = null, camp = null, water = null, gate = null, ground = null,
  person = null, peer = null, foe = null,
} = {}) {
  let best = null;
  // The tie order IS the precedence order; `<` keeps the earlier one.
  // PEER-PLAQUE1: another player (`peer`, player/socialPick.js peerRayPick) stands between the townsperson and
  // the foe - a body like the person's, measured through the same cylinder (rayPersonDistance), and the press
  // has no arm for it at all (the F key is its own gesture, SOC5), so the plaque is the only thing that races it.
  // HCC: the mod's three activators stand with the other custom activations (RegisterCustomActivation's 3.2), right
  // after Eye Of The Beholder's cart - the two carts are the same family, and the hosts test them in this order.
  // WB2: an Oblivion Gate's fire heads the custom activations - the one thing in the world a press on it can only mean
  for (const p of [gate, camp, water, wagon, horseCart, torch, corpse, pile, ground, person, peer, foe]) {
    if (!p) continue;
    if (best === null || p.distance < best.distance) best = p;
  }
  return best;
}
