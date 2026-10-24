// @ts-check
// EG-E (2026-10-12, Mac: "I said I want everything"; bible/11-Multiplayer/Elite-Gates.md section 19, REWARDS AND THE
// ECONOMY): WHAT A REDOUBT PAYS - the one law the account service pays a Redoubt's `w` receipt by (server-account/src/eg.js
// claimEg: the week's pay, the embers, the Valkynaz's key, the Panoply's pity) and the client rolls its spoils by
// (systems/eliteGates/egSpoils.js rollEgSpoils), so the two can never disagree on a roll:
//   THE WEEK - a Redoubt's number pays once an account an arena week (net/arena/arenaLaw.js arenaWeekOf); taken again that week
//     it pays its gold alone.
//   A VALKYNAZ'S REDOUBT - every fifth (net/eliteGates/egLaw.js egBossOf: Ilthys at 5, Morvayn at 10, Seyth at 15, Garoth at 20 and
//     every fifth after) rolls its spoils twice, on two seeds from the receipt's.
//   THE PANOPLY'S DRAW - its own stream off each pass's seed (never the spoils' own, whose order SET6's law keeps), so the
//     service reads a miss for the pity without the loot ladder: 1 in max(4, 12 - floor(R/2)), 1 in 3 at a Valkynaz's.
//   THE EMBERS - 1 + floor(R/10) at a Valkynaz's Redoubt, and 1 for a Redoubt first taken this season.
//   AUDIT EG V (lane8 L8-5; sections 16.1 and 19): THE SPOILS' SEED - a receipt's `c` mixed with the account service's own
//     draw at its claim (egSpoilsSeed), answered with the claim: the receipt's seed is the page's to read, so a member
//     holding several receipts of one Redoubt rolled each one's spoils ahead and claimed the best first, the one the week
//     pays. Nothing is rolled before the service has said which receipt pays.
//
// Pure. Not a DFU member. Ledger A (ELITE-GATES).

/** Marks a Redoubt pays (MARKS_FAUCETS.eg - net/marksLaw.js), inside the combat cap. */
export const EG_PAY_MARKS = 20;
/** Taken this many times without a Panoply piece, the next roll gives one (the service's `eg_pity`). */
export const EG_PANOPLY_PITY = 10;
/** A Valkynaz's Redoubt's Panoply odds, 1 in this. */
export const EG_PANOPLY_VALK_IN = 3;
/** A Valkynaz's Redoubt's Weir Key, this share of the time, at most one an account an arena week. */
export const EG_VALK_KEY_ODDS = 1 / 4;
/** The Broker's Panoply sink: one piece of the buyer's choosing, once an account an arena week, for this many embers. */
export const EG_SINK_EMBERS = 20;
/** The lord's named Legendary: 1 in this at its Redoubt. */
export const EG_LORD_ARM_IN = 8;

/** Whether Redoubt `w` is a Valkynaz's (every fifth). Pure. */
export const egValkRedoubt = (w) => Number.isSafeInteger(w) && w >= 5 && w % 5 === 0;
/** How many times Redoubt `w`'s spoils are rolled: twice at a Valkynaz's. Pure. */
export const egSpoilsPasses = (w) => (egValkRedoubt(w) ? 2 : 1);
/** The Panoply's odds at Redoubt `w`, 1 in this: 12 at Redoubt 1, 4 from Redoubt 16, 3 at a Valkynaz's. Pure. */
export const egPanoplyIn = (w) => (egValkRedoubt(w) ? EG_PANOPLY_VALK_IN : Math.max(4, 12 - Math.floor(Math.max(1, w | 0) / 2)));
/** The Legendary's share of the first piece: 20% at Redoubt 1, +3% a Redoubt, to 65% (Redoubt 16). Pure. */
export const egLegendaryShare = (w) => Math.min(0.65, 0.2 + 0.03 * (Math.max(1, w | 0) - 1));

/** A 32-bit mix (murmur3's finalizer) - a pass's seed and the Panoply's stream off it. Pure. */
function mix(x) {
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
/** The seed spoils pass `pass` rolls on: the receipt's own first, a second mixed from it. Pure. */
export const egPassSeed = (seed, pass) => (pass ? mix(((seed >>> 0) ^ Math.imul(pass, 0x9e3779b9)) >>> 0) : seed >>> 0);
/** The Panoply's draw for a pass, in [0, 1): its own stream off the pass's seed. Pure. */
export const egPanoplyDraw = (seed, pass) => mix((egPassSeed(seed, pass) ^ 0x7a40b1e5) >>> 0) / 4294967296;
/** AUDIT EG V (lane8 L8-5): the seed a receipt's spoils roll on (a Redoubt's passes and Panoply draws, an end's
 *  Reliquaries) - its own `c` mixed with `nonce`, the account service's own draw at the claim that recorded it (16 hex,
 *  kept on the row - eg_redoubts.nonce, eg_runs.nonce - so a claim asked again answers the same seed). Pure. */
export function egSpoilsSeed(c, nonce) {
  const n = typeof nonce === 'string' && /^[0-9a-f]{16}$/.test(nonce) ? nonce : '0'.repeat(16);
  return mix((mix(((c >>> 0) ^ parseInt(n.slice(0, 8), 16)) >>> 0) ^ parseInt(n.slice(8), 16)) >>> 0);
}
/** Whether pass `pass` of Redoubt `w`'s spoils draws a Panoply piece by its own odds (the pity aside). Pure. */
export const egPanoplyHit = (seed, w, pass) => egPanoplyDraw(seed, pass) * egPanoplyIn(w) < 1;

/** The embers Redoubt `w` pays: 1 + floor(R/10) at a Valkynaz's, and 1 when it is the account's first of it this season.
 *  Pure. */
export const egEmbersOf = (w, firstThisSeason) => (egValkRedoubt(w) ? 1 + Math.floor(w / 10) : 0) + (firstThisSeason ? 1 : 0);

/** THE BATTLEMAGE'S PANOPLY's nine pieces (section 19; systems/aetheric.js PANOPLY_SET_PIECES holds their records, in
 *  Sigil-Sets.md's SET_PLACES order): each record's id, `panoply-<key>` - the account service's sink sells by it. */
export const EG_PANOPLY_KEYS = Object.freeze(['warhelm', 'right-pauldron', 'left-pauldron', 'cuirass', 'gauntlets', 'greaves', 'boots', 'shield', 'saber']);
export const EG_PANOPLY_IDS = Object.freeze(EG_PANOPLY_KEYS.map((k) => `panoply-${k}`));
