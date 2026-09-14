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
 * Race everything the one ray struck.
 *
 * @param {{key: string, distance: number, reach: number}|null} corpse  the nearest body (both pools, one pick)
 * @param {{key: string, distance: number, reach: number}|null} pile    the nearest dropped pile
 * @param {{key: string, distance: number, reach: number}|null} torch   the nearest dropped light
 * @param {number} doorDistance   the door / board / static-NPC set's nearest, or Infinity
 * @param {number[]} personDistances   the street's townsfolk, by the host's own cylinder pick
 * @returns {{
 *   loot: object|null,        the body, when it beat the pile - the host's `_lootPick`
 *   drop: object|null,        the pile, when it beat the body - the host's `_dropPick`
 *   torchWins: boolean,       the torch beat the body, the pile AND the door
 *   nonPersonRival: number,   what a PERSON arm must beat (the persons left out)
 *   rival: number,            what the FOE arm must beat (the townsfolk included)
 * }}
 */
export function raceActivation({
  corpse = null, pile = null, torch = null, doorDistance = Infinity, personDistances = [],
} = {}) {
  // the body and the pile, by distance, the tie to the body
  const pileNearer = !!pile && !(corpse && corpse.distance <= pile.distance);
  const loot = pileNearer ? null : corpse;
  const drop = pileNearer ? pile : null;

  const lootD = loot?.distance ?? Infinity;
  const dropD = drop?.distance ?? Infinity;
  const torchD = torch?.distance ?? Infinity;

  // what the ground must beat: everything that is not a person
  const nonPersonRival = Math.min(lootD, dropD, torchD, doorDistance);
  const rival = Math.min(nonPersonRival, ...personDistances);

  // the torch takes the click when nothing on the ground, and no door,
  // is nearer. Its own reach is the ARM's business, not the race's: a
  // winner out of reach still answers, which is how every handler
  // family in this port refuses (AUDIT 65 MC-2).
  const torchWins = !!torch && torchD <= Math.min(lootD, dropD, doorDistance);

  return { loot, drop, torchWins, nonPersonRival, rival };
}
